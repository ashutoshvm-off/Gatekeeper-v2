import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveTransit,normalizeRecords,mergeRecords,filterLogs,csvSafe} from '../src/domain.js';

test('transit alternates using the latest valid event and ignores denied attempts',()=>{
  assert.equal(resolveTransit([], 'A'), 'IN');
  assert.equal(resolveTransit([{id:'A',direction:'DENIED'},{id:'A',direction:'IN'}], 'A'), 'OUT');
  assert.equal(resolveTransit([{id:'B',direction:'IN'},{id:'A',direction:'OUT'}], 'A'), 'IN');
});
test('import validates every row before changing records',()=>{
  assert.throws(()=>normalizeRecords([{id:'VALID',name:'Valid'},{id:'',name:'Missing'}]),/Row 2/);
  assert.throws(()=>normalizeRecords({}),/array/);
  assert.throws(()=>normalizeRecords([{id:'<bad>',name:'Bad'}]),/letters/);
  const [record]=normalizeRecords([{id:' asiet001 ',name:' Test ',role:'Faculty'}]);
  assert.equal(record.id,'ASIET001');assert.equal(record.name,'Test');assert.equal(record.role,'Staff');
  assert.equal(normalizeRecords([{id:'ASI001',name:'Name',barcode:'CARD-001'}])[0].barcode,'CARD-001');
});
test('merge respects overwrite choice and preserves unmentioned fields',()=>{
  const old=[{id:'A',name:'Old',afterHours:true}];
  assert.deepEqual(mergeRecords(old,[{id:'A',name:'New'}],false),old);
  assert.deepEqual(mergeRecords(old,[{id:'A',name:'New'}]),[{id:'A',name:'New',afterHours:true}]);
});
test('log filters combine and exports neutralize spreadsheet formulas',()=>{
  const logs=[{id:'A',name:'Arjun',department:'CS',role:'Student',gate:'Gate 01',direction:'IN',date:'2026-09-30'},{id:'B',name:'Meera',department:'CS',role:'Faculty',gate:'Gate 02',direction:'OUT',date:'2026-09-30'}];
  assert.equal(filterLogs(logs,{query:'ARJ',role:'Student',gate:'01',direction:'IN',date:'2026-09-30'}).length,1);
  assert.equal(filterLogs(logs,{query:'Arjun',direction:'OUT'}).length,0);
  assert.equal(filterLogs([{...logs[0],gate:'Main Gate 1'}],{gate:'Gate 01'}).length,1);
  assert.equal(csvSafe('=SUM(A1)'),"'=SUM(A1)");assert.equal(csvSafe('Normal'),'Normal');
});

test('import errors identify short IDs, spreadsheet row numbers and hidden characters',()=>{
  assert.throws(()=>normalizeRecords([{id:'12',name:'Short ID'}]),/ID "12" has 2 characters.*3–64.*spreadsheet row 2/);
  assert.throws(()=>normalizeRecords([{id:'STD001',name:'Valid'},{id:'STD/002',name:'Invalid'}]),/Row 2: ID "STD\/002".*letters.*spreadsheet row 3/);
  assert.throws(()=>normalizeRecords([{id:'STD\u200b002',name:'Invisible character'}]),error=>error.message.includes('\\u200b'));
  assert.throws(()=>normalizeRecords([{id:'STD001',name:'Valid',barcode:'AB'}]),/Barcode "AB" has 2 characters/);
});
