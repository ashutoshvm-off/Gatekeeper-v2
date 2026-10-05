import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from '../server/database.mjs';
import {createApp} from '../server/index.mjs';
import {passwordHash} from '../server/config.mjs';
const member={id:'STD001',barcode:'CARD001',name:'Test Student',role:'Student',department:'CS',status:'ACTIVE'};
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'gatekeeper-test-'));const store=new Store(join(dir,'test.sqlite'));t.after(()=>{try{store.close();}catch{}rmSync(dir,{recursive:true,force:true});});return {store,dir};}
function taps(count,client=randomUUID(),offset=0,id='STD001'){return Array.from({length:count},(_,i)=>({key:randomUUID(),client,seq:i+offset+1,id,capturedAt:new Date(Date.UTC(2026,0,1,12,0,i+offset)).toISOString()}));}
test('33,000 members and 1,000 fast taps remain ordered and paired',t=>{
  const {store}=fixture(t);
  for(let i=0;i<33000;i+=1000)store.saveMembers(Array.from({length:1000},(_,j)=>({...member,id:`STD${i+j}`,barcode:`CARD${i+j}`})));
  assert.equal(store.members().length,33000);
  const events=taps(1000,undefined,0,'STD0');const results=[];
  for(let i=0;i<events.length;i+=25)results.push(...store.scans(events.slice(i,i+25),'GUARD'));
  assert.ok(results.every((r,i)=>r.row.direction===(i%2?'OUT':'IN')));
  assert.equal(store.visits().total,500);assert.ok(store.visits().rows.every(r=>r.status==='Checked out'));
});
test('lost acknowledgement retries survive database restart without duplicates',t=>{
  const {store,dir}=fixture(t);store.saveMembers([member]);const items=taps(4);const first=store.scans(items,'GUARD');store.close();
  const reopened=new Store(join(dir,'test.sqlite'));
  try{assert.deepEqual(reopened.scans(items,'GUARD2'),first);assert.equal(reopened.visits().total,2);assert.equal(reopened.db.prepare('SELECT COUNT(*) AS n FROM events').get().n,4);}finally{reopened.close();}
});
test('failed batch rolls back every tap and preserves order',t=>{
  const {store}=fixture(t);store.saveMembers([member]);const items=taps(2);items[1].seq=items[0].seq;
  assert.throws(()=>store.scans(items,'GUARD'),/conflict/);assert.equal(store.visits().total,0);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM events').get().n,0);
});
test('denied taps do not toggle visits, checkpoint pause persists, dates pair overnight',t=>{
  const {store}=fixture(t);store.saveMembers([member]);const items=taps(3);
  items[0].capturedAt='2026-01-01T18:00:00Z';items[1].capturedAt='2026-01-01T18:31:00Z';items[2].capturedAt='2026-01-01T19:00:00Z';
  assert.equal(store.scans([items[0]],'GUARD')[0].row.direction,'IN');store.locked=true;
  assert.equal(store.scans([items[1]],'GUARD')[0].row.direction,'DENIED');store.locked=false;
  assert.equal(store.scans([items[2]],'GUARD')[0].row.direction,'OUT');
  assert.equal(store.visits({date:'2026-01-02',status:'Checked out'}).total,1);
});
test('barcode collisions abort import, backups contain committed scans',async t=>{
  const {store}=fixture(t);store.saveMembers([member]);assert.throws(()=>store.saveMembers([{...member,id:'STD002'}]));
  store.scans(taps(2),'GUARD');const backup=new Store(await store.backup());try{assert.equal(backup.visits().total,1);}finally{backup.close();}
});
test('API requires real authentication, denies guard administration and cross-origin writes',async t=>{
  const {store}=fixture(t);const config={users:[{id:'GUARD',role:'guard',hash:passwordHash('guard-test-password')},{id:'ADMIN',role:'admin',hash:passwordHash('admin-test-password')}]};
  const server=createApp({store,config});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}`;
  const post=(path,data,cookie='',origin=url)=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,Origin:origin},body:JSON.stringify(data)});
  try{
    const anonymous=await fetch(url+'/api/session');assert.equal(anonymous.status,200);assert.equal(await anonymous.json(),null);
    const expired=await fetch(url+'/api/session',{headers:{Cookie:'gatekeeper=deadbeef'}});assert.equal(expired.status,200);assert.equal(await expired.json(),null);
    assert.equal((await fetch(url+'/api/members')).status,401);
    assert.equal((await post('/api/login',{id:'GUARD',password:'bad'})).status,401);
    const login=await post('/api/login',{id:'GUARD',password:'guard-test-password'}),cookie=login.headers.get('set-cookie').split(';')[0];
    assert.equal(login.status,200);assert.equal((await post('/api/members',{rows:[member]},cookie)).status,403);
    assert.equal((await post('/api/scans',{items:taps(1)},cookie,'https://evil.example')).status,403);
    assert.equal((await post('/api/scans',{items:taps(1)},cookie)).status,200);
    const admin=await post('/api/login',{id:'ADMIN',password:'admin-test-password'}),adminCookie=admin.headers.get('set-cookie').split(';')[0];
    assert.equal((await post('/api/members',{rows:[member]},adminCookie)).status,200);
    assert.equal((await post('/api/session/lock',{},adminCookie)).status,200);
    assert.equal((await post('/api/checkpoint',{locked:true},adminCookie)).status,403);
  }finally{await new Promise(r=>server.close(r));}
});
