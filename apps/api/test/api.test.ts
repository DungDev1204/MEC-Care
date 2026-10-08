import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { randomUUID, pbkdf2Sync, randomBytes } from 'node:crypto';
import { DateTime } from 'luxon';
import { Database } from '../src/db.js';
import { readConfig, updateEnv } from '../src/config.js';
import { createApp } from '../src/app.js';
import { verifyPassword, hashPassword, hash } from '../src/auth.js';
import { generate, localTime, searchText } from '../src/validation.js';
import { endpointAllowed, keyValid, runCycle } from '../src/push.js';
import { initializeReview } from '../src/review.js';
import webpush from 'web-push';
import { unzipSync } from 'fflate';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const fixtures = new WeakMap<ReturnType<typeof createApp>, Database>();
async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(),'cliente-test-'));
  const config = readConfig(path.join(directory,'.env'),{APP_ENV:'Testing',DB_SERVER:'unused',DB_USER:'unused',DB_PASSWORD:'test-only',DB_NAME:'unused',STORAGE_PATH:path.join(directory,'photos')});
  config.reviewDatabase=':memory:'; const db = await Database.connect(config); const app = createApp(db,config); fixtures.set(app, db);
  return {db,app,config,close:async()=>{await db.close();await fs.rm(directory,{recursive:true,force:true});}};
}
// Existing feature tests use seeded active accounts; public signup is tested separately.
const register = async (app: ReturnType<typeof createApp>, name: string) => {
  await fixtures.get(app)!.insert('Employees', { id: randomUUID(), email: `${name}@example.test`, displayName: name, phone: '', enabled: true, passwordHash: await hashPassword('password-123456') });
  return request(app).post('/auth/login').send({ email: `${name}@example.test`, password: 'password-123456' });
};
const customer = {name:'Nguyễn Minh Ánh',phone:'0901234567',birthDate:'1990-01-01',interests:'Golf',notes:'',preferredContact:'',status:'new',vehicles:[{model:'Mercedes C 200',plate:'51A-12345',deliveryDate:null}]};
const reminder = () => ({kind:'afterPurchase',content:'Gọi chăm sóc',localDateTime:DateTime.now().setZone('Asia/Ho_Chi_Minh').plus({days:5}).toFormat("yyyy-MM-dd'T'HH:mm:ss"),timeZone:'Asia/Ho_Chi_Minh',repeat:'once',leadDays:1,leapDayPolicy:null});

test('existing accounts log in securely with preserved passwords',async()=>{
  const f=await fixture();try{
    const result=await register(f.app,'alice');assert.equal(result.status,200);assert.match(result.headers['set-cookie'][0],/HttpOnly/);assert.match(result.headers['set-cookie'][0],/Secure/);assert.match(result.headers['set-cookie'][0],/SameSite=Strict/);
    const stored=await f.db.one('Employees','Email=@email',{email:'alice@example.test'});assert.ok(stored?.passwordHash.startsWith('scrypt$'));assert.notEqual(stored?.passwordHash,'password-123456');
    assert.equal((await request(f.app).post('/auth/register').send({username:'alice',email:'alice@example.test',password:'123456'})).status,409);
    assert.equal((await request(f.app).post('/auth/register').send({displayName:'',email:'bad',password:'short'})).status,400);
    const login=await request(f.app).post('/auth/login').send({email:' ALICE@EXAMPLE.TEST ',password:'password-123456'});assert.equal(login.status,200);assert.equal(login.body.displayName,'alice');
    assert.equal((await request(f.app).post('/auth/login').send({email:'alice@example.test',password:'wrong'})).status,401);
    assert.equal((await request(f.app).get('/api/session').set('Authorization',`Bearer ${result.body.token}`)).status,200);
  }finally{await f.close();}
});
test('private data, vehicle updates, searches and duplicate confirmation remain compatible',async()=>{
  const f=await fixture();try{
    const a=(await register(f.app,'alice')).body.token,b=(await register(f.app,'bob')).body.token;
    const get=(url:string,token=a)=>request(f.app).get(url).set('Authorization',`Bearer ${token}`);
    const post=(url:string,data:any)=>request(f.app).post(url).set('Authorization',`Bearer ${a}`).send(data);
    assert.equal((await request(f.app).get('/api/customers')).status,401);
    const created=await post('/api/customers',customer);assert.equal(created.status,200);const id=created.body.id;
    assert.equal((await get(`/api/customers/${id}`,b)).status,404);assert.equal((await get('/api/customers',b)).body.length,0);
    assert.equal((await get('/api/customers?search=nguyen%20minh')).body.length,1);assert.equal((await get('/api/customers?search=C%20200')).body.length,1);
    assert.equal((await post('/api/customers',customer)).status,409);assert.equal((await post('/api/customers',{...customer,confirmDuplicate:true})).status,200);
    const updated=await request(f.app).put(`/api/customers/${id}`).set('Authorization',`Bearer ${a}`).send({...customer,confirmDuplicate:true,vehicles:[{...created.body.vehicles[0],model:'Mercedes E 300'}]});assert.equal(updated.status,200);assert.equal(updated.body.vehicles[0].id,created.body.vehicles[0].id);
    assert.equal((await request(f.app).put(`/api/customers/${id}`).set('Authorization',`Bearer ${b}`).send(customer)).status,404);
    assert.equal((await post('/api/customers',{...customer,phone:'123'})).status,400);
    assert.equal((await get('/api/customers/not-a-uuid')).status,400);
  }finally{await f.close();}
});
test('care records complete the correct occurrence atomically and preserve owner isolation',async()=>{
  const f=await fixture();try{
    const a=(await register(f.app,'alice')).body.token,b=(await register(f.app,'bob')).body.token;
    const post=(url:string,data:any,token=a)=>request(f.app).post(url).set('Authorization',`Bearer ${token}`).send(data);
    const c=(await post('/api/customers',customer)).body;const c2=(await post('/api/customers',{...customer,phone:'0901122334'})).body;
    const r=await post(`/api/customers/${c.id}/reminders`,reminder());assert.equal(r.status,200);
    const agenda=await request(f.app).get('/api/agenda').set('Authorization',`Bearer ${a}`);const o=agenda.body[0].occurrence;
    assert.equal((await post(`/occurrences/${o.id}/complete`,{})).status,404);
    assert.equal((await post(`/api/occurrences/${o.id}/complete`,{},b)).status,404);
    const care={at:new Date().toISOString(),channel:'call',content:'Khách hài lòng',occurrenceId:o.id,nextReminder:reminder()};
    assert.equal((await post(`/api/customers/${c2.id}/contacts`,care)).status,404);
    assert.equal((await post(`/api/customers/${c.id}/contacts`,{...care,nextReminder:{...reminder(),leadDays:2}})).status,400);
    assert.equal((await f.db.one('Occurrences','Id=@id',{id:o.id}))?.state,'pending');
    assert.equal((await post(`/api/customers/${c.id}/contacts`,care)).status,200);
    assert.equal((await post(`/api/occurrences/${o.id}/complete`,{})).status,409);
    assert.equal((await f.db.one('Occurrences','Id=@id',{id:o.id}))?.state,'completed');
    const next=(await f.db.rows('Occurrences','State=@state',{state:'pending'}))[0];
    const snooze=await post(`/api/occurrences/${next.id}/snooze`,{localDateTime:DateTime.now().setZone('Asia/Ho_Chi_Minh').plus({days:10}).toFormat("yyyy-MM-dd'T'HH:mm:ss"),timeZone:'Asia/Ho_Chi_Minh'});assert.equal(snooze.status,200);assert.equal(snooze.body.scheduledAt,snooze.body.notifyAt);
    assert.equal((await request(f.app).delete(`/api/reminders/${r.body.id}`).set('Authorization',`Bearer ${a}`)).status,204);
  }finally{await f.close();}
});
test('photos and backup files are protected, and avatar replacement cleans storage',async()=>{
  const f=await fixture();try{
    const a=(await register(f.app,'alice')).body.token,b=(await register(f.app,'bob')).body.token;
    const c=(await request(f.app).post('/api/customers').set('Authorization',`Bearer ${a}`).send(customer)).body;
    const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4X8AAAAASUVORK5CYII=','base64');
    const upload=()=>request(f.app).post(`/api/customers/${c.id}/photos`).set('Authorization',`Bearer ${a}`).field('avatar','true').attach('file',bytes,'test.png');
    const p=await upload();assert.equal(p.status,200);
    assert.equal((await request(f.app).get(`/api/photos/${p.body.id}/file`).set('Authorization',`Bearer ${b}`)).status,404);
    assert.equal((await request(f.app).get(`/api/photos/${p.body.id}/file`).set('Authorization',`Bearer ${a}`)).status,200);
    const backup=await request(f.app).get('/api/account/backup?includePhotos=true').set('Authorization',`Bearer ${a}`).buffer(true).parse((res,done)=>{const chunks:Buffer[]=[];res.on('data',chunk=>chunks.push(Buffer.from(chunk)));res.on('end',()=>done(null,Buffer.concat(chunks)));});assert.equal(backup.status,200);assert.match(backup.headers['content-type'],/zip/);assert.equal(backup.body.subarray(0,2).toString(),'PK');
    const files=unzipSync(backup.body);const data=JSON.parse(Buffer.from(files['data.json']).toString());assert.equal(data.customers.length,1);assert.equal(data.account.email,'alice@example.test');assert.ok(!JSON.stringify(data).includes('passwordHash'));assert.deepEqual(Buffer.from(files[data.photos[0].archivePath]),bytes);
    const replacement=await upload();assert.equal(replacement.status,200);assert.equal((await f.db.rows('Photos')).length,1);
    await assert.rejects(fs.access(path.join(f.config.storage,p.body.fileName)));
    assert.equal((await request(f.app).delete(`/api/photos/${replacement.body.id}`).set('Authorization',`Bearer ${a}`)).status,204);
    assert.equal((await f.db.one('Customers','Id=@id',{id:c.id}))?.avatarId,null);
    await f.db.insert('Photos',{id:randomUUID(),customerId:c.id,fileName:'missing.png',contentType:'image/png',caption:'missing',isAvatar:false,createdAt:new Date()});
    assert.equal((await request(f.app).get('/api/account/backup?includePhotos=true').set('Authorization',`Bearer ${a}`)).status,409);
    assert.equal((await request(f.app).get('/api/account/backup?includePhotos=false').set('Authorization',`Bearer ${a}`)).status,200);
  }finally{await f.close();}
});
test('logout expires session and disables its notification devices',async()=>{
  const f=await fixture();try{
    const registration=await register(f.app,'alice');const t=registration.body.token;const session=await f.db.one('Sessions','TokenHash=@hash',{hash:hash(t)});
    await f.db.insert('Devices',{id:randomUUID(),ownerId:session!.employeeId,sessionId:session!.id,pushToken:'test',enabled:true,endpoint:null,p256dh:null,authKey:null});
    assert.equal((await request(f.app).post('/api/logout').set('Authorization',`Bearer ${t}`).send({})).status,204);
    assert.equal((await request(f.app).get('/api/session').set('Authorization',`Bearer ${t}`)).status,401);
    assert.equal((await f.db.rows('Devices'))[0].enabled,false);
  }finally{await f.close();}
});
test('proxy trust, host checks, JSON-only writes and cross-origin protection',async()=>{
  const f=await fixture();try{
    const data={email:'a@example.test',password:'test-password-long'};
    assert.equal((await request(f.app).post('/auth/login').set('Origin','https://attacker.test').send(data)).status,403);
    assert.equal((await request(f.app).post('/auth/login').type('form').send(data)).status,415);
    assert.equal((await request(f.app).get('/health').set('Host','attacker.test')).status,400);
    f.config.environment='Production';f.config.trustLocalProxy=true;const app=createApp(f.db,f.config);
    assert.equal((await request(app).get('/health').set('Host','localhost').set('X-Forwarded-Proto','https')).status,200);
    assert.equal((await request(app).get('/health').set('Host','localhost')).status,307);
    f.config.trustLocalProxy=false;assert.equal((await request(createApp(f.db,f.config)).get('/health').set('Host','localhost').set('X-Forwarded-Proto','https')).status,307);
  }finally{await f.close();}
});
test('legacy Identity passwords can be verified without a .NET runtime',async()=>{
  const salt=randomBytes(16),key=pbkdf2Sync('legacy-password',salt,100000,32,'sha512');const header=Buffer.alloc(13);header[0]=1;header.writeUInt32BE(2,1);header.writeUInt32BE(100000,5);header.writeUInt32BE(16,9);const encoded=Buffer.concat([header,salt,key]).toString('base64');
  assert.equal(await verifyPassword('legacy-password',encoded),true);assert.equal(await verifyPassword('wrong',encoded),false);
  assert.equal(await verifyPassword('anything','invalid'),false);assert.equal(await verifyPassword('new-password',await hashPassword('new-password')),true);
});
test('annual reminders respect leap day rules, lead days and DST ambiguity',()=>{
  const r={id:randomUUID(),revision:1,localDateTime:'2028-02-29T09:00:00',timeZone:'Asia/Ho_Chi_Minh',repeat:'annual',leadDays:3,leapDayPolicy:'feb28'};
  const generated=generate(r,Date.parse('2028-01-01T00:00:00Z'));assert.equal(generated.length,3);assert.ok(generated[1].scheduledAt.startsWith('2029-02-28T02:00'));assert.ok(generated[1].notifyAt.startsWith('2029-02-25T02:00'));
  assert.ok(generate({...r,leapDayPolicy:'mar1'},Date.parse('2028-01-01T00:00:00Z'))[1].scheduledAt.startsWith('2029-03-01T02:00'));
  assert.throws(()=>localTime('2026-03-08T02:30:00','America/New_York'));assert.throws(()=>localTime('2026-11-01T01:30:00','America/New_York'));
  assert.equal(searchText('Đỗ Khánh Linh'),'do khanh linh');
});
test('.env is literal, operator flags are validated and VAPID keys are preserved',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cliente-env-'));const file=path.join(dir,'.env');
  try{await fs.writeFile(file,"DB_SERVER=localhost\nDB_NAME=MEC\nDB_USER=mec_app\nDB_PASSWORD='test$literal;#value'\nPORT=5180\nPUSH_PRIVATE_KEY='existing'\n");
    assert.equal(readConfig(file,{}).db.password,'test$literal;#value');assert.equal(readConfig(file,{PORT:'5181'}).port,5181);
    assert.throws(()=>readConfig(file,{DB_ENCRYPT:'maybe'}));assert.throws(()=>readConfig(file,{PORT:'70000'}));
    updateEnv(file,{PUSH_SUBJECT:"mailto:o'neal$literal@example.test"});assert.equal(readConfig(file,{}).push.subject,"mailto:o'neal$literal@example.test");assert.equal(readConfig(file,{}).push.privateKey,'existing');
    const keys=webpush.generateVAPIDKeys();assert.ok(keyValid(keys.publicKey,65));assert.ok(!keyValid('x'.repeat(87),65));
    assert.ok(endpointAllowed('https://fcm.googleapis.com/send/test'));assert.ok(!endpointAllowed('https://127.0.0.1/private'));assert.ok(!endpointAllowed('https://fcm.googleapis.com.attacker.test/send/test'));
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('review initialization is idempotent and preserves saved records',async()=>{
  const f=await fixture();try{await initializeReview(f.db);const count=(await f.db.rows('Customers')).length;await initializeReview(f.db);assert.equal((await f.db.rows('Customers')).length,count);assert.equal(count,7);assert.equal((await request(f.app).post('/auth/login').send({email:'review@clientstudio.local',password:'Review123!'})).status,200);}finally{await f.close();}
});
test('saved legacy Review data migrates ticks and uppercase GUIDs with a snapshot and valid relationships',async()=>{
  const f=await fixture();let migrated:Database|undefined;try{
    const file=path.join(path.dirname(f.config.storage),'legacy.db');const raw=new DatabaseSync(file);
    raw.exec(`CREATE TABLE Employees(Id TEXT PRIMARY KEY,Email TEXT,DisplayName TEXT,Phone TEXT,PasswordHash TEXT,Enabled INTEGER);
      CREATE TABLE Sessions(Id TEXT PRIMARY KEY,EmployeeId TEXT REFERENCES Employees(Id),TokenHash TEXT,ExpiresAt INTEGER);
      CREATE TABLE Customers(Id TEXT PRIMARY KEY,OwnerId TEXT REFERENCES Employees(Id),Name TEXT,SearchText TEXT,Phone TEXT,BirthDate TEXT,Interests TEXT,Notes TEXT,PreferredContact TEXT,Status TEXT,AvatarId TEXT,UpdatedAt INTEGER);`);
    const owner=randomUUID().toUpperCase(),customerId=randomUUID().toUpperCase(),sessionId=randomUUID().toUpperCase(),value='legacy-token';
    const now=BigInt(Date.now())*10000n+621355968000000000n;
    raw.prepare('INSERT INTO Employees VALUES(?,?,?,?,?,?)').run(owner,'legacy@example.test','Legacy','','not-used',1);
    raw.prepare('INSERT INTO Sessions VALUES(?,?,?,?)').run(sessionId,owner,hash(value),now+864000000000n);
    raw.prepare('INSERT INTO Customers VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(customerId,owner,'Khách đã lưu','khach da luu','0901234567',null,'','','','new',null,now);
    raw.close();f.config.reviewDatabase=file;migrated=await Database.connect(f.config);const app=createApp(migrated,f.config);
    const rows=await request(app).get('/api/customers').set('Authorization',`Bearer ${value}`);assert.equal(rows.status,200);assert.equal(rows.body.length,1);assert.equal(rows.body[0].id,customerId.toLowerCase());assert.equal(rows.body[0].name,'Khách đã lưu');assert.ok(Number.isFinite(Date.parse(rows.body[0].updatedAt)));
    assert.equal((await migrated.query('PRAGMA foreign_key_check')).length,0);await fs.access(file+'.before-node');
  }finally{await migrated?.close();await f.close();}
});
test('notification worker accepts provider receipts and respects expired/disabled sessions',async()=>{
  const f=await fixture();try{
    const registration=await register(f.app,'alice');const session=await f.db.one('Sessions','TokenHash=@hash',{hash:hash(registration.body.token)});
    const c=(await request(f.app).post('/api/customers').set('Authorization',`Bearer ${registration.body.token}`).send(customer)).body;
    const r=await f.db.insert('Reminders',{id:randomUUID(),customerId:c.id,...reminder(),active:true,revision:1});
    const o=await f.db.insert('Occurrences',{id:randomUUID(),reminderId:r.id,revision:1,originalAt:new Date(),scheduledAt:new Date(),notifyAt:new Date(Date.now()-1000),state:'pending',completedAt:null});
    const d=await f.db.insert('Devices',{id:randomUUID(),ownerId:session!.employeeId,sessionId:session!.id,pushToken:'test',enabled:true,endpoint:'https://fcm.googleapis.com/send/test',p256dh:'test',authKey:'test'});
    let sends=0;await runCycle(f.db,async(_d,payload)=>{sends++;assert.ok(!payload.includes(customer.name));});assert.equal(sends,1);assert.equal((await f.db.rows('Deliveries'))[0].state,'providerAccepted');
    await runCycle(f.db,async()=>{sends++;});assert.equal(sends,1);
    await f.db.remove('Deliveries','OccurrenceId=@id',{id:o.id});await f.db.update('Sessions',{expiresAt:new Date(Date.now()-1000)},'Id=@id',{id:session!.id});await runCycle(f.db,async()=>{sends++;});assert.equal(sends,1);assert.equal((await f.db.rows('Deliveries')).length,0);
  }finally{await f.close();}
});
