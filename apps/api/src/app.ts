import express, { Router, type ErrorRequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { ZodError } from 'zod';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Config } from './config.js';
import type { Database } from './db.js';
import { authenticate, requireUser, requireActive, sessionInfo, hashPassword, verifyPassword, startSession, hash, token, cookieName } from './auth.js';
import { loginSchema, HttpError } from './validation.js';
import { registrationRouter } from './registration.js';
import { otpSender, type SendOtp } from './mail.js';
import { adminRouter } from './admin.js';
import { subscriptionRouter } from './subscription.js';
import { announcementRouter } from './announcements.js';
import { customersRouter } from './customers.js';
import { careRouter } from './care.js';
import { accountRouter } from './account.js';
import { pushRouter } from './push.js';

export function createApp(db: Database, config: Config, sendOtp: SendOtp = otpSender(config)) {
  const app = express(); app.disable('x-powered-by'); if (config.trustLocalProxy) app.set('trust proxy', 'loopback');
  app.use(helmet({ contentSecurityPolicy: false, strictTransportSecurity: config.environment === 'Production' ? { maxAge: 31536000 } : false }));
  app.use((req, res, next) => {
    const hostname = (req.headers.host || '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
    const reviewHosts = config.review ? ['localhost','127.0.0.1',...Object.values(os.networkInterfaces()).flatMap(list => (list || []).map(a => a.address))] : [];
    if (!config.allowedHosts.includes('*') && !config.allowedHosts.includes(hostname) && !reviewHosts.includes(hostname)) { res.status(400).json({ message: 'Hostname chưa được cho phép.' }); return; }
    if (config.environment === 'Production' && !req.secure) { res.redirect(307, `https://${req.headers.host}${req.originalUrl}`); return; }
    if (req.path.startsWith('/api') || req.path.startsWith('/auth')) res.set('Cache-Control', 'no-store');
    if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      if (origin) {
        let same = false;
        try {
          const u = new URL(origin); same = u.origin === `${req.protocol}://${req.headers.host}`;
          if (config.review && u.protocol === 'http:' && u.port === '8081' && reviewHosts.includes(u.hostname)) same = true;
        } catch {}
        if (!same) { res.status(403).json({ message: 'Nguồn yêu cầu không hợp lệ.' }); return; }
      }
      const hasBody = Number(req.get('content-length') || 0) > 0 || !!req.get('transfer-encoding');
      if (hasBody && (req.path.startsWith('/api') || req.path.startsWith('/auth')) && !req.is('application/json') && !/^\/api\/customers\/[0-9a-f-]+\/photos$/i.test(req.path)) {
        res.status(415).json({ message: 'Yêu cầu cần dùng JSON.' }); return;
      }
    }
    next();
  });
  app.use(express.json({ limit: '256kb', strict: true })); app.use(cookieParser());
  app.get('/health', (_req, res) => { res.json({ status: 'running', mode: config.review ? 'review' : 'sqlServer', runtime: 'node' }); });
  const limiter = (limit: number, windowMs: number) => rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Bạn đã thử nhiều lần. Vui lòng chờ rồi thử lại.' } });
  app.use('/auth', registrationRouter(db, sendOtp));
  app.post('/auth/login', limiter(10, 60000), async (req, res) => {
    const input = loginSchema.parse(req.body);
    // Usernames never contain @, so legacy email sign-in stays unambiguous.
    const user = await db.one('Employees', input.identifier.includes('@') ? 'Email=@identifier' : 'Username=@identifier', { identifier: input.identifier });
    if (!user || !await verifyPassword(input.password, user.passwordHash)) { if (!user) await hashPassword(input.password); throw new HttpError(401, 'Username hoặc mật khẩu không đúng.'); }
    if (user.emailVerified === false) throw new HttpError(403, 'Email chưa được xác minh.');
    if (!user.enabled) throw new HttpError(403, 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.');
    if (!user.passwordHash.startsWith('scrypt$')) await db.update('Employees', { passwordHash: await hashPassword(input.password) }, 'Id=@id', { id: user.id });
    res.json(await startSession(db,req,res,user,config));
  });
  const api = Router(); api.use(authenticate(db)); api.use(requireUser);
  api.get('/session', (_req, res) => { res.json(sessionInfo(res.locals.user)); });
  api.post('/logout', async (req, res) => {
    await db.transaction(async tx => {
      const session = await tx.one('Sessions', 'TokenHash=@hash AND EmployeeId=@owner', { hash: hash(token(req)), owner: res.locals.user.id });
      if (session) { await tx.update('Devices', { enabled: false }, 'SessionId=@id', { id: session.id }); await tx.update('Sessions', { expiresAt: new Date() }, 'Id=@id', { id: session.id }); }
    }); res.clearCookie(cookieName, { httpOnly: true, secure: config.environment !== 'Development', sameSite: 'strict', path: '/' }); res.sendStatus(204);
  });
  api.use(adminRouter(db,config)); api.use(subscriptionRouter(db)); api.use(announcementRouter(db));
  api.use('/account/backup', requireActive); api.use(accountRouter(db,config));
  api.use(requireActive); api.use(customersRouter(db,config)); api.use(careRouter(db)); api.use(pushRouter(db,config)); app.use('/api', api);
  app.use(['/api','/auth'], (_req, res) => { res.sendStatus(404); });
  app.use(express.static(config.webRoot, { setHeaders: (res, file) => { if (['index.html','sw.js'].includes(path.basename(file))) res.setHeader('Cache-Control','no-cache'); } }));
  app.get('/{*path}', (_req, res) => { const index = path.join(config.webRoot,'index.html'); if (fs.existsSync(index)) { res.set('Cache-Control','no-cache'); res.sendFile(index); } else res.sendStatus(404); });
  const onError: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) { next(error); return; }
    if (error instanceof HttpError) { res.status(error.status).json({ message: error.message, ...error.extra }); return; }
    if (error instanceof ZodError) { res.status(400).json({ message: 'Dữ liệu chưa hợp lệ.', errors: Object.fromEntries(error.issues.map(issue => [issue.path.join('.'),[issue.message]])) }); return; }
    if (error instanceof multer.MulterError) { res.status(400).json({ message: 'Chọn một ảnh nhỏ hơn 10 MB.' }); return; }
    if (error instanceof SyntaxError || error?.status === 413) { res.status(error?.status === 413 ? 413 : 400).json({ message: 'Nội dung yêu cầu chưa hợp lệ hoặc quá lớn.' }); return; }
    console.error(`API request failed (${error?.code || error?.name || 'unknown'}).`); res.status(500).json({ message: 'Chưa thực hiện được. Hãy thử lại.' });
  }; app.use(onError); return app;
}
