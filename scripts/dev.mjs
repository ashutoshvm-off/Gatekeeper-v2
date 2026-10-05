import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const children=[];let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill();process.exitCode=code;}
for(const file of ['server/index.mjs','node_modules/vite/bin/vite.js']){
  const child=spawn(process.execPath,[file,...(file.includes('vite')?['--host','127.0.0.1','--port','5173','--strictPort']:[])],{cwd:root,stdio:'inherit',windowsHide:true});children.push(child);
  child.on('error',error=>{console.error(error.message);stop(1);});child.on('exit',code=>{if(!stopping)stop(code??1);});
}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
