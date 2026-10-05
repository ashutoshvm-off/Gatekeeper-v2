import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {createClient} from '@libsql/client';
import {CloudStore} from '../server/cloud-database.mjs';
import {Store} from '../server/database.mjs';
import {transferCloudToLocal} from '../server/cloud-transfer.mjs';
const member={id:'STD001',name:'Transfer Student',role:'Student',status:'ACTIVE',department:'CS'};
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'gatekeeper-transfer-')),destination=join(dir,'local.sqlite');const client=createClient({url:':memory:'});const cloud=new CloudStore(client);t.after(()=>{client.close();rmSync(dir,{recursive:true,force:true});});return {client,cloud,destination};}
function taps(n){const client=randomUUID();return Array.from({length:n},(_,i)=>({key:randomUUID(),client,seq:i+1,id:'STD001',capturedAt:new Date(Date.UTC(2026,0,1,17,0,i)).toISOString()}));}
test('33,000 members and all cloud history transfer, preserving open visit and retry IDs',async t=>{
  const {client,cloud,destination}=fixture(t);
  await cloud.saveMembers([member]);
  for(let i=1;i<33000;i+=500)await cloud.saveMembers(Array.from({length:Math.min(500,33000-i)},(_,j)=>({...member,id:`MEM${i+j}`,name:`Student ${i+j}`})));
  const items=taps(3);const results=await cloud.scans(items,'GUARD');await cloud.incident('STD001','Transfer incident');
  const report=await transferCloudToLocal({client,destination});assert.equal(report.tables.members.count,33000);assert.equal(report.tables.events.count,3);assert.equal(report.tables.visits.count,2);assert.equal(report.tables.incidents.count,1);
  const local=new Store(destination);
  try{
    assert.equal(local.members().length,33000);assert.equal(local.visits().total,2);assert.equal(local.incidents()[0].reason,'Transfer incident');
    assert.deepEqual(local.scans(items,'GUARD'),results);
    const next={...items[2],key:randomUUID(),seq:4};assert.equal(local.scans([next],'GUARD')[0].row.direction,'OUT');
    assert.equal(local.status().transfer.counts.members,33000);
  }finally{local.close();}
  const again=await transferCloudToLocal({destination});assert.equal(again.alreadyImported,true);
  const reopened=new Store(destination);try{assert.equal(reopened.db.prepare('SELECT COUNT(*) AS n FROM events').get().n,4);}finally{reopened.close();}
});
test('interrupted transfer does not expose partial local data and can be retried',async t=>{
  const {client,cloud,destination}=fixture(t);await cloud.saveMembers([member]);
  await assert.rejects(transferCloudToLocal({client,destination,onProgress:()=>{throw Error('Simulated interruption');}}),/interruption/);
  const local=new Store(destination);try{assert.equal(local.members().length,0);assert.equal(local.status().transfer,null);}finally{local.close();}
  assert.equal((await transferCloudToLocal({client,destination})).tables.members.count,1);
});
test('concurrent cloud changes are detected without committing a mixed snapshot',async t=>{
  const {client,cloud,destination}=fixture(t);await cloud.saveMembers([member]);
  let changed=false;
  const source={executeMultiple:sql=>client.executeMultiple(sql),execute:async query=>{
    const result=await client.execute(query);
    if(typeof query==='object'&&query.sql.startsWith('SELECT id,barcode,data')&&!changed){changed=true;await cloud.saveMembers([{...member,name:'Changed during transfer'}]);}
    return result;
  }};
  await assert.rejects(transferCloudToLocal({client:source,destination}),/Cloud data changed/);
  const local=new Store(destination);try{assert.equal(local.members().length,0);}finally{local.close();}
});
test('existing local data and an empty cloud registry are protected',async t=>{
  const {client,cloud,destination}=fixture(t);
  await cloud.ready();await assert.rejects(transferCloudToLocal({client,destination}),/registry is empty/);
  const local=new Store(destination);local.saveMembers([member]);local.close();
  await assert.rejects(transferCloudToLocal({client,destination}),/already contains records/);
});
