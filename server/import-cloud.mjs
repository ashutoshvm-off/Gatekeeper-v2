import {loadEnvFile} from 'node:process';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {dataDir} from './config.mjs';
import {Store} from './database.mjs';
import {transferCloudToLocal,transferStatus} from './cloud-transfer.mjs';
const destination=join(dataDir,'gatekeeper.sqlite');
let client;
try{
  const local=new Store(destination);const completed=transferStatus(local);local.close();
  if(completed){console.log(`Cloud transfer already completed on ${completed.completedAt}. Local changes preserved; no cloud download needed.`);}
  else{
    const envPath=new URL('../.env.server',import.meta.url);if(existsSync(envPath))loadEnvFile(envPath);
    const url=process.env.TURSO_DATABASE_URL,token=process.env.TURSO_AUTH_TOKEN;
    if(!url||!token||url.startsWith('replace-')||token.startsWith('replace-'))throw Error('Fill TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the project .env.server before local setup. Upload your registry to Turso first.');
    if(!/^(libsql|https):\/\/[a-zA-Z0-9.-]+(?::\d+)?\/?$/.test(url))throw Error('Invalid Turso database URL.');
    const {createClient}=await import('@libsql/client/web');
    client=createClient({url,authToken:token,fetch:(input,options={})=>fetch(input,{...options,signal:AbortSignal.timeout(30000)})});
    const report=await transferCloudToLocal({client,destination,source:new URL(url).hostname,onProgress:({table,count})=>console.log(`Downloading ${table}: ${count} rows`)});
    console.log(`Verified transfer complete: ${report.tables.members.count} members, ${report.tables.events.count} scans, ${report.tables.visits.count} visits, ${report.tables.incidents.count} incidents.`);
  }
}catch(error){console.error(error.code?'Cloud transfer failed. Check the connection and credentials, then rerun setup.':error.message);process.exitCode=1;}
finally{client?.close();}
