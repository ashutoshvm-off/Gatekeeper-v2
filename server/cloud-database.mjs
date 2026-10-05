import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {normalizeRecords} from '../src/domain.js';
import {memberDeletion,checkedInMessage} from './member-delete.mjs';
import {historyStatements,historyOrder} from './history-import.mjs';
const schema=readFileSync(new URL('./schema.sql',import.meta.url),'utf8');
const triggers=readFileSync(new URL('./cloud-scans.sql',import.meta.url),'utf8');
const revisions=readFileSync(new URL('./cloud-revision.sql',import.meta.url),'utf8');
export class CloudStore {
  constructor(client){this.client=client;this.engine='Turso';}
  async ready(){
    if(!this.initializing)this.initializing=(async()=>{await this.client.executeMultiple(schema);await this.client.executeMultiple(triggers);await this.client.executeMultiple(revisions);})().catch(error=>{this.initializing=null;throw error;});
    await this.initializing;
  }
  async execute(sql,args=[]){await this.ready();return this.client.execute({sql,args});}
  async getLocked(){return (await this.execute("SELECT value FROM settings WHERE key='locked'")).rows[0].value==='true';}
  async members(){return (await this.execute('SELECT data FROM members ORDER BY id')).rows.map(r=>JSON.parse(r.data));}
  async deleteMember(id,actor){
    const statements=memberDeletion(id,actor);await this.ready();
    const results=await this.client.batch(statements,'write');
    if(results[0].rows.length)throw Error(checkedInMessage);
    return {deleted:Number(results[1].rowsAffected)>0};
  }
  async saveMembers(rows,overwrite=true){
    if(!Array.isArray(rows)||rows.length>1000)throw Error('Send at most 1,000 members per batch.');
    const normalized=normalizeRecords(rows).map((r,i)=>({...r,afterHours:!!rows[i].afterHours,protocol:String(rows[i].protocol||'Instant Pass (No Prompt)').slice(0,100)}));
    if(normalized.some(r=>Object.values(r).some(v=>typeof v==='string'&&v.length>500)))throw Error('Member fields must be at most 500 characters.');
    await this.ready();
    let existingCount=0;
    if(normalized.length){
      const ids=normalized.map(r=>r.id);
      const placeholders=ids.map(()=>'?').join(',');
      const existing=await this.execute(`SELECT id FROM members WHERE id IN (${placeholders})`,ids);
      existingCount=existing.rows.length;
      await this.client.batch(normalized.map(r=>({sql:`INSERT INTO members VALUES(?,?,?) ${overwrite?'ON CONFLICT(id) DO UPDATE SET barcode=excluded.barcode,data=excluded.data':'ON CONFLICT(id) DO NOTHING'}`,args:[r.id,r.barcode,JSON.stringify(r)]})),'write');
    }
    const created=normalized.length-existingCount;
    return {saved:normalized.length,created,updated:overwrite?existingCount:0,skipped:overwrite?0:existingCount};
  }
  async scans(items,actor){
    if(!Array.isArray(items)||!items.length||items.length>25)throw Error('A scan batch must contain 1–25 taps.');
    const inserts=items.map(item=>{
      if(!/^[\w-]{10,100}$/.test(item.key)||!/^[\w-]{10,100}$/.test(item.client)||!Number.isSafeInteger(item.seq)||item.seq<1||typeof item.id!=='string'||!item.id.trim()||item.id.length>128||!Number.isFinite(Date.parse(item.capturedAt)))throw Error('Invalid queued scan.');
      const captured=new Date(item.capturedAt);
      return {sql:`INSERT INTO scan_inbox VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT DO UPDATE SET key=
        CASE WHEN scan_inbox.key=excluded.key AND scan_inbox.client=excluded.client AND scan_inbox.client_seq=excluded.client_seq
          AND scan_inbox.input=excluded.input AND scan_inbox.captured_at=excluded.captured_at THEN scan_inbox.key ELSE NULL END`,
        args:[item.key,item.client,item.seq,item.id,item.capturedAt,new Date().toISOString(),captured.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}),captured.toLocaleTimeString('en-GB',{timeZone:'Asia/Kolkata'}),actor]};
    });
    await this.ready();
    const results=await this.client.batch([...inserts,...items.map(item=>({sql:'SELECT result FROM events WHERE key=?',args:[item.key]}))],'write');
    return results.slice(items.length).map(r=>JSON.parse(r.rows[0].result));
  }
  async importHistory(rows,actor){
    const statements=historyStatements(rows,actor).flat();
    await this.ready();
    const results=await this.client.batch(statements,'write');
    const imported=results.reduce((sum,result,i)=>sum+(statements[i].sql.startsWith('INSERT INTO visits(')?Number(result.rowsAffected):0),0);
    return {imported,duplicates:rows.length-imported};
  }
  async visits(filters={},limit=50,offset=0){
    const where=[],args=[];
    if(filters.query){where.push('(instr(lower(name),lower(?))>0 OR instr(lower(id),lower(?))>0 OR instr(lower(department),lower(?))>0)');args.push(filters.query,filters.query,filters.query);}
    for(const field of ['role','status'])if(filters[field]){where.push(`${field}=?`);args.push(filters[field]);}
    if(filters.date){where.push('(checkInDate=? OR checkOutDate=? OR attemptDate=?)');args.push(filters.date,filters.date,filters.date);}
    const clause=where.length?' WHERE '+where.join(' AND '):'';
    await this.ready();const [count,records]=await this.client.batch([{sql:'SELECT COUNT(*) AS count FROM visits'+clause,args},{sql:'SELECT * FROM visits'+clause+' ORDER BY '+historyOrder+' LIMIT ? OFFSET ?',args:[...args,limit,offset]}],'read');
    return {total:Number(count.rows[0].count),rows:records.rows.map(({updated,...r})=>({...r,gate:'Gate 1'}))};
  }
  async incident(id,reason){const row={key:randomUUID(),id:String(id).slice(0,128),reason:String(reason).slice(0,2000),time:new Date().toISOString()};await this.execute('INSERT INTO incidents VALUES(?,?)',[row.key,JSON.stringify(row)]);return row;}
  async incidents(){return (await this.execute('SELECT data FROM incidents ORDER BY rowid DESC LIMIT 1000')).rows.map(r=>JSON.parse(r.data));}
  async setCheckpoint(locked,actor){
    await this.ready();const row={key:randomUUID(),id:'SYSTEM',reason:`${actor} ${locked?'paused':'resumed'} checkpoint`,time:new Date().toISOString()};
    await this.client.batch([{sql:"UPDATE settings SET value=? WHERE key='locked'",args:[String(locked)]},{sql:'INSERT INTO incidents VALUES(?,?)',args:[row.key,JSON.stringify(row)]}],'write');return {locked};
  }
  async status(){await this.execute('SELECT 1');return {server:{status:'online'},database:{status:'connected',engine:'Turso'},storage:null};}
  async clearAll(actor){
    await this.ready();
    const row={key:randomUUID(),id:'SYSTEM',reason:`${actor} cleared all data from the database`,time:new Date().toISOString()};
    await this.client.batch([
      {sql:'DELETE FROM scan_inbox',args:[]},
      {sql:'DELETE FROM members',args:[]},
      {sql:'DELETE FROM events',args:[]},
      {sql:'DELETE FROM visits',args:[]},
      {sql:'DELETE FROM incidents',args:[]},
      {sql:"UPDATE settings SET value='false' WHERE key='locked'",args:[]},
      {sql:'INSERT INTO incidents VALUES(?,?)',args:[row.key,JSON.stringify(row)]}
    ],'write');
    return {cleared:true};
  }
  async backup(){throw Error('Use the Turso dashboard/CLI to back up the cloud database. Local backup applies only to SQLite installations.');}
  close(){this.client.close();}
}
