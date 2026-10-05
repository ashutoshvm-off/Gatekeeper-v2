import React from 'react';
import {useGatekeeper} from './store';
export default function QueueStatus(){
  const g=useGatekeeper();if(!g.local)return null;const q=g.queue;
  return <section className={`panel queue-panel ${q.error||q.unsaved.length?'queue-warning':''}`} aria-label="Scan queue">
    <div><h2>Scan queue</h2><strong>{q.pending} pending · {q.state}</strong></div>
    <p role="status">{q.lastCaptured?`Last captured: ${q.lastCaptured.id}. `:''}{q.lastSaved?`Last database confirmation: ${q.lastSaved.id} · ${q.lastSaved.direction}.`:'No database confirmation yet.'}</p>
    <p className="queue-explanation">Taps are saved on this device, then sent in order. Wait for a database confirmation before treating a tap as verified.</p>
    {q.error&&<p role="alert">{q.error}</p>}
    {q.unsaved.length>0&&<div role="alert"><strong>{q.unsaved.length} taps NOT saved: {q.unsaved.map(i=>i.id).join(', ')}</strong><p>Keep this window open. Check disk/browser storage, then retry these taps.</p><button onClick={g.retryUnsaved}>Retry unsaved taps</button></div>}
    <div className="actions">{q.state==='Sign in to sync'&&<button onClick={()=>g.setSession(null)}>Sign in again</button>}<button onClick={g.retryQueue}>Retry sync now</button><button onClick={g.downloadQueue}>Export pending taps</button></div>
  </section>;
}
