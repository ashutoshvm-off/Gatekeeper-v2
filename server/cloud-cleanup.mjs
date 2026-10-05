import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {Store} from './database.mjs';
import {CloudStore} from './cloud-database.mjs';
import {transferStatus,verifyTransferCopy} from './cloud-transfer.mjs';
import {dataTables,setting} from './cloud-maintenance.mjs';

export async function clearTransferredCloud({client,destination,source}){
  const local=new Store(destination);let tx;
  const save=report=>local.db.prepare("UPDATE settings SET value=? WHERE key='cloud_transfer'").run(JSON.stringify(report));
  try{
    const report=transferStatus(local);
    if(!report)throw Error('A verified local transfer is required before clearing Turso.');
    if(report.cleanup?.status==='complete')return report.cleanup;
    if(source!==report.source)throw Error('Cloud source does not match the verified transfer. Nothing was deleted.');
    if(!report.cleanup?.backupPath){
      verifyTransferCopy(local.db,report);
      const backupPath=await local.backup();
      report.cleanup={status:'pending',backupPath};save(report);
    }
    // The original snapshot remains verifiable even after new local activity.
    const backup=new DatabaseSync(report.cleanup.backupPath,{readOnly:true});
    try{verifyTransferCopy(backup,report);if(Object.values(backup.prepare('PRAGMA integrity_check').get())[0]!=='ok')throw Error('The transfer backup failed its integrity check.');}finally{backup.close();}
    if(!client)throw Error('Internet and Turso credentials are needed to complete cloud cleanup.');
    const cloud=new CloudStore(client);await cloud.ready();
    const id=createHash('sha256').update(JSON.stringify([report.source,report.completedAt,report.revision,report.tables])).digest('hex');
    tx=await client.transaction('write');
    const prior=await setting(tx,'cloud_retired');let retirement;
    if(prior){
      retirement=JSON.parse(prior);
      if(retirement.transferId!==id)throw Error('Turso was retired by a different transfer. Nothing was deleted.');
      await tx.rollback();
    }else{
      if(await setting(tx,'data_revision')!==report.revision)throw Error('Turso changed after the verified copy. Cloud data was retained; reconcile the newer records before clearing it.');
      retirement={transferId:id,completedAt:new Date().toISOString()};
      await tx.batch([
        ...dataTables.map(table=>({sql:`DELETE FROM ${table}`,args:[]})),
        {sql:"UPDATE settings SET value='true' WHERE key='locked'",args:[]},
        {sql:"INSERT INTO settings(key,value) VALUES('cloud_retired',?)",args:[JSON.stringify(retirement)]}
      ]);
      await tx.commit();
    }
    report.cleanup={...report.cleanup,status:'complete',completedAt:retirement.completedAt};save(report);
    return report.cleanup;
  }finally{tx?.close();local.close();}
}
