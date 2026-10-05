import React, {createContext, useContext, useEffect, useState} from 'react';
import {initialRecords, initialLogs, today} from './seed';
import {CHECKPOINT, migrateMember, migrateLog, mergeRecords, normalizeRecords, resolveTransit} from './domain';
import {exportRows, readRecords} from './files';

import {LocalProvider} from './local-store';
const Context = createContext(null);
function read(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : fallback; } catch { return fallback; }
}
export function Provider({children}) {return import.meta.env.VITE_STORAGE_MODE==='demo'?<DemoProvider>{children}</DemoProvider>:<LocalProvider Context={Context}>{children}</LocalProvider>;}
function DemoProvider({children}) {
  const [records, setRecords] = useState(() => read('gatekeeper-records-v1', initialRecords).map(migrateMember));
  const [logs, setLogs] = useState(() => read('gatekeeper-logs-v1', initialLogs).map(migrateLog));
  const [incidents, setIncidents] = useState(() => read('gatekeeper-incidents-v1', []));
  const [session, setSession] = useState(() => {try { const saved=JSON.parse(sessionStorage.getItem('gatekeeper-session')); return saved ? {...saved,gate:CHECKPOINT} : null; } catch { return null; }});
  const [notice, setNotice] = useState('');
  const [result, setResult] = useState(null);
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem('gatekeeper-records-v1', JSON.stringify(records));
      localStorage.setItem('gatekeeper-logs-v1', JSON.stringify(logs));
      localStorage.setItem('gatekeeper-incidents-v1', JSON.stringify(incidents));
    } catch { setNotice('Browser storage is full or unavailable. Changes are only saved for this session.'); }
  }, [records, logs, incidents]);
  useEffect(() => { sessionStorage.setItem('gatekeeper-session', JSON.stringify(session)); }, [session]);
  useEffect(() => { if(notice) {const id = setTimeout(() => setNotice(''), 6000); return () => clearTimeout(id);} }, [notice]);
  function scan(value) {
    const id = value.trim().toUpperCase();
    if(!id) return setNotice('Enter an ID or scan a barcode first.');
    const person = records.find(r => r.id === id || r.barcode === id);
    const direction = !person || !person.role || person.status !== 'ACTIVE' || locked ? 'DENIED' : resolveTransit(logs, person.id);
    const reason = locked ? 'Checkpoint paused by administrator' : !person ? 'ID not found in the registry' : !person.role ? 'Assign a Student, Staff, or Librarian role in Data management' : person.status !== 'ACTIVE' ? 'This access pass is suspended' : 'Identity matched to the campus registry';
    const row = {key:crypto.randomUUID(), id:person?.id || id, name:person?.name || 'Unregistered ID', department:person?.department || 'Unknown', role:person?.role || '', direction, date:today(), time:new Date().toLocaleTimeString('en-GB',{timeZone:'Asia/Kolkata'}), gate:CHECKPOINT, source:'Barcode / manual input', reason};
    setLogs(previous => [row, ...previous]);
    setResult({person, row, reason});
  }
  function saveRecord(record) {
    const [normalized] = normalizeRecords([record]);
    setRecords(previous => mergeRecords(previous, [{...record, ...normalized}]));
    setNotice('Registry updated. Changes saved in this browser.');
  }
  function deleteRecord(id) {
    if(resolveTransit(logs,id)==='OUT')throw Error('This member is currently checked in. Record their check-out before deleting, or suspend their pass.');
    setRecords(previous=>previous.filter(r=>r.id!==id));
    flag(id,session.id+' deleted member '+id+' from the registry. Access history retained.');
    setNotice('Member deleted. Access history retained.');return true;
  }
  function updateRecord(id, changes) { setRecords(previous => previous.map(r => r.id === id ? {...r, ...changes} : r)); }
  async function importFile(file, overwrite) {
    if(!file) return;
    try { const rows=normalizeRecords(await readRecords(file)); if(!rows.length) throw new Error('The file contains no records.'); setRecords(previous=>mergeRecords(previous,rows,overwrite)); const message=`Imported ${rows.length} records successfully.`;setNotice(message);return {ok:true,message}; }
    catch(error) { setNotice(error.message);return {ok:false,message:error.message}; }
  }
  async function download(rows, format, filename) {try {await exportRows(rows,format,filename); setNotice('Export downloaded.');}catch(error){setNotice(`Export failed: ${error.message}`);}}
  function flag(id, reason) { setIncidents(previous => [{id, reason, time:new Date().toISOString(), key:crypto.randomUUID()}, ...previous]); setNotice('Incident recorded in the local audit ledger.'); }
  return <Context.Provider value={{records, logs, incidents, session, setSession, notice, setNotice, result, setResult, scan, saveRecord, deleteRecord, updateRecord, importFile, download, flag, locked, setLocked}}>{children}</Context.Provider>;
}
export const useGatekeeper = () => useContext(Context);
