import React,{useEffect,useRef,useState} from 'react';
import {enqueueScan,pendingScans,pendingCount,acknowledgeScans,exportPending} from './scan-queue';
import {normalizeRecords} from './domain';
import {exportRows,readRecords,downloadFile} from './files';

export async function api(path,body){
  const response=await fetch('/api'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Website server unavailable. In cloud mode run start-cloud.bat or npm run dev; for an installed local system run start.bat.');
  const data=await response.json();if(!response.ok){const error=Error(data.error||'Request failed.');error.status=response.status;throw error;}return data;
}
export function LocalProvider({children,Context}){
  const [connection,setConnection]=useState({mode:'cloud',setupRequired:false,message:''});
  const [records,setRecords]=useState([]),[incidents,setIncidents]=useState([]),[session,updateSession]=useState(null);
  const [notice,setNotice]=useState(''),[result,setResult]=useState(null),[locked,updateLocked]=useState(false),[revision,setRevision]=useState(0);
  const [queue,setQueue]=useState({pending:0,state:'Checking',error:'',lastSaved:null,lastCaptured:null,unsaved:[]});
  const sessionRef=useRef(null),captureChain=useRef(Promise.resolve()),pumpRef=useRef(()=>{}),refreshRef=useRef(()=>{}),unsavedRef=useRef([]);
  const setUser=user=>{sessionRef.current=user;updateSession(user);};
  const refresh=async()=>{
    const state=await api('/state');updateLocked(state.locked);
    if(sessionRef.current?.adminUnlocked){const [members,ledger]=await Promise.all([api('/members'),api('/incidents')]);setRecords(members);setIncidents(ledger);}
  };
  refreshRef.current=refresh;
  useEffect(()=>{
    let alive=true;
    api('/config').then(value=>{if(alive)setConnection(value);}).catch(()=>{if(alive)setConnection({mode:'cloud',setupRequired:true,message:'The backend is not running. Start the website with npm run dev.'});});
    api('/session').then(user=>{if(alive){setUser(user);if(user)refreshRef.current().catch(e=>setNotice(e.message));}}).catch(()=>{});
    return()=>{alive=false;};
  },[]);
  useEffect(()=>{
    const warn=event=>{if(unsavedRef.current.length){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[]);
  useEffect(()=>{if(notice){const t=setTimeout(()=>setNotice(''),8000);return()=>clearTimeout(t);}},[notice]);
  useEffect(()=>{
    let alive=true,busy=false,timer,delay=1000;
    const update=values=>{if(alive)setQueue(q=>({...q,...values}));};
    async function pump(){
      if(!alive||busy)return;busy=true;clearTimeout(timer);
      try{
        update({pending:await pendingCount()});
        if(!sessionRef.current){update({state:'Sign in to sync'});return;}
        if(!navigator.locks)throw Error('This browser cannot coordinate the queue. Use current Edge or Chrome.');
        await navigator.locks.request('gatekeeper-scan-uploader',{ifAvailable:true},async lock=>{
          if(!lock){update({state:'Syncing in another tab'});return;}
          const items=await pendingScans();
          if(!items.length){update({state:'Ready',error:''});delay=1000;return;}
          update({state:'Saving'});
          const response=await api('/scans',{items});
          if(response.results?.length!==items.length||!items.every((item,i)=>response.results[i]?.key===item.key))throw Error('Invalid database acknowledgement. Queue retained.');
          // A failed deletion is safe: the server returns the same results on retry.
          await acknowledgeScans(items);
          const last=response.results.at(-1);
          if(alive){setResult(last);setRevision(v=>v+1);}
          update({pending:await pendingCount(),state:'Saved',error:'',lastSaved:last.row});delay=250;
        });
      }catch(error){update({state:error.status===401?'Sign in to sync':'Waiting to retry',error:error.message});delay=Math.min(delay*2,30000);}
      finally{busy=false;if(alive)timer=setTimeout(pump,delay);}
    }
    pumpRef.current=()=>{delay=250;pump();};
    const resume=()=>pumpRef.current();window.addEventListener('online',resume);pump();
    navigator.storage?.persist?.().catch(()=>{});
    return()=>{alive=false;clearTimeout(timer);window.removeEventListener('online',resume);};
  },[]);
  async function login(id,password){const user=await api('/login',{id,password});setUser(user);await refresh();pumpRef.current();return user;}
  function setSession(value){
    if(value===null){api('/logout',{}).then(()=>{setUser(null);setRecords([]);setIncidents([]);}).catch(e=>setNotice(e.message));return;}
    const next=typeof value==='function'?value(sessionRef.current):value;
    if(next?.adminUnlocked===false&&sessionRef.current?.adminUnlocked){
      setUser(next);setRecords([]);setIncidents([]);
      api('/session/lock',{}).catch(e=>{setNotice(e.message);api('/logout',{}).catch(()=>{});setUser(null);});
    }
  }
  function scan(raw,capturedAt=new Date().toISOString()){
    const id=raw.trim().toUpperCase();if(!id)return;
    if(id.length>128){setNotice('Barcode exceeds 128 characters and was not queued.');return;}
    captureChain.current=captureChain.current.then(async()=>{
      if(unsavedRef.current.length){unsavedRef.current.push({id,time:capturedAt});setQueue(q=>({...q,unsaved:[...unsavedRef.current]}));return;}
      try{
        const item=await enqueueScan(id,capturedAt);
        setQueue(q=>({...q,lastCaptured:item,pending:q.pending+1}));pumpRef.current();
      }catch(error){unsavedRef.current.push({id,time:capturedAt});setQueue(q=>({...q,unsaved:[...unsavedRef.current],error:`Tap ${id} was NOT saved: ${error.message}`}));}
    });
  }
  async function retryUnsaved(){
    captureChain.current=captureChain.current.then(async()=>{
      while(unsavedRef.current.length){
        const item=unsavedRef.current[0];
        try{await enqueueScan(item.id,item.time);unsavedRef.current.shift();setQueue(q=>({...q,unsaved:[...unsavedRef.current],pending:q.pending+1}));}
        catch(error){setQueue(q=>({...q,error:`Tap ${item.id} was NOT saved: ${error.message}`}));break;}
      }
      pumpRef.current();
    });
  }
  async function saveRecord(record){try{await api('/members',{rows:[record]});await refresh();setNotice('Registry saved to the database.');return true;}catch(e){setNotice(e.message);return false;}}
  async function deleteRecord(id){
    const result=await api('/members/delete',{id});
    setRecords(previous=>previous.filter(r=>r.id!==id));
    setNotice(result.deleted?'Member deleted. Access history retained.':'This member was already removed.');
    refresh().catch(()=>{});return true;
  }
  async function updateRecord(id,changes){const current=records.find(r=>r.id===id);if(current)await saveRecord({...current,...changes});}
  async function importFile(file,overwrite){
    if(!file)return;let saved=0,created=0,updated=0,skipped=0;
    try{const rows=normalizeRecords(await readRecords(file));if(!rows.length)throw Error('The file contains no records.');
      for(let i=0;i<rows.length;i+=500){const batch=rows.slice(i,i+500);const result=await api('/members',{rows:batch,overwrite});saved+=(result.saved||batch.length);created+=(result.created||0);updated+=(result.updated||0);skipped+=(result.skipped||0);}
      await refresh();const parts=[`${saved} records processed`];if(created)parts.push(`${created} new`);if(updated)parts.push(`${updated} updated (duplicate IDs)`);if(skipped)parts.push(`${skipped} skipped (duplicate IDs)`);const message=parts.join(', ')+'.';setNotice(message);return {ok:true,message};
    }catch(e){const message=`${saved} records processed before import stopped. ${e.message}`;setNotice(message);refresh().catch(()=>{});return {ok:false,message};}
  }
  async function download(rows,format,filename){try{await exportRows(rows,format,filename);}catch(e){setNotice(e.message);}}
  async function flag(id,reason){try{await api('/incidents',{id,reason});if(sessionRef.current?.adminUnlocked)await refresh();setNotice('Incident saved to the database.');}catch(e){setNotice('Incident not saved: '+e.message);}}
  async function setLocked(value){try{const state=await api('/checkpoint',{locked:value});updateLocked(state.locked);await refresh();}catch(e){setNotice(e.message);}}
  async function exportVisits(filters={},format='csv'){
    try{
      const rows=[];let total=Infinity;
      for(let offset=0;offset<total;offset+=1000){const data=await api('/visits?'+new URLSearchParams({...filters,offset,limit:1000}));total=data.total;rows.push(...data.rows);}
      await download(rows,format,'gatekeeper-transit');
    }catch(e){setNotice(e.message);}
  }
  async function backupDatabase(){try{const data=await api('/backup',{});setNotice('Backup created: '+data.path);}catch(e){setNotice('Backup failed: '+e.message);}}
  async function downloadQueue(){try{downloadFile(JSON.stringify(await exportPending(),null,2),'gatekeeper-pending-scans.json','application/json');}catch(e){setNotice(e.message);}}
  async function clearAllData(){
    try{await api('/clear-all',{});setRecords([]);setIncidents([]);updateLocked(false);await refresh();setNotice('All data cleared from the database. A backup was created automatically.');}catch(e){setNotice('Clear failed: '+e.message);}
  }
  async function migrateBrowserMembers(){
    try{const rows=JSON.parse(localStorage.getItem('gatekeeper-records-v1')||'[]');if(!rows.length)throw Error('No legacy members in this browser profile/origin. Import your exported registry file instead.');
      for(let i=0;i<rows.length;i+=500)await api('/members',{rows:rows.slice(i,i+500),overwrite:false});await refresh();setNotice('Browser members copied. Existing database members and browser data preserved.');
    }catch(e){setNotice(e.message);}
  }
  return <Context.Provider value={{local:true,connection,cloud:connection.mode==='cloud',records,logs:[],incidents,session,setSession,login,notice,setNotice,result,setResult,scan,saveRecord,deleteRecord,updateRecord,importFile,download,flag,locked,setLocked,queue,retryQueue:()=>pumpRef.current(),retryUnsaved,downloadQueue,backupDatabase,migrateBrowserMembers,clearAllData,revision,exportVisits}}>{children}</Context.Provider>;
}
