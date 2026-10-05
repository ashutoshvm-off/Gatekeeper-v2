import {createHash} from 'node:crypto';
import {validateHistoryVisit} from './history-format.mjs';
export const historyOrder="max(checkInDate || ' ' || checkInTime,checkOutDate || ' ' || checkOutTime,attemptDate || ' ' || attemptTime) DESC, updated DESC";
export function historyStatements(rows,actor){
  if(!Array.isArray(rows)||!rows.length||rows.length>100)throw Error('Import 1–100 visits per batch.');
  return rows.map(validateHistoryVisit).map(row=>{
    const key='history-'+createHash('sha256').update(JSON.stringify([row.id,row.sourceId,row.checkIn,row.checkOut,row.attempt])).digest('hex');
    const receivedAt=new Date().toISOString(),statements=[];
    const visit={key,id:row.id,name:row.name||row.id,department:row.department||'Unknown',role:row.role,checkInDate:'',checkInTime:'',checkOutDate:'',checkOutTime:'',attemptDate:'',attemptTime:'',status:row.status,reason:row.reason};
    let seq=0;
    for(const [field,direction] of [['checkIn','IN'],['checkOut','OUT'],['attempt','DENIED']]){
      if(!row[field])continue;
      const captured=new Date(row[field]),date=captured.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}),time=captured.toLocaleTimeString('en-GB',{timeZone:'Asia/Kolkata'});
      visit[field+'Date']=date;visit[field+'Time']=time;
      const eventKey=key+'-'+direction,event={key:eventKey,id:row.id,name:visit.name,department:visit.department,role:row.role,direction,date,time,capturedAt:row[field],receivedAt,operator:actor,gate:'Gate 1',source:'Historical log import',originalLogId:row.sourceId,reason:row.reason};
      statements.push({sql:'INSERT INTO events(key,client,client_seq,captured_at,received_at,member_id,direction,result) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(key) DO NOTHING',args:[eventKey,key,++seq,row[field],receivedAt,row.id,direction,JSON.stringify({key:eventKey,input:row.id,person:null,row:event,reason:row.reason})]});
    }
    const columns=Object.keys(visit);
    statements.push({sql:`INSERT INTO visits(${columns.join(',')},updated) VALUES(${columns.map(()=>'?').join(',')},(SELECT MAX(seq) FROM events WHERE client=?)) ON CONFLICT(key) DO NOTHING`,args:[...Object.values(visit),key]});
    return statements;
  });
}
