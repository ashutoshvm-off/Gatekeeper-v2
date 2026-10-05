import React,{useEffect,useState} from 'react';
import {Icon} from './components';

const unavailable={server:'Not connected',database:'Not connected',storage:null,engine:''};
function bytes(value){
  const units=['B','KB','MB','GB','TB'];let size=value,index=0;
  while(size>=1024&&index<units.length-1){size/=1024;index++;}
  return `${size.toFixed(index?1:0)} ${units[index]}`;
}
export default function SystemStatus(){
  const [status,setStatus]=useState({...unavailable,server:'Checking…'});
  useEffect(()=>{
    let alive=true,busy=false,controller;
    async function check(){
      if(busy||document.visibilityState==='hidden')return;
      busy=true;controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),5000);
      try{
        const response=await fetch(import.meta.env.VITE_SYSTEM_STATUS_URL||'/api/system/status',{signal:controller.signal,cache:'no-store',headers:{Accept:'application/json'}});
        if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw Error('Status endpoint unavailable');
        const data=await response.json();
        if(!['online','degraded'].includes(data.server?.status)||!['connected','disconnected'].includes(data.database?.status))throw Error('Invalid system status');
        const disk=data.storage;
        const validDisk=disk&&Number.isFinite(disk.usedBytes)&&Number.isFinite(disk.totalBytes)&&disk.totalBytes>0&&disk.usedBytes>=0&&disk.usedBytes<=disk.totalBytes;
        if(alive)setStatus({server:data.server.status==='online'?'Online':'Degraded',database:data.database.status==='connected'?'Connected':'Disconnected',storage:validDisk?disk:null,engine:data.database.engine||''});
      }catch{if(alive)setStatus(unavailable);}
      finally{clearTimeout(timeout);busy=false;}
    }
    check();
    const timer=setInterval(check,30000);
    document.addEventListener('visibilitychange',check);
    return()=>{alive=false;clearInterval(timer);controller?.abort();document.removeEventListener('visibilitychange',check);};
  },[]);
  const percent=status.storage?Math.round(status.storage.usedBytes/status.storage.totalBytes*100):null;
  const storageText=status.storage?`${bytes(status.storage.usedBytes)} / ${bytes(status.storage.totalBytes)}`:'Not available';
  const summary=`Server: ${status.server}. System database: ${status.database}. Storage: ${storageText}.`;
  return <section className="system-status" aria-label="System status" title={summary}>
    <div className="system-status-heading"><Icon name="database" size={16}/><span>System status</span></div>
    <dl><div><dt>Server</dt><dd><i className={status.server==='Online'?'status-online':'status-unavailable'}/>{status.server}</dd></div>
      <div><dt>{status.engine==='Turso'?'Cloud DB':'System DB'}</dt><dd><i className={status.database==='Connected'?'status-online':'status-unavailable'}/>{status.database}</dd></div>
      <div className="storage-status"><dt>Storage</dt><dd>{storageText}</dd></div></dl>
    {percent!==null&&<div className="system-storage-meter"><meter min="0" max="100" value={percent} aria-label="System storage used"/ ><span>{percent}% used</span></div>}
    {!status.storage&&<p className="system-status-note">{status.engine==='Turso'?'Turso · Storage usage available in cloud dashboard':status.database==='Connected'?'Storage measurements unavailable':'Awaiting system connection'}</p>}
  </section>;
}
