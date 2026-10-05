import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createClient} from '@libsql/client';
import {Store} from '../server/database.mjs';
import {CloudStore} from '../server/cloud-database.mjs';
import {createApp} from '../server/index.mjs';
import {passwordHash} from '../server/config.mjs';
const member={id:'STD001',name:'Original Student',barcode:'CARD001',department:'CS',role:'Student',status:'ACTIVE'};
const tap=()=>({key:randomUUID(),client:randomUUID(),seq:1,id:'CARD001',capturedAt:new Date().toISOString()});
function fixture(t,cloud){
  if(cloud){const store=new CloudStore(createClient({url:':memory:'}));t.after(()=>store.close());return store;}
  const dir=mkdtempSync(join(tmpdir(),'gatekeeper-members-')),store=new Store(join(dir,'db.sqlite'));
  t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});return store;
}
for(const cloud of [false,true])test((cloud?'Turso':'SQLite')+' member edits and deletions preserve audit history and block checked-in deletion',async t=>{
  const store=fixture(t,cloud);await store.saveMembers([member]);const entered=tap();await store.scans([entered],'GUARD');
  await assert.rejects(async()=>store.deleteMember(member.id,'ADMIN'),/currently checked in/);
  assert.equal((await store.members()).length,1);assert.equal((await store.incidents()).length,0);
  await store.scans([tap()],'GUARD');
  await store.saveMembers([{...member,name:'Edited Student',department:'IT'}]);
  assert.equal((await store.members())[0].name,'Edited Student');assert.equal((await store.visits()).rows[0].name,'Original Student');
  const history=await store.visits();await store.incident(member.id,'Prior incident');
  assert.deepEqual(await store.deleteMember(member.id,'ADMIN'),{deleted:true});
  assert.equal((await store.members()).length,0);assert.deepEqual(await store.visits(),history);
  assert.equal((await store.incidents()).length,2);
  assert.deepEqual(await store.deleteMember(member.id,'ADMIN'),{deleted:false});assert.equal((await store.incidents()).length,2);
  assert.equal((await store.scans([tap()],'GUARD'))[0].row.direction,'DENIED');
  await assert.rejects(async()=>store.deleteMember('', 'ADMIN'),/Invalid member ID/);
});
test('member deletion API permits only an unlocked administrator',async t=>{
  const store=fixture(t,true);await store.saveMembers([member]);
  const config={mode:'cloud',users:[{id:'ADMIN',role:'admin',hash:passwordHash('test-admin-password')},{id:'GUARD',role:'guard',hash:passwordHash('test-guard-password')}]};
  const server=createApp({store,config});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const url='http://127.0.0.1:'+server.address().port;let cookie='';
  const post=(path,data)=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(data)});
  assert.equal((await post('/api/members/delete',{id:member.id})).status,401);
  for(const role of ['GUARD','ADMIN']){
    const login=await post('/api/login',{id:role,password:role==='GUARD'?'test-guard-password':'test-admin-password'});cookie=login.headers.get('set-cookie').split(';')[0];
    assert.equal((await post('/api/members/delete',{id:member.id})).status,role==='GUARD'?403:200);
  }
  await post('/api/session/lock',{});assert.equal((await post('/api/members/delete',{id:member.id})).status,403);
});

for(const cloud of [false,true])test((cloud?'Turso':'SQLite')+' preserves spaced IDs during import, scans, editing and deletion',async t=>{
  const store=fixture(t,cloud),id='T26MTECH CSE001 - 59490';
  await store.saveMembers([{...member,id,barcode:id}]);assert.equal((await store.members())[0].id,id);
  await store.saveMembers([{...member,id:'T26MTECHCSE001-59490',barcode:'T26MTECHCSE001-59490'}]);
  assert.equal((await store.members()).length,2);
  const entry=await store.scans([{...tap(),id}],'GUARD');assert.equal(entry[0].person.id,id);assert.equal(entry[0].row.direction,'IN');
  await store.scans([{...tap(),id}],'GUARD');
  await store.saveMembers([{...member,id,barcode:id,name:'Updated name'}]);assert.equal((await store.members()).find(r=>r.id===id).name,'Updated name');
  assert.deepEqual(await store.deleteMember(id,'ADMIN'),{deleted:true});assert.equal((await store.visits()).rows[0].id,id);assert.equal((await store.members()).length,1);
});
