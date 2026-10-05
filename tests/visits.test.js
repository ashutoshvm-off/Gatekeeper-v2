import test from 'node:test';
import assert from 'node:assert/strict';
import {pairVisits,filterVisits,normalizeRecords,migrateMember,migrateLog} from '../src/domain.js';

const event=(key,id,direction,date,time)=>({key,id,direction,date,time,name:id,role:'Student',department:'CS',gate:'Gate 1'});
test('each complete visit pairs separately, including overnight and denied interruptions',()=>{
  const chronological=[
    event('a','A','IN','2026-09-30','23:00:00'),
    event('b','B','IN','2026-09-30','23:30:00'),
    event('c','A','DENIED','2026-10-01','00:05:00'),
    event('d','A','OUT','2026-10-01','00:10:00'),
    event('e','A','IN','2026-10-01','09:00:00'),
    event('f','A','OUT','2026-10-01','10:00:00'),
  ];
  const visits=pairVisits([...chronological].reverse());
  assert.equal(visits.length,4);
  assert.equal(visits[0].checkInTime,'09:00:00');
  assert.equal(visits[0].checkOutTime,'10:00:00');
  const overnight=visits.find(v=>v.key==='a');
  assert.equal(overnight.checkInDate,'2026-09-30');assert.equal(overnight.checkOutDate,'2026-10-01');
  assert.equal(overnight.status,'Checked out');
  assert.equal(visits.find(v=>v.key==='b').status,'Checked in');
  assert.equal(visits.find(v=>v.key==='c').status,'Denied');
  assert.equal(filterVisits(visits,{date:'2026-09-30'}).length,2);
  assert.equal(filterVisits(visits,{date:'2026-10-01',query:'A',status:'Checked out'}).length,2);
});
test('missing events never invent check-in or check-out timestamps',()=>{
  const visits=pairVisits([
    event('3','A','OUT','2026-10-01','11:00:00'),
    event('2','A','IN','2026-10-01','10:00:00'),
    event('1','A','IN','2026-10-01','09:00:00'),
    event('0','B','OUT','2026-10-01','08:00:00'),
  ]);
  assert.equal(visits.find(v=>v.key==='1').status,'Missing check-out');
  assert.equal(visits.find(v=>v.key==='1').checkOutTime,'');
  assert.equal(visits.find(v=>v.key==='0').status,'Missing check-in');
  assert.equal(visits.find(v=>v.key==='0').checkInTime,'');
  assert.equal(visits.find(v=>v.key==='2').checkOutTime,'11:00:00');
});
test('roles normalize imports and migrate old records without dropping data',()=>{
  assert.equal(normalizeRecords([{id:'LIB-001',name:'Name',role:'librarians'}])[0].role,'Librarian');
  assert.equal(normalizeRecords([{id:'STU-001',name:'Name',role:'students'}])[0].role,'Student');
  assert.throws(()=>normalizeRecords([{id:'VIS-001',name:'Name',role:'Visitor'}]),/role must be/);
  assert.equal(migrateMember({id:'FAC-001',role:'Faculty'}).role,'Staff');
  assert.deepEqual(migrateMember({id:'VIS-001',role:'Visitor'}),{id:'VIS-001',role:'',legacyRole:'Visitor'});
  assert.equal(migrateLog({id:'FAC-001',role:'Faculty',gate:'Gate 03'}).gate,'Gate 1');
  assert.equal(filterVisits([{role:'Staff'},{role:'Librarian'}],{role:'Librarian'}).length,1);
});
