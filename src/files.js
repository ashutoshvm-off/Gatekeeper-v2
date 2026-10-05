import Papa from 'papaparse';
import {csvSafe} from './domain';
export function downloadFile(content, filename, type='text/plain') {
 const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function exportRows(rows, format='csv', filename='asiet-export') {
 const clean=rows.map(({img,key,fresh,...r})=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k, typeof v==='object'?JSON.stringify(v):csvSafe(v)])));
 if(format==='xlsx'){
  const XLSX=await import('xlsx');const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(clean),'Gatekeeper');XLSX.writeFile(workbook,`${filename}.xlsx`);
 }else if(format==='pdf'){
  const {jsPDF}=await import('jspdf');const doc=new jsPDF({orientation:'landscape'});doc.setFontSize(16);doc.text('ASIET Gatekeeper — Access Audit',14,17);doc.setFontSize(9);let y=29;
  for(const r of clean){const text=Object.values(r).join(' | ');const lines=doc.splitTextToSize(text,265);if(y+lines.length*5>190){doc.addPage();y=17}doc.text(lines,14,y);y+=lines.length*5+6}doc.save(`${filename}.pdf`);
 }else downloadFile('\uFEFF'+Papa.unparse(clean),`${filename}.csv`,'text/csv;charset=utf-8');
}
export async function readRecords(file) {
 if(file.size>25*1024*1024)throw new Error('Choose a file smaller than 25 MB.');
 if(/\.json$/i.test(file.name)){return JSON.parse(await file.text())}
 if(/\.xlsx$/i.test(file.name)){const XLSX=await import('xlsx');const book=XLSX.read(await file.arrayBuffer(),{type:'array',bookVBA:false});return XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{defval:''});}
 if(!/\.csv$/i.test(file.name))throw new Error('Choose a CSV, XLSX, or JSON file.');
 const parsed=Papa.parse(await file.text(),{header:true,skipEmptyLines:true});if(parsed.errors.length)throw new Error(parsed.errors[0].message);return parsed.data;
}
export async function encryptedBackup(records,password){
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt']);
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(records)));
 const encode=bytes=>btoa(Array.from(new Uint8Array(bytes),b=>String.fromCharCode(b)).join(''));
 downloadFile(JSON.stringify({version:1,algorithm:'AES-GCM',kdf:'PBKDF2-SHA256',iterations:250000,salt:encode(salt),iv:encode(iv),ciphertext:encode(data)}),'asiet-encrypted-backup.json','application/json');
}
