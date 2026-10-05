import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createClient} from '@libsql/client';
import {Store} from '../server/database.mjs';
import {CloudStore} from '../server/cloud-database.mjs';
import {parseHistory,historyTimestamp,guessHistoryMapping} from '../server/history-format.mjs';
import {transferCloudToLocal} from '../server/cloud-transfer.mjs';
import {createApp} from '../server/index.mjs';
import {passwordHash} from '../server/config.mjs';
const visit={id:'STD001',name:'Historical Student',role:'Student',checkIn:'2025-06-01T03:30:00.000Z',checkOut:'2025-06-01T10:30:00.000Z'};
function localFixture(t){const dir=mkdtempSync(join(tmpdir(),'gatekeeper-history-'));const store=new Store(join(dir,'test.sqlite'));t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});return store;}
function cloudFixture(t){const store=new CloudStore(createClient({url:':memory:'}));t.after(()=>store.close());return store;}
test('history dates handle explicit date order, IST, offsets, Excel and invalid values',()=>{
  assert.equal(historyTimestamp('01/06/2025','9:00 AM'),visit.checkIn);
  assert.equal(historyTimestamp('06/01/2025','09:00','MDY'),visit.checkIn);
  assert.equal(historyTimestamp('2025-06-01T09:00:00+05:30'),visit.checkIn);
  assert.equal(historyTimestamp(45809,0.375),visit.checkIn);
  for(const [date,time] of [['31/02/2025','09:00'],['01/06/25','09:00'],['2025-06-01','24:00'],['2025-06-01',''],['','09:00'],['2025-02-30T09:00:00Z','']])assert.throws(()=>historyTimestamp(date,time));
});
test('event imports sort and pair overnight history, retain missing/denied and reject unknown directions',()=>{
  const rows=[{ID:'std001',Date:'2025-06-02',Time:'01:00',Direction:'OUT'},{ID:'STD001',Date:'2025-06-01',Time:'23:00',Direction:'IN'},{ID:'STD001',Date:'2025-06-01',Time:'23:00',Direction:'IN'},{ID:'MISSING',Date:'2025-06-02',Time:'09:00',Direction:'IN'},{ID:'DENIED',Date:'2025-06-02',Time:'10:00',Direction:'DENIED'}];
  const mapping=guessHistoryMapping(Object.keys(rows[0]));const result=parseHistory(rows,mapping);
  assert.equal(result.errors.length,0);assert.equal(result.visits.length,3);
  const paired=result.visits.find(r=>r.id==='STD001');assert.equal(paired.status,'Checked out');assert.equal(paired.checkOut,'2025-06-01T19:30:00.000Z');
  assert.equal(result.visits.find(r=>r.id==='MISSING').status,'Missing check-out');
  const bad=parseHistory([{...rows[0],Direction:'something'}],mapping);assert.equal(bad.errors[0].row,2);
});
test('paired exports round-trip with blank timestamps and validation before import',()=>{
  const rows=[{id:'STD001',checkInDate:'2025-06-01',checkInTime:'09:00',checkOutDate:'2025-06-01',checkOutTime:'16:00',attemptDate:'',attemptTime:''}];
  const mapping=guessHistoryMapping(Object.keys(rows[0]));const result=parseHistory(rows,mapping,{mode:'visits'});
  assert.deepEqual(result.errors,[]);assert.equal(result.visits[0].checkIn,visit.checkIn);
  assert.equal(parseHistory([{...rows[0],checkOutDate:'2025-05-31'}],mapping,{mode:'visits'}).errors.length,1);
});
for(const [name,fixture] of [['SQLite',localFixture],['Turso adapter',cloudFixture]])test(`${name}: import retries are idempotent and history does not alter active occupancy`,async t=>{
  const store=fixture(t);await store.saveMembers([{id:'STD001',name:'Current Student',role:'Student',status:'ACTIVE'}]);
  const client=randomUUID(),tap={key:randomUUID(),client,seq:1,id:'STD001',capturedAt:'2026-01-01T09:00:00.000Z'};
  assert.equal((await store.scans([tap],'GUARD'))[0].row.direction,'IN');
  const rows=[visit,{...visit,checkOut:'',checkIn:'2025-05-01T03:30:00.000Z'},{id:'UNKNOWN',attempt:'2025-05-01T04:00:00.000Z',reason:'Old denied scan'}];
  assert.deepEqual(await store.importHistory(rows,'ADMIN'),{imported:3,duplicates:0});
  assert.deepEqual(await store.importHistory(rows,'ADMIN'),{imported:0,duplicates:3});
  assert.equal((await store.visits()).rows[0].status,'Checked in');
  assert.equal((await store.visits({date:'2025-06-01'})).rows[0].checkInTime,'09:00:00');
  assert.equal((await store.scans([{...tap,key:randomUUID(),seq:2}],'GUARD'))[0].row.direction,'OUT');
  await assert.rejects(async()=>store.importHistory([{...visit,id:'NEW'},{id:'INVALID',checkIn:'bad'}],'ADMIN'));
  assert.equal((await store.visits()).total,4);
});
test('imported events and visits migrate with cloud data and remain deduplicated locally',async t=>{
  const cloud=cloudFixture(t),dir=mkdtempSync(join(tmpdir(),'history-transfer-')),destination=join(dir,'local.sqlite');t.after(()=>rmSync(dir,{recursive:true,force:true}));
  await cloud.saveMembers([{id:'STD001',name:'Student'}]);await cloud.importHistory([visit],'ADMIN');
  const report=await transferCloudToLocal({client:cloud.client,destination});assert.equal(report.tables.events.count,2);assert.equal(report.tables.visits.count,1);
  const local=new Store(destination);try{assert.equal(local.visits().rows[0].checkOutTime,'16:00:00');assert.deepEqual(local.importHistory([visit],'ADMIN'),{imported:0,duplicates:1});}finally{local.close();}
});
test('log import endpoint requires unlocked administrator and validates batches',async t=>{
  const store=cloudFixture(t),config={mode:'cloud',users:[{id:'ADMIN',role:'admin',hash:passwordHash('test-password-admin')},{id:'GUARD',role:'guard',hash:passwordHash('test-password-guard')}]};
  const server=createApp({store,config});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const url=`http://127.0.0.1:${server.address().port}`;let cookie='';
  const post=(path,data)=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(data)});
  assert.equal((await post('/api/log-import',{rows:[visit]})).status,401);
  for(const role of ['GUARD','ADMIN']){
    const login=await post('/api/login',{id:role,password:role==='GUARD'?'test-password-guard':'test-password-admin'});cookie=login.headers.get('set-cookie').split(';')[0];
    assert.equal((await post('/api/log-import',{rows:[visit]})).status,role==='GUARD'?403:200);
  }
  assert.equal((await post('/api/log-import',{rows:[{id:'BAD'}]})).status,400);
  await post('/api/session/lock',{});assert.equal((await post('/api/log-import',{rows:[visit]})).status,403);
});
