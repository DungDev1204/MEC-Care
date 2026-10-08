import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Database, Row } from './db.js';
import type { Config } from './config.js';
import { customerSchema, HttpError, searchText, phone, uuid } from './validation.js';

export async function ownedCustomer(db: Database, owner: string, id: string) {
  uuid.parse(id); const customer = await db.one('Customers', 'Id=@id AND OwnerId=@owner', { id, owner });
  if (!customer) throw new HttpError(404, 'Không tìm thấy khách hàng.'); return customer;
}
export function photoPath(config: Config, fileName: string) {
  const target = path.resolve(config.storage, fileName);
  if (path.dirname(target) !== config.storage) throw new HttpError(409, 'Đường dẫn ảnh không hợp lệ.'); return target;
}
export function customersRouter(db: Database, config: Config) {
  const router = Router(); const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 3 } });
  router.get('/customers', async (req, res) => {
    const owner = res.locals.user.id; const rows = await db.rows('Customers', 'OwnerId=@owner', { owner }, 'Name');
    const vehicles = await db.query('SELECT v.* FROM Vehicles v JOIN Customers c ON c.Id=v.CustomerId WHERE c.OwnerId=@owner', { owner });
    const latest = await db.query('SELECT ct.CustomerId, MAX(ct.At) AS LastContactAt FROM Contacts ct JOIN Customers c ON c.Id=ct.CustomerId WHERE c.OwnerId=@owner GROUP BY ct.CustomerId', { owner });
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''; const term = searchText(search); const digits = phone(search);
    res.json(rows.filter(c => !search || c.searchText.includes(term) || digits.length >= 3 && c.phone.includes(digits)).map(c => ({ id: c.id, name: c.name, phone: c.phone, status: c.status,
      avatarId: c.avatarId, updatedAt: c.updatedAt, vehicles: vehicles.filter(v => v.customerId === c.id), lastContactAt: latest.find(l => l.customerId === c.id)?.lastContactAt ?? null })));
  });
  router.get('/customers/:id', async (req, res) => {
    const customer = await ownedCustomer(db, res.locals.user.id, String(req.params.id));
    res.json({ ...customer, vehicles: await db.rows('Vehicles', 'CustomerId=@id', { id: customer.id }) });
  });
  async function save(id: string | undefined, input: unknown, owner: string) {
    const data = customerSchema.parse(input);
    return db.transaction(async tx => {
      if (id) await ownedCustomer(tx, owner, id);
      const duplicate = (await tx.rows('Customers', 'OwnerId=@owner AND Phone=@phone', { owner, phone: data.phone })).find(c => c.id !== id);
      if (duplicate && !data.confirmDuplicate) throw new HttpError(409, 'Số điện thoại đã có hồ sơ. Xác nhận nếu đây là khách khác.', { duplicate: { id: duplicate.id, name: duplicate.name } });
      const oldVehicles = id ? await tx.rows('Vehicles', 'CustomerId=@id', { id }) : [];
      const customerId = id || randomUUID();
      const { vehicles, confirmDuplicate, ...fields } = data;
      const record: Row = { ...fields, searchText: searchText(`${data.name} ${data.phone} ${vehicles.map(v => `${v.model} ${v.plate}`).join(' ')}`).slice(0,1000), updatedAt: new Date() };
      if (id) await tx.update('Customers', record, 'Id=@id AND OwnerId=@owner', { id, owner });
      else await tx.insert('Customers', { ...record, id: customerId, ownerId: owner, avatarId: null });
      for (const old of oldVehicles) if (!vehicles.some(v => v.id === old.id)) await tx.remove('Vehicles', 'Id=@id AND CustomerId=@customerId', { id: old.id, customerId });
      const seen = new Set<string>();
      for (const vehicle of vehicles) {
        if (vehicle.id && seen.has(vehicle.id)) throw new HttpError(400, 'Thông tin xe bị lặp.');
        if (vehicle.id) seen.add(vehicle.id);
        const old = oldVehicles.find(v => v.id === vehicle.id);
        // Ignore unowned submitted ids; new vehicles always receive server-generated ids.
        if (old) await tx.update('Vehicles', vehicle, 'Id=@id AND CustomerId=@customerId', { id: old.id, customerId });
        else await tx.insert('Vehicles', { ...vehicle, id: randomUUID(), customerId });
      }
      return { ...await tx.one('Customers', 'Id=@id', { id: customerId }), vehicles: await tx.rows('Vehicles', 'CustomerId=@id', { id: customerId }) };
    });
  }
  router.post('/customers', async (req, res) => { res.json(await save(undefined, req.body, res.locals.user.id)); });
  router.put('/customers/:id', async (req, res) => { const id = uuid.parse(String(req.params.id)); res.json(await save(id, req.body, res.locals.user.id)); });
  router.get('/customers/:id/photos', async (req, res) => {
    const customer = await ownedCustomer(db, res.locals.user.id, String(req.params.id));
    res.json(await db.rows('Photos', 'CustomerId=@id AND IsAvatar=@avatar', { id: customer.id, avatar: false }, 'CreatedAt DESC'));
  });
  router.post('/customers/:id/photos', async (req, res, next) => { await ownedCustomer(db, res.locals.user.id, String(req.params.id)); next(); }, upload.single('file'), async (req, res) => {
    const bytes = req.file?.buffer; if (!bytes || bytes.length < 8) throw new HttpError(400, 'Chọn một ảnh JPEG, PNG hoặc WebP nhỏ hơn 10 MB.');
    const png = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])); const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp = bytes.length >= 12 && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
    if (!png && !jpeg && !webp) throw new HttpError(400, 'Chỉ nhận JPEG, PNG hoặc WebP. Hãy xuất HEIC thành JPEG.');
    const caption = z.string().max(500).parse(req.body.caption ?? '').trim(); const id = randomUUID();
    const p = { id, customerId: String(req.params.id), isAvatar: req.body.avatar === 'true', caption, contentType: png ? 'image/png' : jpeg ? 'image/jpeg' : 'image/webp', fileName: id + (png ? '.png' : jpeg ? '.jpg' : '.webp'), createdAt: new Date() };
    await fs.mkdir(config.storage, { recursive: true }); await fs.writeFile(photoPath(config, p.fileName), bytes, { flag: 'wx', mode: 0o600 });
    let old: Row | undefined;
    try {
      const result = await db.transaction(async tx => {
        const customer = await ownedCustomer(tx, res.locals.user.id, p.customerId);
        if (p.isAvatar && customer.avatarId) old = await tx.one('Photos', 'Id=@id AND CustomerId=@customerId', { id: customer.avatarId, customerId: p.customerId });
        const photo = await tx.insert('Photos', p);
        if (p.isAvatar) { await tx.update('Customers', { avatarId: id }, 'Id=@id', { id: p.customerId }); if (old) await tx.remove('Photos', 'Id=@id', { id: old.id }); }
        return photo;
      });
      if (old) await fs.unlink(photoPath(config, old.fileName)).catch(() => {}); res.json(result);
    } catch (error) { await fs.unlink(photoPath(config, p.fileName)).catch(() => {}); throw error; }
  });
  async function ownedPhoto(id: string, owner: string, source = db) {
    uuid.parse(id); const photo = await source.one('Photos', 'Id=@id AND CustomerId IN (SELECT Id FROM Customers WHERE OwnerId=@owner)', { id, owner });
    if (!photo) throw new HttpError(404, 'Không tìm thấy ảnh.'); return photo;
  }
  router.get('/photos/:id/file', async (req, res) => {
    const photo = await ownedPhoto(String(req.params.id), res.locals.user.id); const file = photoPath(config, photo.fileName);
    try { await fs.access(file); } catch { throw new HttpError(404, 'Không tìm thấy ảnh.'); }
    res.type(photo.contentType); res.sendFile(file);
  });
  router.put('/photos/:id', async (req, res) => {
    const p = await ownedPhoto(String(req.params.id), res.locals.user.id); const caption = z.object({ caption: z.string().max(500) }).parse(req.body).caption.trim();
    await db.update('Photos', { caption }, 'Id=@id', { id: p.id }); res.json({ ...p, caption });
  });
  router.delete('/photos/:id', async (req, res) => {
    const p = await db.transaction(async tx => {
      const photo = await ownedPhoto(String(req.params.id), res.locals.user.id, tx);
      await tx.update('Customers', { avatarId: null }, 'Id=@customerId AND AvatarId=@id AND OwnerId=@owner', { customerId: photo.customerId, id: photo.id, owner: res.locals.user.id });
      await tx.remove('Photos', 'Id=@id', { id: photo.id }); return photo;
    });
    await fs.unlink(photoPath(config, p.fileName)).catch(() => {}); res.sendStatus(204);
  });
  return router;
}
