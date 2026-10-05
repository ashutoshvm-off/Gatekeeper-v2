import {readFileSync} from 'node:fs';
const schema=readFileSync(new URL('./schema.sql',import.meta.url),'utf8');
import {DatabaseSync, backup} from 'node:sqlite';
import {mkdirSync, statSync, statfsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {normalizeRecords} from '../src/domain.js';
import {memberDeletion,checkedInMessage} from './member-delete.mjs';
import {historyStatements,historyOrder} from './history-import.mjs';

export class Store {
  constructor(path) {
    this.path = path;
    mkdirSync(dirname(path), {recursive:true});
    this.db = new DatabaseSync(path, {timeout:5000});
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA user_version=1;
${schema}`);
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const value=fn(); this.db.exec('COMMIT'); return value; }
    catch(error) {this.db.exec('ROLLBACK'); throw error;}
  }
  get locked() {return this.db.prepare("SELECT value FROM settings WHERE key='locked'").get().value==='true';}
  set locked(value) {this.db.prepare("UPDATE settings SET value=? WHERE key='locked'").run(String(!!value));}
  getLocked() {return this.locked;}
  setCheckpoint(locked,actor) {return this.transaction(()=>{this.locked=locked;this.incident('SYSTEM',`${actor} ${locked?'paused':'resumed'} checkpoint`);return {locked:this.locked};});}
  members() {return this.db.prepare('SELECT data FROM members ORDER BY id').all().map(r=>JSON.parse(r.data));}
  deleteMember(id,actor) {
    const statements=memberDeletion(id,actor);
    return this.transaction(()=>{
      if(this.db.prepare(statements[0].sql).get(...statements[0].args))throw Error(checkedInMessage);
      const deleted=Number(this.db.prepare(statements[1].sql).run(...statements[1].args).changes)>0;
      this.db.prepare(statements[2].sql).run(...statements[2].args);
      return {deleted};
    });
  }
  saveMembers(rows, overwrite=true) {
    if(!Array.isArray(rows)||rows.length>1000)throw Error('Send at most 1,000 members per batch.');
    const normalized=normalizeRecords(rows);
    const save=this.db.prepare(`INSERT INTO members VALUES(?,?,?) ${overwrite?'ON CONFLICT(id) DO UPDATE SET barcode=excluded.barcode,data=excluded.data':'ON CONFLICT(id) DO NOTHING'}`);
    const exists=this.db.prepare('SELECT 1 FROM members WHERE id=?');
    return this.transaction(()=>{
      let created=0,updated=0,skipped=0;
      for(let i=0;i<normalized.length;i++) {
        const row={...normalized[i],afterHours:!!rows[i].afterHours,protocol:String(rows[i].protocol||'Instant Pass (No Prompt)').slice(0,100)};
        if(Object.values(row).some(v=>typeof v==='string'&&v.length>500))throw Error('Member fields must be at most 500 characters.');
        const collision=this.db.prepare('SELECT id FROM members WHERE (id=? OR barcode=?) AND id<>?').get(row.barcode,row.id,row.id);
        if(collision)throw Error('A barcode conflicts with another member ID or barcode.');
        const had=!!exists.get(row.id);
        save.run(row.id,row.barcode,JSON.stringify(row));
        if(had){if(overwrite)updated++;else skipped++;}else created++;
      }
      return {saved:normalized.length,created,updated,skipped};
    });
  }
  scans(items, actor) {
    if(!Array.isArray(items)||!items.length||items.length>25)throw Error('A scan batch must contain 1–25 taps.');
    for(const item of items) {
      if(!/^[\w-]{10,100}$/.test(item.key)||!/^[\w-]{10,100}$/.test(item.client)||!Number.isSafeInteger(item.seq)||item.seq<1||
        typeof item.id!=='string'||!item.id.trim()||item.id.length>128||!Number.isFinite(Date.parse(item.capturedAt)))throw Error('Invalid queued scan.');
    }
    return this.transaction(()=>items.map(item=>{
      const existing=this.db.prepare('SELECT * FROM events WHERE key=? OR (client=? AND client_seq=?)').get(item.key,item.client,item.seq);
      if(existing) {
        const result=JSON.parse(existing.result);
        if(existing.key!==item.key||existing.client!==item.client||existing.client_seq!==item.seq||result.input!==item.id||existing.captured_at!==item.capturedAt)throw Error('Scan identity conflict; queue retained for investigation.');
        return result;
      }
      const last=this.db.prepare('SELECT MAX(client_seq) AS seq FROM events WHERE client=?').get(item.client).seq;
      if(last!==null&&item.seq<=last)throw Error('Scan sequence is out of order.');
      const id=item.id.trim().toUpperCase();
      const member=this.db.prepare('SELECT data FROM members WHERE id=? OR barcode=?').get(id,id);
      const person=member?JSON.parse(member.data):null;
      const open=person?this.db.prepare("SELECT key FROM visits WHERE id=? AND status='Checked in'").get(person.id):null;
      const direction=this.locked||!person||!person.role||person.status!=='ACTIVE'?'DENIED':open?'OUT':'IN';
      const reason=this.locked?'Checkpoint paused by administrator':!person?'ID not found in the registry':person.status!=='ACTIVE'?'This access pass is suspended':'Identity matched to the campus registry';
      const captured=new Date(item.capturedAt);
      const row={key:item.key,id:person?.id||id,name:person?.name||'Unregistered ID',department:person?.department||'Unknown',role:person?.role||'',direction,
        date:captured.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}),time:captured.toLocaleTimeString('en-GB',{timeZone:'Asia/Kolkata'}),
        capturedAt:item.capturedAt,receivedAt:new Date().toISOString(),operator:actor,gate:'Gate 1',source:'Barcode / manual input',reason};
      const result={key:item.key,input:item.id,person,row,reason};
      const inserted=this.db.prepare('INSERT INTO events(key,client,client_seq,captured_at,received_at,member_id,direction,result) VALUES(?,?,?,?,?,?,?,?)')
        .run(item.key,item.client,item.seq,item.capturedAt,row.receivedAt,row.id,direction,JSON.stringify(result));
      const seq=Number(inserted.lastInsertRowid);
      if(direction==='OUT')this.db.prepare("UPDATE visits SET checkOutDate=?,checkOutTime=?,status='Checked out',updated=? WHERE key=?").run(row.date,row.time,seq,open.key);
      else this.db.prepare('INSERT INTO visits(key,id,name,department,role,checkInDate,checkInTime,attemptDate,attemptTime,status,reason,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(row.key,row.id,row.name,row.department,row.role,direction==='IN'?row.date:'',direction==='IN'?row.time:'',direction==='DENIED'?row.date:'',direction==='DENIED'?row.time:'',direction==='IN'?'Checked in':'Denied',reason,seq);
      return result;
    }));
  }
  importHistory(rows,actor) {
    const groups=historyStatements(rows,actor);
    return this.transaction(()=>{
      let imported=0;
      for(const statements of groups)for(const [i,statement] of statements.entries()){
        const result=this.db.prepare(statement.sql).run(...statement.args);
        if(i===statements.length-1)imported+=Number(result.changes);
      }
      return {imported,duplicates:rows.length-imported};
    });
  }
  visits(filters={}, limit=50, offset=0) {
    const where=[],args=[];
    if(filters.query){where.push('(instr(lower(name),lower(?))>0 OR instr(lower(id),lower(?))>0 OR instr(lower(department),lower(?))>0)');args.push(filters.query,filters.query,filters.query);}
    for(const field of ['role','status'])if(filters[field]){where.push(`${field}=?`);args.push(filters[field]);}
    if(filters.date){where.push('(checkInDate=? OR checkOutDate=? OR attemptDate=?)');args.push(filters.date,filters.date,filters.date);}
    const clause=where.length?' WHERE '+where.join(' AND '):'';
    const total=this.db.prepare('SELECT COUNT(*) AS count FROM visits'+clause).get(...args).count;
    const rows=this.db.prepare('SELECT * FROM visits'+clause+' ORDER BY '+historyOrder+' LIMIT ? OFFSET ?').all(...args,limit,offset).map(({updated,...r})=>({...r,gate:'Gate 1'}));
    return {rows,total};
  }
  incident(id,reason) {
    const row={key:randomUUID(),id:String(id).slice(0,128),reason:String(reason).slice(0,2000),time:new Date().toISOString()};
    this.db.prepare('INSERT INTO incidents VALUES(?,?)').run(row.key,JSON.stringify(row));return row;
  }
  incidents() {return this.db.prepare('SELECT data FROM incidents ORDER BY rowid DESC LIMIT 1000').all().map(r=>JSON.parse(r.data));}
  status() {
    this.db.prepare('SELECT 1').get();
    let storage=null;
    try {const s=statfsSync(dirname(this.path));storage={usedBytes:(s.blocks-s.bfree)*s.bsize,totalBytes:s.blocks*s.bsize};}catch{}
    const databaseBytes=[this.path,this.path+'-wal'].reduce((sum,p)=>{try{return sum+statSync(p).size;}catch{return sum;}},0);
    const completed=this.db.prepare("SELECT value FROM settings WHERE key='cloud_transfer'").get();
    const report=completed?JSON.parse(completed.value):null;
    const transfer=report?{completedAt:report.completedAt,source:report.source,cleanup:report.cleanup?{status:report.cleanup.status,completedAt:report.cleanup.completedAt,lastError:report.cleanup.lastError}:null,counts:Object.fromEntries(Object.entries(report.tables).map(([table,value])=>[table,value.count]))}:null;
    return {server:{status:'online'},database:{status:'connected',engine:'SQLite',bytes:databaseBytes},storage,transfer};
  }
  databaseSummary(){return {...this.db.prepare('SELECT (SELECT COUNT(*) FROM members) members,(SELECT COUNT(*) FROM events) events,(SELECT COUNT(*) FROM visits) visits,(SELECT COUNT(*) FROM incidents) incidents').get(),retired:false};}
  async clearDatabase({actor,operationId}){
    const prior=this.db.prepare("SELECT value FROM settings WHERE key='last_database_clear'").get();
    if(prior&&JSON.parse(prior.value).operationId===operationId)return JSON.parse(prior.value);
    if(!this.locked)throw Error('Pause the checkpoint and finish all pending queues before clearing the database.');
    const backupPath=await this.backup();
    return this.transaction(()=>{
      if(!this.locked)throw Error('Checkpoint resumed during backup. Nothing was cleared.');
      this.db.exec('DELETE FROM visits; DELETE FROM events; DELETE FROM members; DELETE FROM incidents;');
      const report={cleared:true,actor,operationId,completedAt:new Date().toISOString(),backupPath};
      this.db.prepare("INSERT INTO settings(key,value) VALUES('last_database_clear',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(report));
      return report;
    });
  }
  async backup() {
    const directory=join(dirname(this.path),'backups');mkdirSync(directory,{recursive:true});
    const path=join(directory,`gatekeeper-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`);
    await backup(this.db,path);return path;
  }
  close(){this.db.close();}
}
