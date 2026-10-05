import {load} from 'cheerio';
import fs from 'node:fs';
const root='stitch_gatekeeper_college_entry_system';
for(const dir of fs.readdirSync(root)){
 const f=`${root}/${dir}/code.html`; if(!fs.existsSync(f))continue;
 const $=load(fs.readFileSync(f,'utf8'));
 console.log('\nPAGE',dir);
 console.log('CONTROLS',JSON.stringify($('button,a,input,select').map((i,e)=>({tag:e.tagName,id:$(e).attr('id'),text:$(e).text().replace(/\s+/g,' ').trim().slice(0,90),placeholder:$(e).attr('placeholder'),type:$(e).attr('type'),title:$(e).attr('title')})).get()));
 console.log('TABLES',JSON.stringify($('table').map((i,e)=>({i,heads:$(e).find('th').map((i,e)=>$(e).text().trim()).get(),rows:$(e).find('tbody tr').length})).get()));
}
