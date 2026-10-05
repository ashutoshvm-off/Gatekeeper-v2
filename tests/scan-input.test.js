import test from 'node:test';
import assert from 'node:assert/strict';
import {scanInputIssue} from '../src/scan-input.js';
test('joined repeated barcodes are held for rescan without truncating their text',()=>{
  const issue=scanInputIssue('24BCS03124BCS031');
  assert.equal(issue.kind,'repeated');assert.equal(issue.unit,'24BCS031');assert.equal(issue.count,2);
  assert.equal(scanInputIssue('card-001'.repeat(3)).count,3);
  assert.equal(scanInputIssue(' 24bcs03124BCS031 ').kind,'repeated');
});
test('ordinary, composite and unknown IDs are not shortened or filtered',()=>{
  for(const id of ['24BCS031','T26VLSI001 - 78660','UNKNOWN-001','12345678','ABCABC123'])assert.equal(scanInputIssue(id),null);
  // A legitimate repetitive ID is ambiguous; the UI offers an explicit full-ID action.
  assert.equal(scanInputIssue('123123').kind,'repeated');
});
test('multiple pasted lines and oversized values require a clean rescan',()=>{
  for(const value of ['ONE\nTWO','ONE\r\nTWO','ONE\tTWO'])assert.equal(scanInputIssue(value).kind,'multiple');
  assert.equal(scanInputIssue('A'.repeat(129)).kind,'length');
});
