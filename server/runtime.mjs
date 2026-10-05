import {loadEnvFile} from 'node:process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {dataDir,loadConfig,passwordHash} from './config.mjs';

export const environmentPath=fileURLToPath(new URL('../.env.server',import.meta.url));
export class UnconfiguredStore {
  constructor(message){this.message=message;}
  status(){return {server:{status:'online'},database:{status:'disconnected',engine:'Turso'},storage:null,setupRequired:true,message:this.message};}
  close(){}
  getLocked(){throw Error(this.message);}
}
export function cloudConfiguration(env){
  const missing=['TURSO_DATABASE_URL','TURSO_AUTH_TOKEN','GATEKEEPER_GUARD_PASSWORD','GATEKEEPER_ADMIN_PASSWORD'].filter(key=>!env[key]||env[key].startsWith('replace-'));
  if(missing.length)return {error:`Cloud setup required: fill ${missing.join(', ')} in .env.server, then restart npm run dev.`};
  if(!/^libsql:\/\/[a-zA-Z0-9.-]+(?::\d+)?\/?$/.test(env.TURSO_DATABASE_URL)&&!/^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?\/?$/.test(env.TURSO_DATABASE_URL))return {error:'TURSO_DATABASE_URL must be a libsql:// or https:// database URL.'};
  if([env.GATEKEEPER_GUARD_PASSWORD,env.GATEKEEPER_ADMIN_PASSWORD].some(p=>p.length<12))return {error:'Choose officer/admin passwords of at least 12 characters in .env.server.'};
  return {config:{port:4317,mode:'cloud',users:[{id:'SEC-G1-204',role:'guard',hash:passwordHash(env.GATEKEEPER_GUARD_PASSWORD)},{id:'ADM-ASIET-001',role:'admin',hash:passwordHash(env.GATEKEEPER_ADMIN_PASSWORD)}]}};
}
export async function loadRuntime(){
  if(existsSync(environmentPath))loadEnvFile(environmentPath);
  if(process.env.GATEKEEPER_DATABASE==='sqlite'){
    const {Store}=await import('./database.mjs');return {config:{...loadConfig(),mode:'local'},store:new Store(join(dataDir,'gatekeeper.sqlite'))};
  }
  const result=cloudConfiguration(process.env);
  if(result.error)return {config:{port:4317,mode:'cloud',users:[]},store:new UnconfiguredStore(result.error)};
  const [{createClient},{CloudStore}]=await Promise.all([import('@libsql/client/web'),import('./cloud-database.mjs')]);
  const boundedFetch=(input,options={})=>fetch(input,{...options,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)});
  return {config:result.config,store:new CloudStore(createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN,fetch:boundedFetch}))};
}
