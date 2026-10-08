import { randomUUID } from 'node:crypto';
import type { Database } from './db.js';
import { hashPassword } from './auth.js';
import { searchText } from './validation.js';
import { addReminder } from './care.js';
import { DateTime } from 'luxon';

export async function initializeReview(db: Database) {
  for (let i=1; i<=2; i++) {
    const email = i === 1 ? 'review@clientstudio.local' : 'review2@clientstudio.local';
    if (await db.one('Employees','Email=@email',{email})) continue;
    await db.transaction(async tx => {
      const owner = await tx.insert('Employees',{id:randomUUID(),email,displayName:'Không gian Review',phone:'',enabled:true,passwordHash:await hashPassword('Review123!')});
      const names = i === 1 ? ['Nguyễn Minh Anh','Trần Hoàng Nam','Đỗ Khánh Linh','Phạm Quốc Huy','Lê Ngọc Hà','Vũ Anh Tuấn'] : ['Lê Quang Huy'];
      for (let index=0; index<names.length; index++) {
        const name = `${names[index]} · Mẫu`; const phone = `09000000${i}${index}`;
        const customer = await tx.insert('Customers',{id:randomUUID(),ownerId:owner.id,name,phone,birthDate:'1990-10-20',interests:'Golf, du lịch',notes:'Dữ liệu hư cấu để trải nghiệm.',preferredContact:'Gọi điện buổi chiều',status:['purchased','consulting','new'][index%3],avatarId:null,updatedAt:new Date(),searchText:searchText(`${name} ${phone} Mercedes-Benz C 200 MẪU-001`)});
        await tx.insert('Vehicles',{id:randomUUID(),customerId:customer.id,model:'Mercedes-Benz C 200',plate:'MẪU-001',deliveryDate:null});
        await tx.insert('Contacts',{id:randomUUID(),customerId:customer.id,at:new Date(Date.now()-86400000),channel:'call',content:'Bản ghi chăm sóc mẫu.',occurrenceId:null});
        await addReminder(tx,customer.id,{kind:'afterPurchase',content:'Hỏi thăm trải nghiệm sử dụng xe',localDateTime:DateTime.now().setZone('Asia/Ho_Chi_Minh').plus({days:2}).toFormat("yyyy-MM-dd'T'HH:mm:ss"),timeZone:'Asia/Ho_Chi_Minh',repeat:'once',leadDays:0,leapDayPolicy:null});
      }
    });
  }
}
