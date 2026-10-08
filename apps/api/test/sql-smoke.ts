// Explicit SQL Server integration check. All test writes are rolled back.
import { readConfig } from '../src/config.js';
import { Database } from '../src/db.js';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const config=readConfig();if(config.review)throw new Error('Use SQL Server mode.');
const db=await Database.connect(config);const rollback=new Error('ROLLBACK_SMOKE');
try{
  await db.check();
  try{await db.transaction(async tx=>{
    const owner=randomUUID(),session=randomUUID(),customer=randomUUID(),reminder=randomUUID(),occurrence=randomUUID(),device=randomUUID();
    await tx.insert('Employees',{id:owner,email:`smoke-${owner}@example.invalid`,displayName:'Kiểm tra Node.js',phone:'',enabled:false,passwordHash:'not-a-login'});
    await tx.insert('Sessions',{id:session,employeeId:owner,tokenHash:randomUUID().replace(/-/g,'').toUpperCase(),expiresAt:new Date(Date.now()+60000)});
    const row=await tx.insert('Customers',{id:customer,ownerId:owner,name:'Đỗ Khánh Linh · Kiểm tra',phone:'0900000000',birthDate:'1990-01-01',interests:'',notes:'Giao dịch sẽ rollback',preferredContact:'',status:'new',avatarId:null,updatedAt:new Date(),searchText:'do khanh linh'});
    assert.equal(row.id,customer);assert.equal(row.birthDate,'1990-01-01');assert.equal(row.name,'Đỗ Khánh Linh · Kiểm tra');assert.ok(Number.isFinite(Date.parse(row.updatedAt)));
    await tx.insert('Vehicles',{id:randomUUID(),customerId:customer,model:'Test',plate:'TEST',deliveryDate:null});
    await tx.insert('Reminders',{id:reminder,customerId:customer,kind:'other',content:'Test',localDateTime:'2030-01-01T09:00:00',timeZone:'Asia/Ho_Chi_Minh',repeat:'once',leadDays:0,leapDayPolicy:null,active:true,revision:1});
    const o=await tx.insert('Occurrences',{id:occurrence,reminderId:reminder,revision:1,originalAt:new Date(),scheduledAt:new Date(),notifyAt:new Date(),state:'pending',completedAt:null});assert.ok(o.rowVersion);
    await tx.insert('Contacts',{id:randomUUID(),customerId:customer,at:new Date(),channel:'call',content:'Test',occurrenceId:occurrence});
    await tx.insert('Photos',{id:randomUUID(),customerId:customer,fileName:'never-written.png',contentType:'image/png',caption:'Test',isAvatar:false,createdAt:new Date()});
    await tx.insert('Devices',{id:device,ownerId:owner,sessionId:session,pushToken:randomUUID(),endpoint:null,p256dh:null,authKey:null,enabled:false});
    await tx.insert('Deliveries',{id:randomUUID(),occurrenceId:occurrence,deviceId:device,state:'pending',attempts:0,retryAt:new Date(),leaseUntil:null,receiptId:null});
    assert.equal(await tx.update('Occurrences',{state:'completed',completedAt:new Date()},'Id=@id AND State=@state',{id:occurrence,state:'pending'}),1);
    assert.equal(await tx.update('Occurrences',{state:'completed'},'Id=@id AND State=@state',{id:occurrence,state:'pending'}),0);
    throw rollback;
  });}catch(error){if(error!==rollback)throw error;}
  console.log('SQL Server read/write, date types, Unicode and conditional updates verified; all smoke-test writes rolled back.');
}finally{await db.close();}
