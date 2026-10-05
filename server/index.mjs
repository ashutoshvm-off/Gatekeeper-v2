import {createServer} from 'node:http';
import {existsSync,statSync,createReadStream} from 'node:fs';
import {join,resolve,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
import {loadRuntime} from './runtime.mjs';
import {verifyPassword} from './config.mjs';
const root=resolve(fileURLToPath(new URL('../dist',import.meta.url)));
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>2*1024*1024)throw Error('Request exceeds 2 MB.');}return JSON.parse(text||'{}');}
export function createApp({store,config}) {
  const sessions=new Map(),attempts=new Map();
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'");
    try {
      const host=req.headers.host||'';
      if(!/^127\.0\.0\.1:\d+$/.test(host))return json(res,403,{error:'Use the local 127.0.0.1 address.'});
      const url=new URL(req.url,`http://${host}`),path=url.pathname;
      if(path.startsWith('/api/')){
        if(req.headers.origin&&req.headers.origin!==`http://${host}`&&req.headers.origin!=='http://127.0.0.1:5173')return json(res,403,{error:'Untrusted origin.'});
        if(req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'Cross-site request refused.'});
        if(req.method==='POST'&&!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'JSON required.'});
        if(path==='/api/config'&&req.method==='GET')return json(res,200,{mode:config.mode||'local',setupRequired:!!store.message,message:store.message||''});
        if(path==='/api/system/status'&&req.method==='GET'){
          try{return json(res,200,{...await store.status(),app:'asiet-gatekeeper',version:1});}
          catch{return json(res,200,{server:{status:'online'},database:{status:'disconnected',engine:config.mode==='cloud'?'Turso':'SQLite'},storage:null,message:'Database connection unavailable.'});}
        }
        const token=req.headers.cookie?.match(/(?:^|;\s*)gatekeeper=([a-f0-9]+)/)?.[1];
        const session=sessions.get(token);
        if(session&&session.expires<Date.now()){sessions.delete(token);}
        const user=session&&session.expires>Date.now()?session.user:null;
        if(path==='/api/login'&&req.method==='POST'){
          if(!config.users.length)return json(res,503,{error:store.message||'Complete cloud configuration first.'});
          const now=Date.now(),rate=attempts.get('local')||{count:0,until:now+60000};
          if(rate.until<now){rate.count=0;rate.until=now+60000;}attempts.set('local',rate);
          if(++rate.count>15)return json(res,429,{error:'Too many attempts. Wait one minute.'});
          const data=await body(req),account=config.users.find(u=>u.id===data.id);
          if(typeof data.password!=='string'||data.password.length>1024||!account||!verifyPassword(data.password,account.hash))return json(res,401,{error:'Invalid ID or password.'});
          if(token)sessions.delete(token);
          for(const [key,value] of sessions)if(value.expires<now)sessions.delete(key);
          const fresh=randomBytes(32).toString('hex'),publicUser={id:account.id,role:account.role,adminUnlocked:account.role==='admin',gate:'Gate 1'};
          sessions.set(fresh,{user:publicUser,expires:now+12*60*60*1000});
          res.setHeader('Set-Cookie',`gatekeeper=${fresh}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`);return json(res,200,publicUser);
        }
        if(path==='/api/logout'&&req.method==='POST'){sessions.delete(token);res.setHeader('Set-Cookie','gatekeeper=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(res,200,{ok:true});}
        if(path==='/api/session'&&req.method==='GET')return json(res,200,user);
        if(!user)return json(res,401,{error:'Sign in to connect to the database. Pending scans are retained.'});
        if(path==='/api/session/lock'&&req.method==='POST'){user.adminUnlocked=false;return json(res,200,user);}
        if(path==='/api/state'&&req.method==='GET')return json(res,200,{locked:await store.getLocked()});
        if(path==='/api/scans'&&req.method==='POST'){const data=await body(req);return json(res,200,{results:await store.scans(data.items,user.id)});}
        if(path==='/api/incidents'&&req.method==='POST'){const data=await body(req);if(!data.reason?.trim())throw Error('Enter incident details.');return json(res,200,await store.incident(data.id,data.reason));}
        if(user.role!=='admin'||!user.adminUnlocked)return json(res,403,{error:'Administrator sign-in required.'});
        if(path==='/api/log-import'&&req.method==='POST'){const data=await body(req);return json(res,200,await store.importHistory(data.rows,user.id));}
        if(path==='/api/members/delete'&&req.method==='POST'){const data=await body(req);return json(res,200,await store.deleteMember(data.id,user.id));}
        if(path==='/api/members'&&req.method==='GET')return json(res,200,await store.members());
        if(path==='/api/members'&&req.method==='POST'){const data=await body(req);return json(res,200,await store.saveMembers(data.rows,data.overwrite!==false));}
        if(path==='/api/visits'&&req.method==='GET'){
          const filters=Object.fromEntries(url.searchParams),limit=Math.min(1000,Math.max(1,Number(filters.limit)||50)),offset=Math.max(0,Number(filters.offset)||0);
          return json(res,200,await store.visits(filters,Math.floor(limit),Math.floor(offset)));
        }
        if(path==='/api/incidents'&&req.method==='GET')return json(res,200,await store.incidents());
        if(path==='/api/checkpoint'&&req.method==='POST'){const data=await body(req);if(typeof data.locked!=='boolean')throw Error('Invalid checkpoint state.');return json(res,200,await store.setCheckpoint(data.locked,user.id));}
        if(path==='/api/clear-all'&&req.method==='POST'){try{await store.backup();}catch{}const result=await store.clearAll(user.id);return json(res,200,result);}
        if(path==='/api/backup'&&req.method==='POST')return json(res,200,{path:await store.backup()});
        return json(res,404,{error:'Unknown endpoint.'});
      }
      if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed.'});
      const file=resolve(root,'.'+decodeURIComponent(path==='/'?'/index.html':path));
      if(!file.startsWith(root+sep)||!existsSync(file)||!statSync(file).isFile())return json(res,404,{error:'File not found. Build the website first.'});
      const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
      res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});
      if(req.method==='HEAD')return res.end();createReadStream(file).pipe(res);
    }catch(error){
      if(config.mode==='cloud'&&error.code){console.error('Cloud database request failed:',String(error.code));return json(res,503,{error:'Cloud database request failed. Check the connection and server configuration. Pending taps are retained.'});}
      console.error(error.message);json(res,String(error.code||'').includes('SQLITE')?503:400,{error:String(error.code||'').includes('SQLITE')?'Database write failed. Pending scans are retained; check disk space and server logs.':error.message});
    }
  });
  return server;
}
export async function startServer(){
  try{
    const {config,store}=await loadRuntime();
    const server=createApp({store,config});
    server.listen(config.port,'127.0.0.1',()=>console.log(`Gatekeeper API (${config.mode}): http://127.0.0.1:${config.port}${store.message?' - '+store.message:''}`));
    server.on('error',error=>{console.error(error.message);store.close();process.exitCode=1;});
    for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{store.close();process.exit(0);}));
  }catch(error){console.error('Startup failed. Check .env.server for cloud mode or run setup.bat for local mode. '+error.message);process.exitCode=1;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)startServer();
