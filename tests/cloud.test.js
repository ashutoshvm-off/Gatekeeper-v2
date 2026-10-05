import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@libsql/client';
import {CloudStore} from '../server/cloud-database.mjs';
import {cloudConfiguration,UnconfiguredStore} from '../server/runtime.mjs';
import {createApp} from '../server/index.mjs';
import {passwordHash} from '../server/config.mjs';
const member={id:'STD001',name:'Cloud Student',barcode:'CARD001',role:'Student',status:'ACTIVE',department:'CS'};
const taps=(n,client=randomUUID(),offset=0)=>Array.from({length:n},(_,i)=>({key:randomUUID(),client,seq:offset+i+1,id:'CARD001',capturedAt:new Date(Date.UTC(2026,0,1,18,29,i)).toISOString()}));
function fixture(t){const client=createClient({url:':memory:'});const store=new CloudStore(client);t.after(()=>store.close());return store;}
test('cloud SQL batches keep order, pair visits and deduplicate retries',async t=>{
  const store=fixture(t);await store.saveMembers([member]);const items=taps(25);
  const results=await store.scans(items,'GUARD');assert.ok(results.every((r,i)=>r.row.direction===(i%2?'OUT':'IN')));
  assert.deepEqual(await store.scans(items,'OTHER'),results);assert.equal((await store.visits()).total,13);
  assert.equal((await store.visits({status:'Checked out'})).total,12);
  assert.equal((await store.members())[0].name,'Cloud Student');
});
test('cloud duplicate conflicts roll back new taps in the same batch',async t=>{
  const store=fixture(t);await store.saveMembers([member]);const items=taps(2);await store.scans([items[0]],'GUARD');
  await assert.rejects(store.scans([items[1],{...items[0],id:'OTHER'}],'GUARD'));
  assert.equal(Number((await store.client.execute('SELECT COUNT(*) AS n FROM events')).rows[0].n),1);
  const retry=await store.scans([items[1]],'GUARD');assert.equal(retry[0].row.direction,'OUT');
});
test('cloud checkpoint and denied attempts preserve IN/OUT state',async t=>{
  const store=fixture(t);await store.saveMembers([member]);const items=taps(3);
  assert.equal((await store.scans([items[0]],'GUARD'))[0].row.direction,'IN');
  await store.setCheckpoint(true,'ADMIN');assert.equal(await store.getLocked(),true);
  assert.equal((await store.scans([items[1]],'GUARD'))[0].row.direction,'DENIED');
  await store.setCheckpoint(false,'ADMIN');assert.equal((await store.scans([items[2]],'GUARD'))[0].row.direction,'OUT');
  assert.equal((await store.incidents()).length,2);
  await assert.rejects(store.saveMembers([{...member,id:'OTHER'}]));
});
test('cloud configuration never falls back to demo credentials or local storage',async t=>{
  const result=cloudConfiguration({});assert.match(result.error,/Cloud setup required/);
  const store=new UnconfiguredStore(result.error);assert.equal(store.status().database.status,'disconnected');
  const server=createApp({store,config:{users:[],mode:'cloud'}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}`;
  try{const config=await (await fetch(url+'/api/config')).json();assert.equal(config.setupRequired,true);
    const login=await fetch(url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'SEC-G1-204',password:'gatekeeper'})});assert.equal(login.status,503);
  }finally{await new Promise(r=>server.close(r));}
});
test('HTTP API awaits cloud reads/writes and returns usable registry and log data',async t=>{
  const store=fixture(t);const config={mode:'cloud',users:[{id:'ADMIN',role:'admin',hash:passwordHash('cloud-test-password')}]};
  const server=createApp({store,config});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;let cookie='';
  const post=(path,data)=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(data)});
  try{
    const login=await post('/api/login',{id:'ADMIN',password:'cloud-test-password'});cookie=login.headers.get('set-cookie').split(';')[0];
    assert.equal((await (await post('/api/members',{rows:[member]})).json()).saved,1);
    const members=await (await fetch(url+'/api/members',{headers:{Cookie:cookie}})).json();assert.equal(members[0].name,'Cloud Student');
    const scanned=await (await post('/api/scans',{items:taps(2)})).json();assert.deepEqual(scanned.results.map(r=>r.row.direction),['IN','OUT']);
    const visits=await (await fetch(url+'/api/visits',{headers:{Cookie:cookie}})).json();assert.equal(visits.total,1);
    assert.equal((await (await post('/api/checkpoint',{locked:true})).json()).locked,true);
    const state=await (await fetch(url+'/api/state',{headers:{Cookie:cookie}})).json();assert.equal(state.locked,true);
  }finally{await new Promise(r=>server.close(r));}
});
