import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {isPrivateRequest,assertPublicAsset,browserSafetyPlugin} from '../server/browser-safety.mjs';
import {createApp} from '../server/index.mjs';
import viteConfig from '../vite.config.js';
const privatePaths=['/.env.server','/.env.server?raw','/%2eenv.server?import','/%252eenv.server','/@fs/C:/example/.env.server?raw','/server/runtime.mjs?raw','/server/config.mjs','/.runtime/cloud-errors.log','/backups/gatekeeper.sqlite','/assets/database.sqlite-wal','/config.json','/scripts/cloud-launch.ps1','/vite.config.js','/assets/app.js.map'];
test('private file routes are blocked, including encoded and raw-import variants',()=>{
  for(const path of privatePaths)assert.equal(isPrivateRequest(path),true,path);
  for(const path of ['/api/config','/api/login','/src/domain.js','/assets/index.js','/server/history-format.mjs?t=123'])assert.equal(isPrivateRequest(path),false,path);
});
test('build guard rejects secrets and private assets without printing the secret',()=>{
  const secret='TEST-ONLY-SERVER-CREDENTIAL-12345';
  assert.throws(()=>assertPublicAsset('assets/app.js','var secret='+JSON.stringify(secret),[secret]),e=>/Build blocked/.test(e.message)&&!e.message.includes(secret));
  assert.throws(()=>assertPublicAsset('.env.server','anything',[]),/Private file/);
  assert.doesNotThrow(()=>assertPublicAsset('assets/app.js','var mode="cloud"',[secret]));
  const config=viteConfig({mode:'production'});assert.deepEqual(config.envPrefix,[]);assert.deepEqual(Object.keys(config.define),['import.meta.env.VITE_STORAGE_MODE']);
});
test('Vite refuses private files over HTTP before transforms and raw loading',async()=>{
  const server=await createServer({configFile:false,root:process.cwd(),logLevel:'silent',plugins:[browserSafetyPlugin(process.cwd())],server:{host:'127.0.0.1',port:0}});
  try{await server.listen();const url='http://127.0.0.1:'+server.httpServer.address().port;for(const path of privatePaths){const response=await fetch(url+path);assert.equal(response.status,403,path);assert.equal(await response.text(),'Private server file.');}}
  finally{await server.close();}
});
test('production API exposes only public configuration and refuses private files',async()=>{
  const server=createApp({config:{mode:'cloud',users:[]},store:{message:'',status:()=>({server:{status:'online'},database:{status:'connected',engine:'Turso'}})}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
  try{for(const path of privatePaths)assert.equal((await fetch(url+path)).status,403,path);
    assert.deepEqual(await (await fetch(url+'/api/config')).json(),{mode:'cloud',setupRequired:false,message:''});
    assert.equal((await fetch(url+'/api/members')).status,401);
  }finally{await new Promise(r=>server.close(r));}
});
