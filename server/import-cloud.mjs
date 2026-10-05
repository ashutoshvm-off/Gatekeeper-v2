import {loadEnvFile} from 'node:process';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {dataDir} from './config.mjs';
import {Store} from './database.mjs';
import {transferCloudToLocal,transferStatus} from './cloud-transfer.mjs';
import {clearTransferredCloud} from './cloud-cleanup.mjs';
const destination=join(dataDir,'gatekeeper.sqlite');
let client,report;
try{
  const local=new Store(destination);try{report=transferStatus(local);}finally{local.close();}
  if(report?.cleanup?.status==='complete')console.log('Cloud transfer and cleanup already completed. Local data preserved.');
  else{
    try{
      const envPath=new URL('../.env.server',import.meta.url);if(existsSync(envPath))loadEnvFile(envPath);
      const url=process.env.TURSO_DATABASE_URL,token=process.env.TURSO_AUTH_TOKEN;
      if(!url||!token||url.startsWith('replace-')||token.startsWith('replace-'))throw Error('Fill TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env.server.');
      if(!/^(libsql|https):\/\/[a-zA-Z0-9.-]+(?::\d+)?\/?$/.test(url))throw Error('Invalid Turso database URL.');
      const {createClient}=await import('@libsql/client/web');
      client=createClient({url,authToken:token,fetch:(input,options={})=>fetch(input,{...options,signal:AbortSignal.timeout(30000)})});
      const source=new URL(url).hostname;
      if(!report){
        report=await transferCloudToLocal({client,destination,source,onProgress:({table,count})=>console.log(`Downloading ${table}: ${count} rows`)});
        console.log(`Verified transfer complete: ${report.tables.members.count} members, ${report.tables.events.count} scans, ${report.tables.visits.count} visits, ${report.tables.incidents.count} incidents.`);
      }
      const cleanup=await clearTransferredCloud({client,destination,source});
      console.log(`Turso data cleared after verifying local backup: ${cleanup.backupPath}`);
    }catch(error){
      if(!report)throw error;
      const message=error.code?'Check internet and Turso credentials.':error.message;
      const local=new Store(destination);
      try{const saved=transferStatus(local);saved.cleanup={...saved.cleanup,status:'pending',lastError:message};local.db.prepare("UPDATE settings SET value=? WHERE key='cloud_transfer'").run(JSON.stringify(saved));}finally{local.close();}
      console.warn('Local transfer is complete; the local website can operate offline. Cloud cleanup is pending. '+message+' Rerun setup.bat with internet to retry; local data will be preserved.');
    }
  }
}catch(error){console.error(error.code?'Cloud transfer failed. Check the connection and credentials, then rerun setup.':error.message);process.exitCode=1;}
finally{client?.close();}
