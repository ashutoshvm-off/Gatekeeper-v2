export const MEMBER_ROLES = ['Student', 'Staff', 'Librarian'];
export const CHECKPOINT = 'Gate 1';

export function memberRole(value) {
  const roles = {student:'Student', students:'Student', staff:'Staff', faculty:'Staff', librarian:'Librarian', librarians:'Librarian'};
  return roles[String(value || '').trim().toLowerCase()] || '';
}

// Preserve old records while aligning stored demo data with the current campus setup.
export function migrateMember(record) {
  const role = memberRole(record.role);
  return {...record, role, ...(!role && record.role ? {legacyRole:record.role} : {})};
}
export function migrateLog(record) {
  return {...migrateMember(record), gate:CHECKPOINT};
}

export function resolveTransit(logs, id) {
  const last = logs.find(row => row.id === id && row.direction !== 'DENIED');
  return last?.direction === 'IN' ? 'OUT' : 'IN';
}
export const MEMBER_CODE_PATTERN='(?:[A-Za-z0-9_ ]|-){3,64}';
export function isMemberCode(value){return typeof value==='string'&&/^[A-Z0-9_ -]{3,64}$/.test(value)&&value.trim().length>=3;}
function validateMemberCode(value,label,index) {
  if(isMemberCode(value))return;
  const shown=JSON.stringify(value.length>80?value.slice(0,80)+'…':value).replace(/[^\x20-\x7e]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
  const problem=value.length<3||value.length>64
    ? 'has '+value.length+' characters; it must have 3–64 characters.'
    : 'contains unsupported characters. Use letters, numbers, spaces, hyphens or underscores.';
  throw new Error('Row '+(index+1)+': '+label+' '+shown+' '+problem+' Check spreadsheet row '+(index+2)+' if row 1 contains headings.');
}
export function normalizeRecords(rows) {
  if (!Array.isArray(rows)) throw new Error('The file must contain an array of records.');
  return rows.map((row, index) => {
    // Normalize keys to lowercase for case-insensitive column matching (handles "ID", "Id", "Name", etc.)
    const r = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.trim().toLowerCase().replace(/[\s]+/g,'_'), v]));
    const id = String(r.id || r.roll || r.roll_no || r.rollno || r.staffid || r.staff_id || r.student_id || r.memberid || r.member_id || r.barcode_id || '').trim().toUpperCase();
    const name = String(r.name || r.student_name || r.member_name || r.full_name || r.fullname || '').trim();
    if (!id || !name) throw new Error(`Row ${index + 1}: name and id are required. Check that the file has columns named "id" and "name" (found columns: ${Object.keys(row).join(', ')}).`);
    validateMemberCode(id,'ID',index);
    const barcode = String(r.barcode || id).trim().toUpperCase();
    validateMemberCode(barcode,'Barcode',index);
    const role = r.role == null || r.role === '' ? 'Student' : memberRole(r.role);
    if (!role) throw new Error(`Row ${index + 1}: role must be Student, Staff, or Librarian.`);
    return {id, name, department: String(r.department || r.dept || r.branch || 'General'), role, status: r.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE', privilege: String(r.privilege || 'Campus access'), barcode, course: String(r.course || 'Registered campus member')};
  });
}
export function mergeRecords(existing, incoming, overwrite = true) {
  const map = new Map(existing.map(record => [record.id, record]));
  incoming.forEach(record => { if(overwrite || !map.has(record.id)) map.set(record.id, {...map.get(record.id), ...record}); });
  return [...map.values()];
}
export function csvSafe(value) {
  const text = String(value ?? '');
  return /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
}
export function filterLogs(logs, {query='', role='', gate='', direction='', date=''} = {}) {
  const gateNumber = value => Number(String(value).match(/(?:Gate\s*)?(\d+)/i)?.[1]);
  return logs.filter(r => (!query || `${r.name} ${r.id} ${r.department}`.toLowerCase().includes(query.toLowerCase())) && (!role || r.role === role) && (!gate || gateNumber(r.gate) === gateNumber(gate)) && (!direction || r.direction === direction) && (!date || r.date === date));
}

// Logs are stored newest first. Pair before filtering so overnight visits stay intact.
export function pairVisits(logs) {
  const visits = [];
  const open = new Map();
  [...logs].reverse().forEach((event, order) => {
    const base = {key:event.key, id:event.id, name:event.name, role:memberRole(event.role), department:event.department, gate:CHECKPOINT,
      checkInDate:'', checkInTime:'', checkOutDate:'', checkOutTime:'', attemptDate:'', attemptTime:'', reason:event.reason || '', order};
    if(event.direction === 'DENIED') {
      visits.push({...base,status:'Denied',attemptDate:event.date,attemptTime:event.time});
    } else if(event.direction === 'IN') {
      if(open.has(event.id)) open.get(event.id).status = 'Missing check-out';
      const visit = {...base,checkInDate:event.date,checkInTime:event.time,status:'Checked in'};
      visits.push(visit);open.set(event.id,visit);
    } else if(event.direction === 'OUT') {
      const visit = open.get(event.id);
      if(visit) {
        Object.assign(visit,{checkOutDate:event.date,checkOutTime:event.time,status:'Checked out',order});
        open.delete(event.id);
      } else visits.push({...base,checkOutDate:event.date,checkOutTime:event.time,status:'Missing check-in'});
    }
  });
  return visits.sort((a,b)=>b.order-a.order).map(({order,...visit})=>visit);
}

export function filterVisits(visits,{query='',role='',status='',date=''}={}) {
  const search=query.trim().toLowerCase();
  return visits.filter(v=>(!search||`${v.name} ${v.id} ${v.department}`.toLowerCase().includes(search))
    &&(!role||v.role===role)&&(!status||v.status===status)
    &&(!date||[v.checkInDate,v.checkOutDate,v.attemptDate].includes(date)));
}
