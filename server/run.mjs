import {appendFileSync,statSync,renameSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {dataDir} from './config.mjs';
import {startServer} from './index.mjs';
const path=join(dataDir,'server.log');
function log(...values){
  if(existsSync(path)&&statSync(path).size>5*1024*1024)renameSync(path,join(dataDir,`server-${Date.now()}.log`));
  appendFileSync(path,new Date().toISOString()+' '+values.join(' ')+'\n');
}
console.log=log;console.error=log;
process.env.GATEKEEPER_DATABASE='sqlite';
await startServer();
