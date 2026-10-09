import { readConfig, updateEnv } from './config.js';
import { Database } from './db.js';
import { createApp } from './app.js';
import { initializeReview } from './review.js';
import { startWorker, sender, validatePush } from './push.js';
import webpush from 'web-push';
import { pathToFileURL } from 'node:url';
import { realpathSync } from 'node:fs';
import { migrateAuth } from './auth-schema.js';

export async function main(args = process.argv.slice(2)) {
  const config = readConfig(undefined, args.includes('--review') ? { ...process.env, APP_ENV:'Development',REVIEW_ENABLED:'true',PUSH_ENABLED:'false',BIND_ADDRESS:'0.0.0.0',PORT:'5180', ADMIN_APP_URL:'http://admin.localhost:5180', USER_APP_URL:'http://localhost:5180' } : process.env);
  if (args.includes('--create-push-keys')) {
    if (config.push.publicKey && config.push.privateKey) { console.log('Existing Web Push keys preserved.'); return; }
    if (config.push.publicKey || config.push.privateKey) throw new Error('Incomplete existing VAPID keys; restore the missing key before continuing.');
    const keys = webpush.generateVAPIDKeys(); updateEnv(config.envFile,{PUSH_PUBLIC_KEY:keys.publicKey,PUSH_PRIVATE_KEY:keys.privateKey,PUSH_ENABLED:'false'});
    console.log('Web Push keys saved to .env; private key was not printed.'); return;
  }
  if (args.includes('--set-push-contact')) {
    const contact = args[args.indexOf('--set-push-contact')+1] || '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) throw new Error('Provide a valid Web Push contact email.');
    config.push.subject=`mailto:${contact}`; validatePush(config); updateEnv(config.envFile,{PUSH_SUBJECT:config.push.subject,PUSH_ENABLED:'true'}); console.log('Web Push contact saved to .env.'); return;
  }
  if (args.some(arg => !['--review','--check-database','--migrate-auth'].includes(arg))) throw new Error('Unknown command. Use --check-database, --migrate-auth or --review.');
  const db = await Database.connect(config);
  if (args.includes('--migrate-auth')) { try { if (config.review || config.environment === 'Testing') throw new Error('Auth migration requires SQL Server mode.'); await migrateAuth(db); await db.check(); } finally { await db.close(); } return; }
  if (args.includes('--check-database')) { try { if (config.review) throw new Error('Deployment database verification requires SQL Server mode.'); await db.check(); } finally { await db.close(); } return; }
  if (config.review) await initializeReview(db); else await db.check();
  const stopWorker = config.push.enabled ? startWorker(db,sender(config)) : () => {};
  const app = createApp(db,config); const server = app.listen(config.port,config.bindAddress,() => console.log(`Clienté Node.js API listening on ${config.bindAddress}:${config.port} (${config.review ? 'review' : 'sqlServer'}).`));
  server.on('error', error => { console.error(`HTTP server failed (${(error as NodeJS.ErrnoException).code}).`); stopWorker(); void db.close().finally(() => { process.exitCode=1; }); });
  const stop = () => { stopWorker(); server.close(() => { void db.close().finally(() => { process.exitCode=0; }); }); };
  process.once('SIGTERM',stop); process.once('SIGINT',stop);
  return {server,db,stop};
}
// Node resolves the module's real path; systemd invokes it through /opt/cliente/current.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main().catch(error => { let message = String(error?.message || 'Startup failed.');
    try { const secret = readConfig().db.password; if (secret) message = message.split(secret).join('[redacted]'); } catch {}
    console.error(`Startup failed (${error?.code || error?.name || 'unknown'}): ${message.slice(0,1000)}`); process.exitCode=1; });
}
