import React, {useEffect, useState} from 'react';
import {Provider,useGatekeeper} from './store';
import {Icon} from './components';
import Scanner from './pages/Scanner';
import Logs from './pages/Logs';
import Data from './pages/Data';
import Faculty from './pages/Faculty';
import Admin from './pages/Admin';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import {CollegeLogo} from './college';
import {ManagementMenu,navigationLinks as links} from './Navigation';
import SystemStatus from './SystemStatus';
function Shell() {
  const g=useGatekeeper();
  const [route,setRoute]=useState(()=>location.hash.slice(1)||'scanner');
  const [clock,setClock]=useState(new Date());
  useEffect(()=>{const onHash=()=>setRoute(location.hash.slice(1)||'scanner');window.addEventListener('hashchange',onHash);const timer=setInterval(()=>setClock(new Date()),1000);return()=>{window.removeEventListener('hashchange',onHash);clearInterval(timer);};},[]);
  const pages={scanner:Scanner,logs:Logs,data:Data,faculty:Faculty,admin:Admin};
  const Page=pages[route]||Scanner;
  const protectedRoute=['logs','data','faculty','admin'].includes(route);
  const adminLogin=route==='admin-login'||protectedRoute&&!(g.session?.role==='admin'&&g.session.adminUnlocked);
  useEffect(()=>{
    if(Page===Scanner&&!adminLogin&&g.session?.adminUnlocked)g.setSession(previous=>({...previous,adminUnlocked:false}));
  },[Page,adminLogin,g.session?.adminUnlocked]);
  return <>{!g.session||adminLogin ? (adminLogin?<AdminLogin destination={protectedRoute?route:'admin'}/>:<Login/>) : <div className={`app-shell${Page===Scanner?' scanner-workspace':''}`}>
    <aside className="sidebar"><a href="#scanner" className="brand"><div className="brand-mark"><CollegeLogo/></div><div><strong>GATEKEEPER <b className="brand-version">v2</b><span>ASIET CAMPUS SECURITY</span></strong></div></a><nav className="scanner-navigation" aria-label="Checkpoint navigation"><a href="#scanner" className={Page===Scanner?'active':''}><Icon name="barcode_scanner"/><span>Scanner</span><span className="nav-dot"/></a></nav><SystemStatus/><div className="sidebar-bottom"><ManagementMenu route={route}/><button className="sign-out" onClick={()=>{g.setSession(null);g.setResult(null);location.hash='login';}}><Icon name="logout"/>Sign out</button></div></aside>
    <div className="workspace"><header className="topbar"><div className="breadcrumbs">Campus security <span>/</span><strong>{links.find(x=>x[0]===route)?.[2]||'Scanner'}</strong></div><div className="topbar-right"><span className="clock">{clock.toLocaleTimeString('en-GB',{timeZone:'Asia/Kolkata'})} <small>IST</small></span><span className="divider"/><div className="operator"><strong>{g.session.role==='admin'&&g.session.adminUnlocked?'Administrator':'Scanner operator'}</strong><span>{g.session.id}</span></div><span className="user-avatar"><Icon name="person"/></span></div></header><main><Page/></main><footer><span>© {new Date().getFullYear()} ASIET · Campus Safety Division</span><span><span className="tiny-dot"/> Browser session active <span className="footer-separator">|</span> GATEKEEPER v2</span></footer></div>
  </div>}{g.notice&&<div className="toast" role="status"><Icon name="info"/><span>{g.notice}</span><button aria-label="Dismiss notification" onClick={()=>g.setNotice('')}><Icon name="close" size={18}/></button></div>}</>;
}
export default function App(){return <Provider><Shell/></Provider>;}
