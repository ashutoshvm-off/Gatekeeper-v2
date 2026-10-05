import {randomUUID} from 'node:crypto';
import {isMemberCode} from '../src/domain.js';
export const checkedInMessage='This member is currently checked in. Record their check-out before deleting, or edit the member to suspend their pass.';
export function memberDeletion(id,actor){
  if(!isMemberCode(id))throw Error('Invalid member ID.');
  const audit={key:randomUUID(),id,reason:actor+' deleted member '+id+' from the registry. Access history retained.',time:new Date().toISOString()};
  return [
    {sql:"SELECT key FROM visits WHERE id=? AND status='Checked in' LIMIT 1",args:[id]},
    {sql:"DELETE FROM members WHERE id=? AND NOT EXISTS(SELECT 1 FROM visits WHERE id=? AND status='Checked in')",args:[id,id]},
    {sql:'INSERT INTO incidents(key,data) SELECT ?,? WHERE changes()>0',args:[audit.key,JSON.stringify(audit)]}
  ];
}
