import React,{useEffect,useRef,useState} from 'react';
import {Icon} from './components';

export const navigationLinks=[['scanner','barcode_scanner','Scanner'],['logs','receipt_long','Access logs'],['data','database','Data management'],['faculty','verified_user','Access privileges'],['admin','admin_panel_settings','Administration']];

export function ManagementMenu({route}) {
  const [open,setOpen]=useState(false);
  const root=useRef(null);
  const trigger=useRef(null);
  const firstLink=useRef(null);
  useEffect(()=>setOpen(false),[route]);
  useEffect(()=>{
    if(!open)return;
    firstLink.current?.focus();
    const outside=e=>{if(!root.current?.contains(e.target))setOpen(false);};
    const escape=e=>{if(e.key==='Escape'){e.preventDefault();setOpen(false);trigger.current?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  return <div className="management-menu" ref={root} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}>
    <button ref={trigger} type="button" className="management-trigger" aria-label="Management options" title="Management options" aria-expanded={open} aria-controls="management-links" onClick={()=>setOpen(!open)}>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
    </button>
    {open&&<div id="management-links" className="management-popover"><div className="management-caption"><Icon name="lock" size={14}/>Administrator access</div><nav aria-label="Management navigation">{navigationLinks.slice(1).map(([path,icon,title],index)=><a ref={index===0?firstLink:undefined} key={path} href={`#${path}`} aria-current={route===path?'page':undefined} onClick={()=>setOpen(false)}><Icon name={icon} size={18}/><span>{title}</span></a>)}</nav></div>}
  </div>;
}
