import React, {useEffect, useRef} from 'react';
import JsBarcode from 'jsbarcode';
import {MEMBER_ROLES,MEMBER_CODE_PATTERN} from './domain';
const paths={
  shield_lock:'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z M9 12h6v5H9z M10 12v-2a2 2 0 0 1 4 0v2',
  shield:'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z',
  verified_user:'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z M8 12l3 3 5-6',
  gpp_bad:'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z M9 10l6 6m0-6-6 6',
  gpp_maybe:'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z M12 8v5m0 3v.1',
  barcode_scanner:'M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5M7 7v10m3-10v10m4-10v10m3-10v10M2 12h20',
  qr_code_scanner:'M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5M7 7h3v3H7z M14 7h3v3h-3z M7 14h3v3H7z M14 14v3h3v-3',
  barcode:'M3 4v16m3-16v16m2-16v16m4-16v16m3-16v16m2-16v16m4-16v16',
  receipt_long:'M5 3l2 2 2-2 3 2 3-2 2 2 2-2v18l-2-2-2 2-3-2-3 2-2-2-2 2V3Z M9 9h6m-6 4h6m-6 4h3',
  database:'M20 5c0 2-4 3-8 3S4 7 4 5s4-3 8-3 8 1 8 3Z M4 5v14c0 2 4 3 8 3s8-1 8-3V5M4 12c0 2 4 3 8 3s8-1 8-3',
  admin_panel_settings:'M10 3 2 7v5c0 4 8 9 8 9l2-1M10 3l8 4v4 M18 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z M14 22v-2a4 4 0 0 1 8 0v2',
  location_on:'M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 0 1 14 0Z M15 10a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z',
  logout:'M9 3H4v18h5m6-15 6 6-6 6m-7-6h13',
  login:'M15 3h5v18h-5M9 6l6 6-6 6M3 12h12',
  person:'M16 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z M4 21v-2a8 6 0 0 1 16 0v2H4Z',
  person_add:'M14 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z M2 21v-2a8 6 0 0 1 13-5M19 14v8m-4-4h8',
  person_off:'M3 3l18 18M9 3a4 4 0 0 1 6 5M5 14c-2 1-3 3-3 7h13',
  groups:'M15 7a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z M5 21v-3a7 5 0 0 1 14 0v3H5Z M18 5a3 3 0 0 1 0 6m1 3c3 0 4 2 4 6M6 5a3 3 0 0 0 0 6m-1 3c-3 0-4 2-4 6',
  school:'m2 9 10-5 10 5-10 5-10-5Z M6 11v6c4 3 8 3 12 0v-6m4-2v8',
  badge:'M9 3h6v5H9z M9 5H4v16h16V5h-5M10 12a2 2 0 1 0-4 0 2 2 0 0 0 4 0Z M6 18v-1a2 2 0 0 1 4 0v1m4-6h3m-3 4h3',
  id_card:'M3 5h18v14H3z M10 10a2 2 0 1 0-4 0 2 2 0 0 0 4 0Z M5 17v-1a3 3 0 0 1 6 0v1m3-7h4m-4 4h4',
  science:'M9 3h6m-5 0v7L4 20c-1 1 0 2 1 2h14c1 0 2-1 1-2l-6-10V3M7 15h10',
  check:'m5 12 4 4L19 6',verified:'m3 12 6 6L21 5',
  lock:'M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4m-4 4v3',
  lock_open:'M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0m-4 8v3',
  info:'M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0Z M12 11v6m0-10v.1',
  search:'M17 10a7 7 0 1 0-14 0 7 7 0 0 0 14 0Z m-2 5 6 6',
  manage_search:'M14 10a5 5 0 1 0-10 0 5 5 0 0 0 10 0Z m-2 4 5 5m1-12h4m-4 4h4m-3 4h3',
  arrow_forward:'M4 12h16m-6-6 6 6-6 6',north_west:'M18 18 6 6m0 9V6h9',keyboard_return:'M20 5v8H4m5-5-5 5 5 5',
  close:'m6 6 12 12m0-12L6 18',chevron_left:'m15 5-7 7 7 7',chevron_right:'m9 5 7 7-7 7',
  download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',file_download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',upload:'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
  upload_file:'M14 2H4v20h16V8l-6-6v6h6M12 19v-8m-3 3 3-3 3 3',
  picture_as_pdf:'M14 2H4v20h16V8l-6-6v6h6M8 17c4-1 4-6 3-7-2 2 0 6 5 7',
  flag:'M5 22V3m0 1c5-4 8 4 15 0v11c-7 4-10-4-15 0',
  table_chart:'M3 4h18v16H3z M3 10h18M9 10v10m6-10v10',
  print:'M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v8H6z M17 11h1',
  edit_square:'M12 3H3v18h18v-9M8 16l1-5L19 1l4 4-10 10-5 1Z',
  tune:'M3 6h6m4 0h8M3 12h12m4 0h2M3 18h3m4 0h11M9 3v6m6 0v6m-9 0v6',
  history:'M3 10a9 9 0 1 1 0 7M3 3v7h7m2-4v7l4 2',
  inventory_2:'M3 3h18v5H3z M5 8v13h14V8M9 12h6',
  fact_check:'M3 3h18v18H3z M6 7h4m-4 5h4m-4 5h4m3-6 2 2 4-5',
  filter_alt_off:'m3 3 18 18M6 3h15l-7 8m0 7v3l-4-2v-8L3 4',
  visibility:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z',
  visibility_off:'m3 3 18 18M6 6C3 8 2 12 2 12s4 7 10 7c2 0 4-1 5-2M10 5c7-1 12 7 12 7l-3 4',
  usb:'M12 21V3m-3 3 3-3 3 3M12 16l-6-4V8m6 5 6-4V6M4 8h4m8-3h4v3h-4z',
};
export function Icon({name,size=20}) {return <svg aria-hidden="true" className="material-symbols-outlined" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" style={{fontSize:size}}><path d={paths[name]||paths.shield}/></svg>;}
export function Badge({children, tone='neutral'}) {return <span className={`badge ${tone}`}><i />{children}</span>;}
export function Avatar({name=''}) {return <span className="avatar">{name.split(' ').filter(Boolean).slice(0,2).map(p=>p[0]).join('')}</span>;}
export function Barcode({value}) {
  const ref=useRef();
  useEffect(()=>{if(value) JsBarcode(ref.current,value,{height:42,width:1.5,displayValue:false,margin:0,lineColor:'#0f2042'});},[value]);
  return <svg ref={ref} className="barcode" role="img" aria-label={`Barcode for ${value}`} />;
}
export function PageHeading({eyebrow, title, description, children}) {return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div><div className="actions">{children}</div></div>;}
export function Empty({text='No matching records', description='Try a different search or adjust the filters.'}) {return <div className="empty"><Icon name="manage_search" size={36}/><h3>{text}</h3><p>{description}</p></div>;}
export function Search({value,onChange,placeholder='Search name, ID or department…'}) {return <label className="search"><Icon name="search"/><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}/></label>;}
export function Modal({title, children, onClose}) {
  const ref=useRef();
  useEffect(()=>{const dialog=ref.current; dialog.showModal(); return ()=>dialog.close();},[]);
  return <dialog ref={ref} onCancel={onClose} onClick={e=>{if(e.target===ref.current)onClose();}}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close"/></button></div>{children}</dialog>;
}
export function RecordForm({record={},onSave,onClose,existing=[]}) {
  const [error,setError]=React.useState('');
  return <Modal title={record.id?'Edit campus record':'Register campus member'} onClose={onClose}><form className="record-form" onSubmit={async e=>{e.preventDefault(); const fields=Object.fromEntries(new FormData(e.currentTarget)); if(!record.id&&existing.some(r=>r.id===fields.id.trim().toUpperCase()))return setError('This ID is already registered.'); try{const saved=await onSave({...record,...fields});if(saved!==false)onClose();}catch(err){setError(err.message);}}}>
    <label>Full name<input name="name" defaultValue={record.name} required maxLength={100}/></label><label>Institutional ID<input name="id" defaultValue={record.id} readOnly={!!record.id} required pattern={MEMBER_CODE_PATTERN} placeholder="ASI24CS001"/></label>
    <label>Card barcode (optional)<input name="barcode" defaultValue={record.barcode||''} pattern={MEMBER_CODE_PATTERN} minLength={3} maxLength={64} placeholder="Defaults to institutional ID"/></label><small>Use the value produced by the physical card scanner if it differs from the institutional ID.</small><div className="form-grid"><label>Role<select name="role" aria-label="Role" required defaultValue={record.role ?? 'Student'}><option value="" disabled>Select role</option>{MEMBER_ROLES.map(x=><option key={x}>{x}</option>)}</select></label><label>Card status<select name="status" defaultValue={record.status||'ACTIVE'}><option>ACTIVE</option><option>SUSPENDED</option></select></label></div>
    <label>Department<input name="department" defaultValue={record.department} required maxLength={120}/></label><label>Course / designation<input name="course" defaultValue={record.course||record.designation} maxLength={120}/></label><label>Access privilege<input name="privilege" defaultValue={record.privilege||'Campus access'} required maxLength={150}/></label>
    {error&&<p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" type="submit">Save record</button></div>
  </form></Modal>;
}
