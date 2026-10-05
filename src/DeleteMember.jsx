import React,{useState} from 'react';
import {Modal} from './components';
import {useGatekeeper} from './store';
export default function DeleteMember({record,onClose}){
  const g=useGatekeeper(),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function remove(){
    if(busy)return;setBusy(true);setError('');
    try{await g.deleteRecord(record.id);onClose();}catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <Modal title="Delete campus member?" onClose={()=>{if(!busy)onClose();}}>
    <div className="record-form"><p>Remove <strong>{record.name}</strong> (<code>{record.id}</code>) from the registry?</p>
    <p>Existing scan history and incident logs will be retained. Their card will no longer grant access. You can edit their status to SUSPENDED if you want to keep the member registered.</p>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions"><button disabled={busy} onClick={onClose}>Cancel</button><button className="danger" disabled={busy} onClick={remove}>{busy?'Deleting…':'Delete member'}</button></div></div>
  </Modal>;
}
