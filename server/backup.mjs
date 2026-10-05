import {join} from 'node:path';
import {existsSync} from 'node:fs';
import {Store} from './database.mjs';
import {dataDir} from './config.mjs';
const path=join(dataDir,'gatekeeper.sqlite');
if(!existsSync(path))throw Error('No database found. Run setup.bat first.');
const store=new Store(path);try{console.log('Backup created: '+await store.backup());}finally{store.close();}
