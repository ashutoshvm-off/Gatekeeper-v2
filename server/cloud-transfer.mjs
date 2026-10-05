import {Store} from './database.mjs';
import {CloudStore} from './cloud-database.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {join,dirname} from 'node:path';
import {rmSync} from 'node:fs';

const tables={
  members:['id','barcode','data'],
  events:['seq','key','client','client_seq','captured_at','received_at','member_id','direction','result'],
  visits:['key','id','name','department','role','checkInDate','checkInTime','checkOutDate','checkOutTime','attemptDate','attemptTime','status','reason','updated'],
  incidents:['key','data'],settings:['key','value']
};
const userTables=['members','events','visits','incidents'];
export function transferStatus(store){
  const saved=store.db.prepare("SELECT value FROM settings WHERE key='cloud_transfer'").get();
  return saved?JSON.parse(saved.value):null;
}
const signature=(row,columns)=>JSON.stringify(columns.map(c=>row[c]))+'\n';
function verifyTable(db,table,columns){
  const hash=createHash('sha256');let count=0;
  for(const row of db.prepare(`SELECT ${columns.join(',')} FROM ${table} ORDER BY ${columns[0]}`).iterate()){hash.update(signature(row,columns));count++;}
  return {count,sha256:hash.digest('hex')};
}
export function verifyTransferCopy(db,report){
  for(const table of userTables){const actual=verifyTable(db,table,tables[table]),expected=report.tables[table];if(actual.count!==expected.count||actual.sha256!==expected.sha256)throw Error('Verified local copy no longer matches the transferred '+table+'. Cloud data was retained.');}
}
function ensureEmpty(store){
  for(const table of userTables)if(store.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n)throw Error('The local database already contains records. Automatic transfer will not overwrite them. Back up and reconcile this database before migration.');
}
export async function transferCloudToLocal({client,destination,source='Turso',onProgress=()=>{}}){
  const local=new Store(destination);let staging,attached=false;
  const stagePath=join(dirname(destination),`transfer-${randomUUID()}.sqlite`);
  try{
    const saved=transferStatus(local);if(saved)return {alreadyImported:true,...saved};
    ensureEmpty(local);
    if(!client)throw Error('Cloud database credentials are required for the first local transfer.');
    const cloud=new CloudStore(client);await cloud.ready();
    const revision=async()=>String((await client.execute("SELECT value FROM settings WHERE key='data_revision'")).rows[0].value);
    const initialRevision=await revision();
    staging=new Store(stagePath);staging.db.exec('DELETE FROM settings');
    const checked={};
    for(const [table,columns] of Object.entries(tables)){
      const hash=createHash('sha256');let count=0,cursor=null;
      const insert=staging.db.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`);
      while(true){
        const result=await client.execute({sql:`SELECT ${columns.join(',')} FROM ${table}${cursor===null?'':` WHERE ${columns[0]}>?`} ORDER BY ${columns[0]} LIMIT 500`,args:cursor===null?[]:[cursor]});
        if(!result.rows.length)break;
        staging.transaction(()=>{for(const row of result.rows){const values=columns.map(c=>row[c]);insert.run(...values);hash.update(signature(row,columns));count++;}});
        cursor=result.rows.at(-1)[columns[0]];onProgress({table,count});
      }
      const expected={count,sha256:hash.digest('hex')},actual=verifyTable(staging.db,table,columns);
      if(actual.count!==expected.count||actual.sha256!==expected.sha256)throw Error(`Transfer verification failed for ${table}. Local data unchanged.`);
      checked[table]=actual;
    }
    if(await revision()!==initialRevision)throw Error('Cloud data changed during transfer. Stop imports/scanners, let pending queues finish, then rerun setup. Local data is unchanged.');
    if(!checked.members.count)throw Error('The cloud registry is empty. Upload your student/staff records before installing the local database.');
    const integrity=staging.db.prepare('PRAGMA integrity_check').get();
    if(Object.values(integrity)[0]!=='ok')throw Error('Downloaded database failed its integrity check.');
    staging.close();staging=null;
    local.db.prepare('ATTACH DATABASE ? AS transfer_source').run(stagePath);attached=true;
    const report={completedAt:new Date().toISOString(),source,revision:initialRevision,tables:checked};
    local.transaction(()=>{
      // Recheck under the write lock so a concurrent local writer cannot be lost.
      ensureEmpty(local);
      if(transferStatus(local))throw Error('Another transfer completed. Rerun setup to use that copy.');
      local.db.exec('DELETE FROM settings');
      for(const [table,columns] of Object.entries(tables)){
        local.db.exec(`INSERT INTO main.${table}(${columns.join(',')}) SELECT ${columns.join(',')} FROM transfer_source.${table}`);
        const actual=verifyTable(local.db,table,columns);
        if(actual.count!==checked[table].count||actual.sha256!==checked[table].sha256)throw Error(`Final database verification failed for ${table}.`);
      }
      local.db.prepare('INSERT INTO settings VALUES(?,?)').run('cloud_transfer',JSON.stringify(report));
    });
    return {alreadyImported:false,...report};
  }finally{
    if(attached)local.db.exec('DETACH DATABASE transfer_source');
    staging?.close();local.close();
    // Only the unique temporary files created by this invocation are removed.
    for(const suffix of ['','-wal','-shm'])rmSync(stagePath+suffix,{force:true});
  }
}
