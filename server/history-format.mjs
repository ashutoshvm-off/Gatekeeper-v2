// Shared by the import preview and server. Dates without an offset are campus time (IST).
export const historyFields={id:'Member ID',name:'Name',department:'Department',role:'Role',sourceId:'Original log ID (optional)',reason:'Reason / notes',timestamp:'Event timestamp / date',time:'Event time (if separate)',direction:'Direction (IN / OUT / DENIED)',checkIn:'Check-in timestamp / date',checkInTime:'Check-in time (if separate)',checkOut:'Check-out timestamp / date',checkOutTime:'Check-out time (if separate)',attempt:'Denied attempt timestamp / date',attemptTime:'Denied attempt time (if separate)'};
const aliases={id:['id','memberid','studentid','staffid','institutionalid','admissionno','admissionnumber','rollno','rollnumber','barcode'],name:['name','studentname','membername'],department:['department','dept','branch'],role:['role','type','membertype'],sourceId:['logid','eventid','visitid'],reason:['reason','notes'],timestamp:['timestamp','capturedat','datetime','date','scandate'],time:['time','scantime'],direction:['direction','action','inout','event'],checkIn:['checkin','checkindate','intimestamp','intime','entrydate','entrytime'],checkInTime:['checkintime'],checkOut:['checkout','checkoutdate','outtimestamp','outtime','exitdate','exittime'],checkOutTime:['checkouttime'],attempt:['attemptdate','attempttimestamp'],attemptTime:['attempttime']};
export function guessHistoryMapping(headers){return Object.fromEntries(Object.entries(aliases).map(([field,names])=>[field,headers.find(h=>names.includes(h.toLowerCase().replace(/[^a-z0-9]/g,'')))||'']));}
const pad=n=>String(n).padStart(2,'0');
export function historyTimestamp(value,time='',format='DMY'){
  if(value===''||value==null){if(time!==''&&time!=null)throw Error('A time needs a date.');return '';}
  let text=String(value).trim();
  if(typeof value==='number'){
    if(value<1||value>2958465)throw Error('Invalid Excel date.');
    text=new Date(Math.round((value-25569)*86400000)).toISOString().slice(0,19);
    if(time!=='')text=text.slice(0,10);
  }
  const zoned=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/i;
  if(zoned.test(text)&&time===''){
    // Validate calendar and clock fields as well as the offset-aware instant.
    historyTimestamp(text.replace(/(Z|[+-]\d{2}:\d{2})$/i,''),'',format);
    const n=Date.parse(text);if(!Number.isFinite(n))throw Error('Invalid timestamp.');return new Date(n).toISOString();
  }
  let datePart=text,clock='';
  const split=text.match(/^(\S+)[T\s]+(.+)$/);if(split){datePart=split[1];clock=split[2];}
  if(time!==''&&time!=null){
    if(clock)throw Error('Choose a full timestamp OR separate date/time columns.');
    if(typeof time==='number'){if(time<0||time>=1)throw Error('Invalid Excel time.');const seconds=Math.round(time*86400);clock=`${pad(Math.floor(seconds/3600))}:${pad(Math.floor(seconds/60)%60)}:${pad(seconds%60)}`;}else clock=String(time).trim();
  }
  const parts=datePart.match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})$/);
  if(!parts)throw Error('Use a full date (YYYY-MM-DD, DD/MM/YYYY or MM/DD/YYYY).');
  let y,m,d;
  if(parts[1].length===4)[y,m,d]=parts.slice(1).map(Number);
  else {if(parts[3].length!==4)throw Error('Use a four-digit year.');y=+parts[3];[d,m]=format==='MDY'?[+parts[2],+parts[1]]:[+parts[1],+parts[2]];}
  if(y<1900||y>2100||m<1||m>12||d<1||new Date(Date.UTC(y,m-1,d)).getUTCMonth()!==m-1)throw Error('Invalid calendar date.');
  const match=clock.match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?\s*(AM|PM)?$/i);
  if(!match)throw Error('Include a time, such as 09:30 or 09:30:00.');
  let hour=+match[1];const min=+match[2],sec=+(match[3]||0),ampm=match[4]?.toUpperCase();
  if(ampm){if(hour<1||hour>12)throw Error('Invalid 12-hour time.');hour=hour%12+(ampm==='PM'?12:0);}
  if(hour>23||min>59||sec>59)throw Error('Invalid clock time.');
  return new Date(`${y}-${pad(m)}-${pad(d)}T${pad(hour)}:${pad(min)}:${pad(sec)}+05:30`).toISOString();
}
function limited(value,label,max=500){const v=String(value??'').trim();if(v.length>max)throw Error(`${label} exceeds ${max} characters.`);return v;}
export function validateHistoryVisit(input){
  if(!input||typeof input!=='object')throw Error('Invalid history record.');
  const row={id:limited(input.id,'Member ID',128).toUpperCase(),name:limited(input.name,'Name'),department:limited(input.department,'Department'),role:limited(input.role,'Role'),sourceId:limited(input.sourceId,'Original log ID'),reason:limited(input.reason,'Reason',2000)};
  if(!row.id)throw Error('Member ID is required.');
  for(const field of ['checkIn','checkOut','attempt']){
    const value=input[field]||'';
    if(value&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)||!Number.isFinite(Date.parse(value))))throw Error('Invalid history timestamp.');
    row[field]=value?historyTimestamp(value):'';
  }
  if(!row.checkIn&&!row.checkOut&&!row.attempt)throw Error('At least one timestamp is required.');
  if(row.attempt&&(row.checkIn||row.checkOut))throw Error('A denied attempt cannot also be a successful visit.');
  if(row.checkIn&&row.checkOut&&row.checkOut<row.checkIn)throw Error('Check-out is before check-in. For overnight visits, include the next date.');
  row.status=row.attempt?'Denied':row.checkIn&&row.checkOut?'Checked out':row.checkIn?'Missing check-out':'Missing check-in';
  return row;
}
export function parseHistory(rows,mapping,{mode='events',dateFormat='DMY'}={}){
  if(!Array.isArray(rows)||!rows.length)throw Error('The file contains no log records.');
  if(!mapping.id)throw Error('Select the member ID column.');
  if(mode==='events'&&(!mapping.timestamp||!mapping.direction))throw Error('Select the event timestamp and direction columns.');
  if(mode==='visits'&&!mapping.checkIn&&!mapping.checkOut&&!mapping.attempt)throw Error('Select at least one visit timestamp column.');
  const errors=[],entries=[],visits=[];
  rows.forEach((raw,index)=>{try{
    const get=key=>mapping[key]?raw[mapping[key]]??'':'';
    const base={};for(const key of ['id','name','department','role','sourceId','reason'])base[key]=get(key);
    const role=String(base.role).toLowerCase();base.role=role==='faculty'?'Staff':['student','staff','librarian'].includes(role)?role[0].toUpperCase()+role.slice(1):base.role;
    if(mode==='visits')visits.push(validateHistoryVisit({...base,checkIn:historyTimestamp(get('checkIn'),get('checkInTime'),dateFormat),checkOut:historyTimestamp(get('checkOut'),get('checkOutTime'),dateFormat),attempt:historyTimestamp(get('attempt'),get('attemptTime'),dateFormat)}));
    else {
      const direction=String(get('direction')).toUpperCase().replace(/[\s_-]/g,'');
      const type=['IN','ENTRY','CHECKIN','CHECKEDIN'].includes(direction)?'IN':['OUT','EXIT','CHECKOUT','CHECKEDOUT'].includes(direction)?'OUT':['DENIED','DENY','REJECTED'].includes(direction)?'DENIED':'';
      if(!type)throw Error('Direction must be IN, OUT or DENIED.');
      const timestamp=historyTimestamp(get('timestamp'),get('time'),dateFormat);
      const canonical=validateHistoryVisit({...base,[type==='IN'?'checkIn':type==='OUT'?'checkOut':'attempt']:timestamp});
      entries.push({...canonical,type,timestamp,index});
    }
  }catch(e){errors.push({row:index+2,message:e.message});}});
  const open=new Map();
  entries.sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.index-b.index);
  // Exact repeated exported events should not break pairing on re-exported files.
  const seen=new Set();
  for(const event of entries){
    const signature=JSON.stringify([event.id,event.type,event.timestamp,event.sourceId]);if(seen.has(signature))continue;seen.add(signature);
    if(event.type==='IN'){if(open.has(event.id))visits.push(open.get(event.id));open.set(event.id,event);}
    else if(event.type==='OUT'&&open.has(event.id)){
      const entry=open.get(event.id);open.delete(event.id);
      visits.push(validateHistoryVisit({...entry,checkOut:event.checkOut,sourceId:entry.sourceId||event.sourceId?JSON.stringify([entry.sourceId,event.sourceId]):'',reason:[entry.reason,event.reason].filter(Boolean).join('; ')}));
    }else visits.push(event);
  }
  visits.push(...open.values());
  return {visits:visits.map(validateHistoryVisit),errors};
}
