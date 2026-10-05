import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {createClient} from '@libsql/client';
import {CloudStore} from '../server/cloud-database.mjs';
import {Store} from '../server/database.mjs';
import {transferCloudToLocal,transferStatus} from '../server/cloud-transfer.mjs';
import {clearTransferredCloud} from '../server/cloud-cleanup.mjs';
import {createApp} from '../server/index.mjs';
import {passwordHash} from '../server/config.mjs';
const member={id:'STD001',name:'Test Student',role:'Student',status:'ACTIVE'},source='test.turso.io';
const tap=()=>({key:randomUUID(),client:randomUUID(),seq:1,id:'STD001',capturedAt:new Date().toISOString()});
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'gatekeeper-maintenance-')),destination=join(dir,'db.sqlite'),client=createClient({url:':memory:'}),cloud=new CloudStore(client);const closers=[];t.after(()=>{for(const close of closers)close();client.close();rmSync(dir,{recursive:true,force:true});});return {client,cloud,destination,closers};}
async function migrate(t){const f=fixture(t);await f.cloud.saveMembers([member]);await f.cloud.scans([tap()],'GUARD');await f.cloud.incident('STD001','Original incident');await transferCloudToLocal({...f,source});return f;}
test('automatic cleanup verifies backup, retains local history and retires cloud writes',async t=>{
  const f=await migrate(t),result=await clearTransferredCloud({...f,source});assert.equal(result.status,'complete');
  const local=new Store(f.destination),backup=new Store(result.backupPath);
  try{assert.equal(local.members().length,1);assert.equal(backup.visits().total,1);assert.equal(local.scans([tap()],'LOCAL')[0].row.direction,'OUT');assert.equal(local.status().transfer.cleanup.status,'complete');}finally{backup.close();local.close();}
  assert.deepEqual(await f.cloud.databaseSummary(),{members:0,events:0,visits:0,incidents:0,retired:true});
  assert.equal(Number((await f.client.execute('SELECT COUNT(*) n FROM scan_inbox')).rows[0].n),0);
  await assert.rejects(f.cloud.scans([tap()],'OLD GUARD'),/retired/);await assert.rejects(f.cloud.saveMembers([member]),/retired/);
  assert.equal((await clearTransferredCloud({destination:f.destination,source})).status,'complete');
});
test('new cloud records or an unverified local copy prevent cleanup',async t=>{
  const f=await migrate(t);await f.cloud.incident('STD001','New cloud incident');await assert.rejects(clearTransferredCloud({...f,source}),/changed after/);assert.equal((await f.cloud.members()).length,1);
  const second=await migrate(t),local=new Store(second.destination);local.saveMembers([{...member,name:'Modified local copy'}]);local.close();
  await assert.rejects(clearTransferredCloud({...second,source}),/no longer matches/);assert.equal((await second.cloud.members()).length,1);
  const empty=fixture(t);await assert.rejects(clearTransferredCloud({...empty,source}),/verified local transfer/);
});
test('failed cleanup transaction rolls back and retries remain safe after a lost commit response',async t=>{
  const f=await migrate(t);const failing={executeMultiple:f.client.executeMultiple.bind(f.client)};failing.transaction=async mode=>{const tx=await f.client.transaction(mode),batch=tx.batch.bind(tx);tx.batch=items=>batch([...items.slice(0,2),{sql:'INSERT INTO no_such_table VALUES(1)',args:[]},...items.slice(2)]);return tx;};
  await assert.rejects(clearTransferredCloud({...f,client:failing,source}));assert.equal((await f.cloud.members()).length,1);assert.equal((await f.cloud.visits()).total,1);
  const dropped={executeMultiple:f.client.executeMultiple.bind(f.client)};dropped.transaction=async mode=>{const tx=await f.client.transaction(mode),commit=tx.commit.bind(tx);tx.commit=async()=>{await commit();throw Error('Lost commit response');};return tx;};
  await assert.rejects(clearTransferredCloud({...f,client:dropped,source}),/Lost commit response/);
  assert.equal(await f.cloud.isRetired(),true);
  const local=new Store(f.destination);try{local.scans([tap()],'LOCAL');}finally{local.close();}
  assert.equal((await clearTransferredCloud({...f,source})).status,'complete');
});
for(const mode of ['cloud','local'])test(mode+' manual clear stays paused, is idempotent and keeps settings',async t=>{
  const f=fixture(t),store=mode==='cloud'?f.cloud:new Store(f.destination);if(mode==='local')f.closers.push(()=>store.close());
  await store.saveMembers([member]);const options={actor:'ADMIN',operationId:randomUUID()};
  await assert.rejects(store.clearDatabase(options),/Pause/);await store.setCheckpoint(true,'ADMIN');
  const result=await store.clearDatabase(options);assert.equal(result.cleared,true);assert.equal(await store.getLocked(),true);
  assert.deepEqual(await store.databaseSummary(),{members:0,events:0,visits:0,incidents:0,retired:false});
  if(mode==='local'){const backup=new Store(result.backupPath);try{assert.equal(backup.members().length,1);}finally{backup.close();}}
  await store.saveMembers([member]);assert.deepEqual(await store.clearDatabase(options),result);assert.equal((await store.members()).length,1);
});
test('clear API requires admin, current password and explicit target confirmation',async t=>{
  const f=fixture(t);await f.cloud.saveMembers([member]);await f.cloud.setCheckpoint(true,'ADMIN');
  const config={mode:'cloud',users:[{id:'ADMIN',role:'admin',hash:passwordHash('administrator-test-password')},{id:'GUARD',role:'guard',hash:passwordHash('guard-test-password')}]};
  const server=createApp({store:f.cloud,config});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const url='http://127.0.0.1:'+server.address().port;let cookie='';
  const post=(path,body)=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
  const request={confirmation:'CLEAR CLOUD DATABASE',password:'administrator-test-password',operationId:randomUUID()};
  assert.equal((await post('/api/database/clear',request)).status,401);
  let login=await post('/api/login',{id:'GUARD',password:'guard-test-password'});cookie=login.headers.get('set-cookie').split(';')[0];assert.equal((await post('/api/database/clear',request)).status,403);
  login=await post('/api/login',{id:'ADMIN',password:request.password});cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await post('/api/database/clear',{...request,password:'wrong'})).status,403);assert.equal((await post('/api/database/clear',{...request,confirmation:'CLEAR LOCAL DATABASE'})).status,400);
  assert.equal((await f.cloud.members()).length,1);assert.equal((await post('/api/database/clear',request)).status,200);
  assert.equal((await f.cloud.members()).length,0);assert.equal((await fetch(url+'/api/members',{headers:{Cookie:cookie}})).status,401);
});
