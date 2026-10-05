import React,{useEffect,useMemo,useState} from 'react';
import {useGatekeeper} from './store';
import {downloadFile,readRecords} from './files';
import {guessHistoryMapping,historyFields,parseHistory} from '../server/history-format.mjs';
import './log-import.css';

const common=['id','name','department','role','sourceId','reason'];
const when=value=>value?new Date(value).toLocaleString('en-GB',{timeZone:'Asia/Kolkata',hour12:false}):'—';
export default function LogImport(){
  const g=useGatekeeper();
  const [rows,setRows]=useState([]),[headers,setHeaders]=useState([]),[filename,setFilename]=useState('');
  const [mapping,setMapping]=useState({}),[mode,setMode]=useState('events'),[dateFormat,setDateFormat]=useState('DMY');
  const [busy,setBusy]=useState(false),[reading,setReading]=useState(false),[message,setMessage]=useState(''),[done,setDone]=useState(false);
  const preview=useMemo(()=>{
    if(!rows.length)return {visits:[],errors:[]};
    try{return parseHistory(rows,mapping,{mode,dateFormat});}catch(e){return {visits:[],errors:[{message:e.message}]};}
  },[rows,mapping,mode,dateFormat]);
  useEffect(()=>{if(!busy)return;const warn=e=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[busy]);
  if(!g.local)return null;
  async function choose(file){
    if(!file)return;setReading(true);setRows([]);setFilename(file.name);setMessage('');setDone(false);
    try{
      const data=await readRecords(file);
      if(!Array.isArray(data)||!data.length||data.some(r=>!r||typeof r!=='object'||Array.isArray(r)))throw Error('Choose a file containing a table of log records.');
      const columns=Object.keys(data[0]),guessed=guessHistoryMapping(columns);
      setHeaders(columns);setMapping(guessed);setMode(guessed.checkIn||guessed.checkOut||guessed.attempt?'visits':'events');setRows(data);
    }catch(e){setMessage(e.message);}finally{setReading(false);}
  }
  async function importBatch(rows){
    const response=await fetch('/api/log-import',{method:'POST',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({rows}),signal:AbortSignal.timeout(120000)});
    if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Server unavailable.');
    const data=await response.json();if(!response.ok)throw Error(data.error||'Import request failed.');return data;
  }
  async function save(){
    if(busy||preview.errors.length||!preview.visits.length)return;
    setBusy(true);let imported=0,duplicates=0,processed=0;
    try{
      for(let i=0;i<preview.visits.length;i+=50){
        const result=await importBatch(preview.visits.slice(i,i+50));
        imported+=result.imported;duplicates+=result.duplicates;processed+=Math.min(50,preview.visits.length-i);
        setMessage(`${processed.toLocaleString()} / ${preview.visits.length.toLocaleString()} visits confirmed. Keep this page open until complete.`);
        if(i+50<preview.visits.length)await new Promise(r=>setTimeout(r,200));
      }
      setMessage(`Complete: ${imported.toLocaleString()} visits imported; ${duplicates.toLocaleString()} duplicates skipped. Open Access logs to view them.`);setDone(true);
    }catch(e){setMessage(`Import stopped: ${processed.toLocaleString()} visits confirmed (${imported} new, ${duplicates} duplicates). ${e.message} Retry with the same file and mappings; any already saved records will be skipped.`);}
    finally{setBusy(false);}
  }
  function sample(){downloadFile('id,name,department,role,checkInDate,checkInTime,checkOutDate,checkOutTime\r\nSTD001,Example Student,CS,Student,2025-06-01,09:00:00,2025-06-01,16:00:00\r\n','historical-logs-template.csv','text/csv;charset=utf-8');}
  const fields=[...common,...(mode==='events'?['direction','timestamp','time']:['checkIn','checkInTime','checkOut','checkOutTime','attempt','attemptTime'])];
  return <section className="panel history-import" aria-label="Import historical logs">
    <div className="panel-heading"><div><h2>Import historical logs</h2><p>Bring access history from your previous system into the {g.cloud?'cloud':'local'} database.</p></div><button onClick={sample}>Download CSV template</button></div>
    <div className="history-import-body">
      <p>Choose CSV, Excel (.xlsx) or JSON. Match your columns and review the preview before importing. Existing members do not have to be registered first.</p>
      <label className="history-file">Log file (up to 25 MB)<input aria-label="Historical log file" type="file" accept=".csv,.xlsx,.json" disabled={busy||reading} onChange={e=>choose(e.target.files?.[0])}/></label>
      {reading&&<p role="status">Reading file…</p>}
      {!!rows.length&&<>
        <p><strong>{filename}</strong> · {rows.length.toLocaleString()} source rows</p>
        <fieldset disabled={busy}>
          <div className="history-mapping">
            <label>File layout<select value={mode} onChange={e=>{setMode(e.target.value);setDone(false);setMessage('');}}><option value="events">Separate IN / OUT / DENIED events</option><option value="visits">Paired check-in / check-out visits</option></select></label>
            <label>Date order<select value={dateFormat} onChange={e=>{setDateFormat(e.target.value);setDone(false);setMessage('');}}><option value="DMY">Day / month / year (Indian format)</option><option value="MDY">Month / day / year</option></select></label>
          </div>
          <p>YYYY-MM-DD works with either date order. Times without a timezone use India Standard Time. Use four-digit years and include the time. For paired visits with a shared date, select that date column for both timestamps.</p>
          <div className="history-mapping">{fields.map(field=><label key={field}>{historyFields[field]}{field==='id'?' *':''}<select aria-label={historyFields[field]} value={mapping[field]||''} onChange={e=>{setMapping({...mapping,[field]:e.target.value});setDone(false);setMessage('');}}><option value="">Not provided</option>{headers.map(h=><option key={h} value={h}>{h}</option>)}</select></label>)}</div>
        </fieldset>
        <p>Separate events are paired by member and time within this file. Missing check-ins/check-outs are retained as historical records and do not change current occupancy. Duplicate detection uses member ID, original log ID (if provided), and timestamps; keep the same mappings when retrying.</p>
        {preview.errors.length>0?<div role="alert" className="history-errors"><strong>Fix {preview.errors.length} validation issue(s) before importing.</strong><ul>{preview.errors.slice(0,10).map((e,i)=><li key={i}>{e.row?`Row ${e.row}: `:''}{e.message}</li>)}</ul>{preview.errors.length>10&&<p>Showing the first 10 issues.</p>}</div>:<>
          <h3>Preview · {preview.visits.length.toLocaleString()} visits · first 20 shown</h3>
          <div className="table-scroll"><table><thead><tr><th>Member ID</th><th>Name</th><th>Check-in (IST)</th><th>Check-out (IST)</th><th>Denied attempt (IST)</th><th>Status</th></tr></thead><tbody>{preview.visits.slice(0,20).map((row,i)=><tr key={i}><td>{row.id}</td><td>{row.name||'—'}</td><td>{when(row.checkIn)}</td><td>{when(row.checkOut)}</td><td>{when(row.attempt)}</td><td>{row.status}</td></tr>)}</tbody></table></div>
        </>}
        <button className="primary" disabled={busy||done||preview.errors.length>0||!preview.visits.length} onClick={save}>{busy?'Importing…':done?'Import complete':`Import ${preview.visits.length.toLocaleString()} visits`}</button>
      </>}
      {message&&<p role="status" className="history-progress">{message}</p>}
    </div>
  </section>;
}
