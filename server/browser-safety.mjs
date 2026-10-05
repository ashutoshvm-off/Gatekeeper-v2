import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {parseEnv} from 'node:util';

export function isPrivateRequest(raw){
  let path=String(raw||'').split('?')[0];
  try{for(let i=0;i<4;i++){const decoded=decodeURIComponent(path);if(decoded===path)break;path=decoded;}}catch{return true;}
  path=path.replaceAll('\\','/').toLowerCase().split(/[?#]/)[0];
  const parts=path.split('/');
  if(parts.some(part=>/^\.env(?:\.|$)/.test(part)||['.git','.runtime','.local-data','.aws','.codex','.agents','backups','test-results'].includes(part)))return true;
  if(/\.(?:sqlite(?:-wal|-shm)?|db|log|pem|key|p12|pfx|bak|map)$/.test(path))return true;
  if(parts.includes('server')&&!/\/server\/history-format\.mjs$/.test(path))return true;
  if(parts.includes('scripts')||parts.includes('tests')||parts.includes('__open-in-editor'))return true;
  return /\/(?:config\.json|vite\.config\.[^/]+)$/.test(path);
}
export function configuredSecrets(root){
  const environments=[process.env];
  for(const name of readdirSync(root))if(/^\.env(?:\.|$)/.test(name)&&!name.endsWith('.example'))environments.push(parseEnv(readFileSync(join(root,name),'utf8')));
  return [...new Set(environments.flatMap(env=>Object.entries(env).filter(([key,value])=>/(?:TURSO_AUTH_TOKEN|TURSO_DATABASE_URL|GATEKEEPER_(?:GUARD|ADMIN)_PASSWORD)$/.test(key)&&typeof value==='string'&&value.length>=12&&!value.startsWith('replace-')).map(([,value])=>value)))];
}
export function assertPublicAsset(name,contents,secrets){
  if(isPrivateRequest('/'+name))throw Error('Private file cannot be published: '+name);
  const data=Buffer.isBuffer(contents)?contents:Buffer.from(contents);
  if(secrets.some(secret=>[secret,JSON.stringify(secret).slice(1,-1),encodeURIComponent(secret)].some(value=>data.includes(Buffer.from(value)))))throw Error('A server-only credential was found in browser output. Build blocked: '+name);
}
export function checkPublicDirectory(directory,secrets){
  if(!existsSync(directory))return;
  function walk(path,prefix=''){
    for(const item of readdirSync(path,{withFileTypes:true})){
      const name=prefix+item.name,full=join(path,item.name);
      if(item.isSymbolicLink())throw Error('Symbolic links cannot be published: '+name);
      if(item.isDirectory())walk(full,name+'/');else assertPublicAsset(name,readFileSync(full),secrets);
    }
  }
  walk(directory);
}
export function browserSafetyPlugin(root){
  const middleware=(_req,res,next)=>{if(isPrivateRequest(_req.url)){res.statusCode=403;res.setHeader('Content-Type','text/plain');res.setHeader('Cache-Control','no-store');res.end('Private server file.');}else next();};
  return {
    name:'gatekeeper-browser-safety',enforce:'pre',
    configureServer(server){server.middlewares.use(middleware);},
    configurePreviewServer(server){server.middlewares.use(middleware);},
    buildStart(){checkPublicDirectory(join(root,'public'),configuredSecrets(root));},
    generateBundle(_options,bundle){const secrets=configuredSecrets(root);for(const [name,item] of Object.entries(bundle))assertPublicAsset(name,item.type==='chunk'?item.code:item.source,secrets);}
  };
}
