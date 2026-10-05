import React,{useEffect,useState} from 'react';
import {useGatekeeper} from './store';
import {api} from './local-store';
export default function DatabaseSettings(){const g=useGatekeeper();const [transfer,setTransfer]=useState(null);
  useEffect(()=>{let alive=true;if(g.local&&!g.cloud)api('/system/status').then(s=>{if(alive)setTransfer(s.transfer);}).catch(()=>{});return()=>{alive=false;};},[g.local,g.cloud]);
  if(!g.local)return null;return <section className="panel queue-panel">
  <h2>{g.cloud?'Cloud database':'Local database'}</h2><p>{g.cloud?'Turso · Members and scan history stored in the cloud':'SQLite · Stored on this computer · All scan history retained'}</p>
  <p>{g.cloud?'Use your Turso dashboard to manage backups and storage. Pending taps stay on this device until the cloud confirms them.':'Backups are saved beside the database in its backups folder. Copy backups to another disk for recovery if this computer fails.'}</p>
  {g.cloud?<p>When you run the local installer, it automatically copies and verifies your registry, scan history, visits and incidents before starting the local website. Let every scan queue finish before switching. After verification and a local backup, setup clears the transferred Turso data and blocks further cloud writes.</p>:transfer&&<p role="status">Cloud transfer verified on {new Date(transfer.completedAt).toLocaleString('en-IN')}: {transfer.counts.members.toLocaleString()} members, {transfer.counts.events.toLocaleString()} scans, {transfer.counts.visits.toLocaleString()} visits, {transfer.counts.incidents.toLocaleString()} incidents. New activity is saved locally.</p>}
  {transfer&&<p role="status">{transfer.cleanup?.status==='complete'?'Turso cleanup completed after the verified local backup.':'Turso cleanup is pending. The local database works offline. Rerun setup.bat with internet to retry.'} {transfer.cleanup?.lastError||''}</p>}
  <div className="actions"><button onClick={async()=>{try{const s=await api('/system/status');g.setNotice(`${s.database.engine} ${s.database.status}${Number.isFinite(s.database.bytes)?` · ${(s.database.bytes/1048576).toFixed(1)} MB`:''}`);}catch(e){g.setNotice(e.message);}}}>Test connection</button>{!g.cloud&&<button onClick={g.backupDatabase}>Create database backup</button>}<button onClick={g.migrateBrowserMembers}>Copy legacy browser members</button></div>
  <p>Legacy history remains in its original browser storage. Export it before changing browser profiles or clearing browser data.</p>
</section>;}
