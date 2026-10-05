import React,{useState} from 'react';
import {Modal} from './components';
import {useGatekeeper} from './store';
import {api} from './local-store';
export default function DatabaseClear(){
  const g=useGatekeeper(),[open,setOpen]=useState(false),[summary,setSummary]=useState(null),[phrase,setPhrase]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[operationId,setOperationId]=useState('');
  const target=g.cloud?'CLOUD':'LOCAL',expected=`CLEAR ${target} DATABASE`;
  const pending=(g.queue?.pending||0)+(g.queue?.unsaved?.length||0);
  async function show(){setOpen(true);setSummary(null);setPhrase('');setPassword('');setError('');setOperationId(crypto.randomUUID());try{setSummary(await api('/database/summary'));}catch(e){setError(e.message);}}
  async function clear(e){e.preventDefault();if(busy)return;setBusy(true);setError('');try{await g.clearDatabase({confirmation:phrase,password,operationId});setOpen(false);}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <>
    <button className="danger" onClick={show}>Clear database</button>
    {open&&<Modal title={`Clear ${g.cloud?'Turso cloud':'local SQLite'} database?`} onClose={()=>{if(!busy)setOpen(false);}}>
      <form className="record-form" onSubmit={clear}>
        <p>This removes all members, scan events, visits and incident logs from the <strong>{target.toLowerCase()} database</strong>. Login accounts and installation settings are retained.</p>
        {summary&&<p>{summary.members.toLocaleString()} members · {summary.events.toLocaleString()} scans · {summary.visits.toLocaleString()} visits · {summary.incidents.toLocaleString()} incidents</p>}
        <p>{g.cloud?'This deletes the cloud records permanently. Export anything you need before continuing.':'A local database backup is created before clearing.'} The checkpoint stays paused afterward. All users must sign in again.</p>
        <p>Pause the checkpoint, stop new scans and finish pending queues on every browser before clearing. This browser: {pending} pending or unsaved taps.</p>
        {!g.locked&&<p role="alert">Pause the checkpoint using Administration → Checkpoint control first.</p>}
        <label>Confirmation<input value={phrase} onChange={e=>setPhrase(e.target.value)} placeholder={expected} autoComplete="off" required disabled={busy}/></label>
        <label>Administrator password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required disabled={busy}/></label>
        {error&&<p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" disabled={busy} onClick={()=>setOpen(false)}>Cancel</button><button className="danger" disabled={busy||!summary||summary.retired||!g.locked||pending>0||phrase!==expected||!password}>{busy?'Clearing…':`Clear ${target.toLowerCase()} database`}</button></div>
      </form>
    </Modal>}
  </>;
}
