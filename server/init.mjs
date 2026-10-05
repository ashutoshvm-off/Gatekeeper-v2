import {mkdirSync,existsSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {dataDir,configPath,passwordHash} from './config.mjs';
import {Store} from './database.mjs';
mkdirSync(dataDir,{recursive:true});
if(!existsSync(configPath)) {
  let input='';for await(const chunk of process.stdin)input+=chunk;
  const credentials=JSON.parse(input);
  for(const role of ['guard','admin'])if(typeof credentials[role]!=='string'||credentials[role].length<12)throw Error('Each password must contain at least 12 characters.');
  writeFileSync(configPath,JSON.stringify({port:4317,users:[{id:'SEC-G1-204',role:'guard',hash:passwordHash(credentials.guard)},{id:'ADM-ASIET-001',role:'admin',hash:passwordHash(credentials.admin)}]},null,2),{flag:'wx',mode:0o600});
}
const store=new Store(join(dataDir,'gatekeeper.sqlite'));store.close();
console.log(`Database initialized at ${join(dataDir,'gatekeeper.sqlite')}. Existing records preserved.`);
