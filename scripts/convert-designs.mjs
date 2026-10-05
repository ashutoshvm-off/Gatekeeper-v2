import fs from 'node:fs';
import {load} from 'cheerio';
import vm from 'node:vm';
const pages={Scanner:'barcode_scanner_id_verification_terminal',Faculty:'faculty_privileges_access_matrix',Login:'gatekeeper_secure_checkpoint_login',AdminLogin:'gatekeeper_admin_elevated_login',Logs:'in_out_access_logs_report_export',Data:'student_faculty_data_management',Admin:'admin_privileges_central_management_portal'};
fs.mkdirSync('src/pages',{recursive:true});
const allStyles=new Set();const tableSeeds={};
const bools=new Set(['required','disabled','multiple','readonly','checked','autofocus','selected']);
const attrMap={class:'className',for:'htmlFor',tabindex:'tabIndex',maxlength:'maxLength',minlength:'minLength',readonly:'readOnly',autofocus:'autoFocus',viewbox:'viewBox','stroke-width':'strokeWidth','stroke-linecap':'strokeLinecap','stroke-linejoin':'strokeLinejoin',colspan:'colSpan',rowspan:'rowSpan',autocomplete:'autoComplete',inputmode:'inputMode'};
for(const [page,dir] of Object.entries(pages)){
 const $=load(fs.readFileSync(`stitch_gatekeeper_college_entry_system/${dir}/code.html`,'utf8'));
 if(page==='Scanner'){const context={tailwind:{}};vm.runInNewContext($('#tailwind-config').text(),context);fs.writeFileSync('tailwind.config.js',`export default ${JSON.stringify({content:['./index.html','./src/**/*.{js,jsx}'],...context.tailwind.config},null,2)};\n`);}
 $('style').each((i,e)=>{const css=$(e).text();if(!css.includes('@layer base'))allStyles.add(css)});
 $('script,style').remove();
 // These exported mockups contain dormant modal templates; React owns the dialogs.
 $('[id]').each((i,e)=>{if(/modal/i.test($(e).attr('id')))$(e).remove()});
 let field=0,table=0;
 function emit(node){
  if(node.type==='text')return node.data.trim()?`{${JSON.stringify(node.data)}}`:'';
  if(node.type!=='tag')return '';
  const tag=node.name,a={...node.attribs},el=$(node),txt=el.text().replace(/\s+/g,' ').trim();
  if(tag==='table'){
   const key=`${page}-${table++}`;
   tableSeeds[key]={heads:el.find('th').map((i,e)=>$(e).text().trim()).get(),rows:el.find('tbody tr').map((i,e)=>({cells:$(e).find('td').map((i,e)=>$(e).text().replace(/\s+/g,' ').trim()).get(),img:$(e).find('img').attr('src')})).get()};
   return `<DataTable kind=${JSON.stringify(key)} />`;
  }
  const props=[];
  if(tag==='form'){delete a.onsubmit;props.push(`onSubmit={e=>{e.preventDefault();g.login(${JSON.stringify(page)});}}`)}
  if((tag==='a'||tag==='button')&&a.type!=='submit'){
   const action=a['data-path']||a.title||a.id||txt;
   props.push(`onClick={e=>{e.preventDefault();g.action(${JSON.stringify(action)},e);}}`);
   if(tag==='a')a.href='#';
   if(tag==='button')a.type='button';
   if(!txt||/^\w+$/.test(txt))a['aria-label']=a.title||a.id||txt||'Toggle after-hours access';
  }
  if(tag==='input'||tag==='select'){
   const key=a.id||`${page}-field-${field++}`;
   a['data-field']=key;
   a['aria-label']=a['aria-label']||a.placeholder||a.id|| (tag==='select'?el.find('option').first().text():`${page} ${a.type||'text'} field ${field}`);
   if(a.type==='file'){props.push('onChange={e=>g.importFile(e.target.files?.[0])}');a.accept='.csv,.json,.xlsx';}
   else if(a.type==='checkbox'){delete a.checked;props.push(`defaultChecked={true} onChange={e=>g.field(${JSON.stringify(key)},e.target.checked)}`)}
   else if(a.type==='radio'){if('checked'in a){delete a.checked;props.push('defaultChecked={true}')}props.push(`onChange={e=>g.field(${JSON.stringify(key)},e.target.value)}`);}
   else{
    let value=a.value;
    if(tag==='select')value=el.find('option[selected]').attr('value')??el.find('option').first().attr('value')??el.find('option').first().text();
    if(a.type==='password')value=page==='AdminLogin'?'admin-demo':'gatekeeper';
    delete a.value;
    props.push(`value={g.fields[${JSON.stringify(key)}] ?? ${JSON.stringify(value||'')}} onChange={e=>g.field(${JSON.stringify(key)},e.target.value)}`);
    if(key==='barcode-input')props.push(`onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();g.scan();}}}`);
    if(a.class?.includes('totp-input')){a.inputmode='numeric';a.pattern='[0-9]';props.push(`onInput={e=>g.otpNext(e)}`)}
    if(a.type==='password'){delete a.type;props.push(`type={g.showPassword?'text':'password'}`)}
   }
  }
  for(let [k,v]of Object.entries(a)){
   if(k.startsWith('on')||k==='selected')continue;
   if(k==='style'){const style={};for(const part of v.split(';')){const at=part.indexOf(':');if(at<0)continue;style[part.slice(0,at).trim().replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=part.slice(at+1).trim()}props.push(`style={${JSON.stringify(style)}}`);continue;}
   k=attrMap[k]||k;
   if(bools.has(k.toLowerCase()))props.push(`${k}={true}`);else props.push(`${k}=${JSON.stringify(v)}`);
  }
  let content=(node.children||[]).map(emit).join('');
  if(a.id==='liveClock')content='{g.clock}';
  if(a.id==='counter-ins')content='{(1482 + g.logs.filter(r=>r.fresh && r.direction==="IN").length).toLocaleString()}';
  if(a.id==='btnText'||a.id==='btn-text')content=`{g.busy ? 'Verifying demo credentials…' : ${JSON.stringify(txt)}}`;
  if(page==='Scanner'&&!(node.children||[]).some(n=>n.type==='tag')){
   if(txt==='Arjun Menon')content='{g.person.name}';
   if(txt==='ASI22CS084')content='{g.person.id}';
   if(txt==='ASIET-2022-CS-084')content='{g.person.barcode || g.person.id}';
   if(txt.includes('INSTITUTIONAL ID VERIFIED')||txt.includes('INSTITUTIONAL ID CARD VERIFIED'))content='{g.scanTitle}';
   if(txt.startsWith('Department of Computer Science'))content='{g.person.department + " • " + g.person.course}';
   if(txt==='CHECKING IN')content='{g.direction === "OUT" ? "CHECKING OUT" : "CHECKING IN"}';
   if(txt.startsWith('Today, 09:41'))content='{g.lastScanTime ? "Today, " + g.lastScanTime + " IST" : "Today, 09:41:22 AM IST"}';
   if(txt.startsWith('Lane Barrier 01 will'))content='{g.countdown > 0 ? `Lane Barrier 01 will auto-lock in ${g.countdown} seconds` : "Lane Barrier 01 locked • ready for next scan"}';
  }
  if(['input','img','hr','br','area','source','wbr','col','embed'].includes(tag))return `<${tag} ${props.join(' ')} />`;
  return `<${tag} ${props.join(' ')}>${content}</${tag}>`;
 }
 const body=$('body').contents().toArray().map(emit).join('');
 fs.writeFileSync(`src/pages/${page}.jsx`,`// Converted from the supplied ${dir} design.\nimport React from 'react';\nimport {useGatekeeper} from '../store.jsx';\nimport {DataTable} from '../components.jsx';\nexport default function ${page}(){const g=useGatekeeper();return <div className="design-page ${page.toLowerCase()}">${body}</div>}\n`);
}
fs.writeFileSync('src/design.css',[...allStyles].join('\n'));
fs.writeFileSync('src/tableSeeds.json',JSON.stringify(tableSeeds,null,2));
console.log('Converted seven designs into React JSX.');
