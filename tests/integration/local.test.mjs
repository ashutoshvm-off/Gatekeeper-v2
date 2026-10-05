import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {Store} from '../../server/database.mjs';
import {createApp} from '../../server/index.mjs';
import {passwordHash} from '../../server/config.mjs';

test('fullscreen-profile queue survives browser restart, lost response, and rapid taps', {timeout:120000},async()=>{
  const dir=mkdtempSync(join(tmpdir(),'gatekeeper-browser-'));
  const store=new Store(join(dir,'test.sqlite'));
  store.saveMembers([{id:'STD001',name:'Queue Test Student',role:'Student',status:'ACTIVE',department:'CS'}]);
  const config={users:[{id:'SEC-G1-204',role:'guard',hash:passwordHash('guard-test-password')},{id:'ADM-ASIET-001',role:'admin',hash:passwordHash('admin-test-password')}]};
  const server=createApp({store,config});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url=`http://127.0.0.1:${server.address().port}`;
  let context;
  const open=async()=>chromium.launchPersistentContext(join(dir,'profile'),{channel:'chrome',headless:true,viewport:{width:1440,height:1000}});
  const login=async(page)=>{await page.goto(url);await page.getByLabel('Terminal password',{exact:true}).fill('guard-test-password');await page.getByRole('button',{name:'Open checkpoint',exact:true}).click();await expect(page.getByRole('heading',{name:'Identity verification'})).toBeVisible();};
  const inputTaps=async(page,count)=>{
    // Dispatch keyboard-wedge submissions in one browser task, without waiting
    // for React renders, network requests, or database responses between taps.
    await page.evaluate(count=>{
      const input=document.querySelector('#barcode-input'),form=input.closest('form');
      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      for(let i=0;i<count;i++){setter.call(input,'STD001');input.dispatchEvent(new Event('input',{bubbles:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}
    },count);
  };
  try{
    context=await open();let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await login(page);
    await page.route('**/api/scans',route=>route.abort());
    await inputTaps(page,100);
    await expect(page.getByRole('region',{name:'Scan queue'})).toContainText('100 pending',{timeout:15000});
    assert.equal(store.visits().total,0);
    await context.close();context=await open();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    let dropped=false;
    await page.route('**/api/scans',async route=>{
      if(!dropped){dropped=true;await route.fetch();await route.abort();}else await route.continue();
    });
    await login(page);
    await expect(page.getByRole('region',{name:'Scan queue'}).locator('strong').first()).toHaveText(/^0 pending ·/,{timeout:30000});
    await expect(page.getByRole('region',{name:'Scan queue'})).toContainText('Last database confirmation: STD001');
    assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM events').get().n,100);
    assert.equal(store.visits().total,50);
    await inputTaps(page,100);
    await expect.poll(()=>store.db.prepare('SELECT COUNT(*) AS n FROM events').get().n,{timeout:30000}).toBe(200);
    assert.equal(store.visits().total,100);
    assert.ok(store.visits().rows.every(v=>v.status==='Checked out'));
    // Management uses real credentials and paginated, database-backed history.
    await page.goto(url+'/#logs');await page.getByLabel('Terminal password',{exact:true}).fill('admin-test-password');await page.getByRole('button',{name:'Open administration'}).click();
    await expect(page.getByRole('heading',{name:'Access logs',exact:true})).toBeVisible();
    await expect(page.locator('.pagination')).toContainText('of 100 records');
    await page.getByRole('button',{name:'Next page'}).click();await expect(page.locator('.pagination')).toContainText('Page 2 of 10');
    await page.screenshot({path:'test-results/local-database-logs.png',fullPage:true});
    await page.goto(url+'/#scanner');
    await expect(page.getByRole('heading',{name:'Identity verification'})).toBeVisible();
    await page.screenshot({path:'test-results/local-database-queue.png',fullPage:true});
    // A full/unavailable browser store must never be displayed as a saved tap.
    await page.evaluate(()=>{window.originalQueueAdd=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(){throw new DOMException('Simulated disk full','QuotaExceededError');};});
    await inputTaps(page,3);
    await expect(page.getByRole('region',{name:'Scan queue'})).toContainText('3 taps NOT saved');
    assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM events').get().n,200);
    await page.evaluate(()=>{IDBObjectStore.prototype.add=window.originalQueueAdd;});
    await page.getByRole('button',{name:'Retry unsaved taps'}).click();
    await expect.poll(()=>store.db.prepare('SELECT COUNT(*) AS n FROM events').get().n,{timeout:15000}).toBe(203);
    // Multiple tabs share one persistent queue and one uploader lock.
    const second=await context.newPage();await second.goto(url);await expect(second.getByRole('heading',{name:'Identity verification'})).toBeVisible();
    await Promise.all([inputTaps(page,20),inputTaps(second,20)]);
    await expect.poll(()=>store.db.prepare('SELECT COUNT(*) AS n FROM events').get().n,{timeout:15000}).toBe(243);
    const events=store.db.prepare('SELECT direction FROM events ORDER BY seq').all();
    assert.ok(events.every((event,i)=>event.direction===(i%2?'OUT':'IN')));
    // Compact desktop layout keeps the scanner input within the visible screen.
    await page.setViewportSize({width:1366,height:768});await page.locator('#barcode-input').focus();
    const bounds=await page.locator('#barcode-input').boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=768);
    assert.deepEqual(errors,[]);
  }finally{await context?.close();await new Promise(r=>server.close(r));store.close();rmSync(dir,{recursive:true,force:true});}
});
