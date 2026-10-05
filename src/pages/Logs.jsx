import React,{useEffect,useMemo,useState} from 'react';
import {api} from '../local-store';
import {useGatekeeper} from '../store';
import {CHECKPOINT,MEMBER_ROLES,pairVisits,filterVisits} from '../domain';
import {Icon,Badge,Avatar,PageHeading,Search,Empty} from '../components';

const emptyFilters={query:'',role:'',status:'',date:''};
function VisitTime({date,time,placeholder='—'}) {
  return time?<><code>{time}</code><small>{date}</small></>:<span className="visit-pending">{placeholder}</span>;
}
export default function Logs(){
  const g=useGatekeeper();
  const [filters,setFilters]=useState(emptyFilters);
  const [page,setPage]=useState(1);
  const [remote,setRemote]=useState({rows:[],total:0});
  const [loading,setLoading]=useState(false);
  useEffect(()=>{
    if(!g.local)return;
    let alive=true;setLoading(true);
    api('/visits?'+new URLSearchParams({...filters,offset:(page-1)*10,limit:10})).then(data=>{if(alive)setRemote(data);}).catch(e=>{if(alive){setRemote({rows:[],total:0});g.setNotice(e.message);}}).finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[g.local,filters,page,g.revision]);
  const visits=useMemo(()=>pairVisits(g.logs),[g.logs]);
  const rows=g.local?remote.rows:filterVisits(visits,filters);
  const count=g.local?remote.total:rows.length;
  const total=Math.max(1,Math.ceil(count/10));
  const current=Math.min(page,total);
  function change(key,value){setFilters({...filters,[key]:value});setPage(1);}
  return <>
    <PageHeading eyebrow="Security reporting" title="Access logs" description="Check-in and check-out are recorded together for each visit.">
      <button onClick={()=>g.local?g.exportVisits(filters,'pdf'):g.download(rows,'pdf','gatekeeper-audit')}><Icon name="picture_as_pdf"/>Audit PDF</button>
      <button className="primary" onClick={()=>g.local?g.exportVisits(filters):g.download(rows,'csv','gatekeeper-transit')}><Icon name="download"/>Export CSV</button>
    </PageHeading>
    <section className="panel">
      <div className="table-toolbar"><Search value={filters.query} onChange={value=>change('query',value)}/><div className="actions"><Badge>{CHECKPOINT}</Badge><Badge tone="blue">{count} RECORDS</Badge>{loading&&<span>Loading…</span>}</div></div>
      <div className="filters">
        <select aria-label="Filter role" value={filters.role} onChange={e=>change('role',e.target.value)}><option value="">All roles</option>{MEMBER_ROLES.map(x=><option key={x}>{x}</option>)}</select>
        <select aria-label="Filter visit status" value={filters.status} onChange={e=>change('status',e.target.value)}><option value="">All visit statuses</option>{['Checked in','Checked out','Denied','Missing check-in','Missing check-out'].map(x=><option key={x}>{x}</option>)}</select>
        <input type="date" aria-label="Filter date" value={filters.date} onChange={e=>change('date',e.target.value)}/>
        <button onClick={()=>{setFilters(emptyFilters);setPage(1);}}><Icon name="filter_alt_off" size={17}/>Reset</button>
      </div>
      <div className="table-scroll"><table><thead><tr>{['Campus member','Institutional ID','Department','Check-in','Check-out','Visit status'].map(x=><th key={x}>{x}</th>)}</tr></thead>
        <tbody>{(g.local?rows:rows.slice((current-1)*10,current*10)).map(r=><tr key={r.key}>
          <td><div className="person-cell"><Avatar name={r.name}/><div><strong>{r.name}</strong><span>{r.role||'—'}</span></div></div></td>
          <td><code>{r.id}</code></td><td>{r.department}</td>
          <td><VisitTime date={r.checkInDate} time={r.checkInTime}/></td>
          <td><VisitTime date={r.checkOutDate} time={r.checkOutTime} placeholder={r.status==='Checked in'?'Not yet checked out':'—'}/></td>
          <td><Badge tone={r.status==='Checked in'?'green':r.status==='Checked out'?'blue':r.status==='Denied'?'red':'amber'}>{r.status}</Badge>{r.status==='Denied'&&<small title={r.reason}>Attempt: {r.attemptDate} · {r.attemptTime}</small>}</td>
        </tr>)}</tbody></table></div>
      {!rows.length&&<Empty/>}
      <div className="pagination"><span>{count?`${(current-1)*10+1}–${Math.min(current*10,count)}`:'0'} of {count} records</span><div><button aria-label="Previous page" disabled={current===1} onClick={()=>setPage(current-1)}><Icon name="chevron_left"/></button><span>Page {current} of {total}</span><button aria-label="Next page" disabled={current===total} onClick={()=>setPage(current+1)}><Icon name="chevron_right"/></button></div></div>
    </section>
    <div className="footnote"><Icon name="info" size={17}/>Each visit has one row. Exports include both timestamps. Date filters match either day of an overnight visit.</div>
  </>;
}
