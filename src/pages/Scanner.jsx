import React,{useEffect,useRef,useState} from 'react';
import {useGatekeeper} from '../store';
import QueueStatus from '../QueueStatus';
import {scanInputIssue} from '../scan-input';
import {Icon,Badge,Avatar,Barcode,PageHeading,Modal} from '../components';
import {CollegeLogo, collegeName} from '../college';
export default function Scanner(){
  const g=useGatekeeper();const [inputIssue,setInputIssue]=useState(null);const [flag,setFlag]=useState(false);const input=useRef();
  const [autoScan,setAutoScan]=useState(()=>{try{return localStorage.getItem('gatekeeper-scanner-auto')==='true';}catch{return false;}});
  const scanTimer=useRef(),burst=useRef({last:0,count:0,eligible:false}),submitRef=useRef();
  // Keep the last verification visible while accepting the next scanner input.
  const focusScanner=()=>input.current?.focus({preventScroll:true});
  useEffect(()=>{if(!flag)focusScanner();},[flag]);
  useEffect(()=>{
    const shortcut=e=>{if(e.key==='F2'&&!document.querySelector('dialog[open]')){e.preventDefault();focusScanner();}};
    const resume=()=>{if(!document.querySelector('dialog[open]')&&[document.body,input.current].includes(document.activeElement))focusScanner();};
    window.addEventListener('keydown',shortcut);window.addEventListener('focus',resume);
    return()=>{window.removeEventListener('keydown',shortcut);window.removeEventListener('focus',resume);};
  },[]);
  const clearBurst=()=>{clearTimeout(scanTimer.current);burst.current={last:0,count:0,eligible:false};};
  useEffect(()=>()=>clearTimeout(scanTimer.current),[]);
  function changeScannerMode(checked){
    clearBurst();setAutoScan(checked);
    try{localStorage.setItem('gatekeeper-scanner-auto',String(checked));}catch{}
    focusScanner();
  }
  function scannerInput(event){
    setInputIssue(null);clearTimeout(scanTimer.current);
    const sample=burst.current,value=event.currentTarget.value;
    // This opt-in fallback only accepts a complete fast keyboard burst starting
    // in an empty/selected field. Slow typing, edits and paste still need Enter.
    if(!autoScan||event.nativeEvent.isComposing||!sample.eligible||sample.count<6||sample.count!==value.length)return;
    scanTimer.current=setTimeout(()=>{
      if(input.current?.value===value&&document.activeElement===input.current&&!document.querySelector('dialog[open]'))submitRef.current();
    },300);
  }
  function submitScan(event,allowExactRepeat=false){
    event?.preventDefault();clearBurst();
    const raw=input.current?.value||'';
    const value=raw.trim();
    // Some readers send an extra terminator. An empty submission is not a scan.
    if(!value){focusScanner();return;}
    const issue=scanInputIssue(raw);
    if(issue&&!(allowExactRepeat&&issue.kind==='repeated')){
      setInputIssue(issue);focusScanner();input.current.select();return;
    }
    // Clear synchronously, before capture/storage/network work or a React render.
    input.current.value='';
    setInputIssue(null);
    g.scan(value);
    focusScanner();
  }
  submitRef.current=()=>submitScan();
  function scanKeyDown(event){
    clearTimeout(scanTimer.current);
    if(event.nativeEvent.isComposing||event.ctrlKey||event.altKey||event.metaKey||event.key==='Backspace'||event.key==='Delete'||event.key.startsWith('Arrow'))clearBurst();
    if(event.key.length===1&&!event.repeat&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.nativeEvent.isComposing){
      const field=input.current,now=performance.now(),previous=burst.current;
      const replaces=field.selectionStart===0&&field.selectionEnd===field.value.length;
      const continuing=previous.eligible&&previous.count>0&&now-previous.last<=60&&field.selectionStart===field.value.length&&field.selectionEnd===field.value.length;
      burst.current={last:now,count:continuing?previous.count+1:1,eligible:continuing||replaces};
    }
    if(event.nativeEvent.isComposing||event.keyCode===229||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
    if(event.key!=='Enter'&&event.key!=='Tab')return;
    // Empty Tab retains normal keyboard navigation; an extra Enter is harmless.
    if(event.key==='Tab'&&!input.current?.value.trim())return;
    event.preventDefault();
    if(!event.repeat)submitScan(event);
  }
  function pasteScan(event){
    clearBurst();
    const issue=scanInputIssue(event.clipboardData.getData('text'));
    if(issue?.kind==='multiple'||issue?.kind==='length'){
      event.preventDefault();setInputIssue(issue);focusScanner();input.current.select();
    }
  }
  const result=g.result;const person=result?.person;
  return <><PageHeading eyebrow={`Campus security / ${g.session.gate}`} title="Identity verification" description="Verify campus IDs and record entry or exit automatically."><Badge tone={g.locked?'red':'green'}>{g.locked?'Checkpoint paused':'Checkpoint ready'}</Badge></PageHeading>
    <QueueStatus/>
    <section className="institution-banner"><div className="institution-seal"><CollegeLogo/></div><div><h2>{collegeName}</h2><p><Icon name="location_on" size={15}/> Kalady, Kerala <span>•</span> {g.session.gate} · Main campus</p></div><div className="banner-tag"><Icon name="shield" size={18}/> Campus access control</div></section>
    <div className="scan-grid"><section className="panel scanner-panel"><div className="panel-heading"><h2><Icon name="barcode_scanner"/>Barcode terminal</h2><span className="micro">Continuous scanning</span></div><div className="scanner-visual"><div className="scanner-ready"><i/> Ready to scan</div><div className="scan-frame"><span className="corner tl"/><span className="corner tr"/><span className="corner bl"/><span className="corner br"/><div className="scan-id"><Icon name="barcode" size={65}/><span>Scan an institutional ID</span></div><div className="scan-laser"/></div><div className="scanner-caption">Barcode reader <span>CODE-128</span></div></div><div className="scan-controls"><div className="input-tip"><Icon name="usb" size={17}/> USB keyboard scanners supported</div><form onSubmit={submitScan}><label htmlFor="barcode-input">Barcode or institutional ID <kbd>F2</kbd></label><div className="scan-input"><Icon name="qr_code_scanner"/><input ref={input} id="barcode-input" autoComplete="off" placeholder="Scan or type an ID…" onChange={scannerInput} onBlur={clearBurst} onKeyDown={scanKeyDown} onPaste={pasteScan} aria-invalid={!!inputIssue} aria-describedby={inputIssue?'scan-input-error':'scan-input-help'}/></div><button className="primary scan-button" type="submit"><Icon name="search"/> Verify ID <Icon name="keyboard_return" size={18}/></button></form>{inputIssue&&<div className="scan-input-warning"><p id="scan-input-error" role="alert">{inputIssue.message}</p>{inputIssue.kind==='repeated'&&<><small>Only use the full value if that is the exact ID printed on one card.</small><button type="button" onClick={event=>submitScan(event,true)}>Verify exact full ID</button></>}</div>}<label className="scanner-auto-option"><input type="checkbox" checked={autoScan} onChange={event=>changeScannerMode(event.target.checked)}/>Auto-submit fast scans (reader has no Enter/Tab)</label><p className="helper" id="scan-input-help">{autoScan?'Fast reads of 6 or more characters submit after a short pause. Slow typing and shorter IDs still need Enter. Enter/Tab remains the most reliable scanner setting.':'Set your reader to send Enter or Tab after each barcode. If the ID appears but details do not, press Enter or enable auto-submit above.'} Press F2 to focus the barcode field.</p><div className="try-demo" hidden={g.local}><span>Sample ID</span><button onClick={()=>{input.current.value='ASI22CS084';setInputIssue(null);focusScanner();}}>ASI22CS084 <Icon name="north_west" size={14}/></button></div></div></section>
    <section className={`panel verification-panel ${result?.row.direction==='DENIED'?'is-denied':''}`}><div className="panel-heading"><h2><Icon name="id_card"/>Identity record</h2><span className="micro">Latest verification</span></div>{!result?<div className="awaiting"><div className="awaiting-icon"><Icon name="badge" size={54}/><span><Icon name="check" size={15}/></span></div><h2>Awaiting ID scan</h2><p>Scan an institutional barcode or enter an ID<br/>to verify identity and record campus transit.</p><div className="awaiting-steps"><span><b>01</b> Scan ID</span><Icon name="arrow_forward" size={16}/><span><b>02</b> Verify</span><Icon name="arrow_forward" size={16}/><span><b>03</b> Log transit</span></div><div className="privacy-note"><Icon name="lock" size={15}/> {g.local?(g.cloud?'Cloud database':'Local database')+' · Taps queued on this device':'Demo registry · Records stored on this device'}</div></div>:<><div role="status" aria-live="polite" aria-atomic="true" className={`verification-status ${result.row.direction==='DENIED'?'denied':''}`}><Icon name={result.row.direction==='DENIED'?'gpp_bad':'verified'} size={28}/><div><strong>{result.row.direction==='DENIED'?'Access denied':`Identity verified · ${result.row.direction==='IN'?'Entry':'Exit'} recorded`}</strong><span>{result.reason} · {result.row.time} IST</span></div></div><div className="identity-content">{person?<><div className="identity-name"><Avatar name={person.name}/><div><Badge tone="blue">{person.role}</Badge><h2>{person.name}</h2><p>{person.department}</p></div></div><div className="barcode-block"><Barcode value={person.barcode||person.id}/><div><strong>{person.id}</strong><span>Institutional ID · Code 128</span></div></div><div className="identity-details"><div><label>Course or designation</label><strong>{person.course||person.designation||person.role}</strong></div><div><label>Card status</label><Badge tone={person.status==='ACTIVE'?'green':'red'}>{person.status}</Badge></div><div><label>Access level</label><strong>{person.privilege}</strong></div><div><label>Checkpoint</label><strong>{result.row.gate} · Main campus</strong></div></div></>:<div className="unknown-record"><Icon name="person_off" size={48}/><h2>Unregistered identity</h2><code>{result.row.id}</code><p>This ID could not be matched. The denied attempt has been logged.</p></div>}<div className="identity-actions"><button onClick={()=>setFlag(true)}><Icon name="flag" size={18}/> Flag incident</button><span className="scan-ready-status"><span className="tiny-dot"/>Ready for next scan</span></div></div></>}</section></div>
    {flag&&<Modal title="Record an incident" onClose={()=>setFlag(false)}><form className="record-form" onSubmit={e=>{e.preventDefault();g.flag(result.row.id,new FormData(e.currentTarget).get('reason'));setFlag(false);}}><p>Attach a note to {result.row.id}.</p><label>Incident details<textarea name="reason" required minLength={5}/></label><button className="primary">Save incident</button></form></Modal>}
  </>;
}
