export const dataTables=['scan_inbox','visits','events','members','incidents'];
export const retirementMessage='Turso was cleared after a verified local transfer. Use the installed local website.';
// Guards also protect against older running app instances repopulating Turso.
export const retirementGuards=['members','events','visits','incidents','scan_inbox'].flatMap(table=>['INSERT','UPDATE','DELETE'].map(action=>
  `CREATE TRIGGER IF NOT EXISTS retired_${table}_${action.toLowerCase()} BEFORE ${action} ON ${table}
   WHEN EXISTS(SELECT 1 FROM settings WHERE key='cloud_retired')
   BEGIN SELECT RAISE(ABORT,'Gatekeeper cloud retired after local transfer'); END;`
)).join('\n');
export async function setting(transaction,key){const r=await transaction.execute({sql:'SELECT value FROM settings WHERE key=?',args:[key]});return r.rows[0]?.value;}
export async function clearCloudDatabase(client,{actor,operationId}){
  const tx=await client.transaction('write');
  try{
    if(await setting(tx,'cloud_retired'))throw Error(retirementMessage);
    const prior=await setting(tx,'last_database_clear');
    if(prior&&JSON.parse(prior).operationId===operationId){await tx.rollback();return JSON.parse(prior);}
    if(await setting(tx,'locked')!=='true')throw Error('Pause the checkpoint and finish all pending queues before clearing the database.');
    const report={cleared:true,operationId,actor,completedAt:new Date().toISOString(),backupPath:null};
    await tx.batch([...dataTables.map(table=>({sql:`DELETE FROM ${table}`,args:[]})),{sql:"INSERT INTO settings(key,value) VALUES('last_database_clear',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",args:[JSON.stringify(report)]}]);
    await tx.commit();return report;
  }finally{tx.close();}
}
