import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {Store} from '../../server/database.mjs';
import {createApp} from '../../server/index.mjs';
import {passwordHash} from '../../server/config.mjs';

test('admin CSV preview maps old headers and safely retries a lost batch response',{timeout:60000},async()=>{
  const dir=mkdtempSync(join(tmpdir(),'gatekeeper-history-ui-')),store=new Store(join(dir,'test.sqlite'));
  const server=createApp({store,config:{users:[{id:'ADM-ASIET-001',role:'admin',hash:passwordHash('admin-test-password')}]}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
  let browser;
  try{
    browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url+'/#admin');await page.getByLabel('Terminal password',{exact:true}).fill('admin-test-password');await page.getByRole('button',{name:'Open administration'}).click();
    const section=page.getByRole('region',{name:'Import historical logs'});
    await expect(section.getByRole('heading',{name:'Import historical logs'})).toBeVisible();
    const csv=['Old ID,Name,Date,Time,Movement',...Array.from({length:60},(_,i)=>[`STD${i},Example Student,01/06/2025,09:00,IN`,`STD${i},Example Student,01/06/2025,16:00,OUT`]).flat()].join('\n');
    await section.getByLabel('Historical log file').setInputFiles({name:'legacy.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
    await expect(section.getByRole('alert')).toContainText('Select the member ID column.');
    await section.getByLabel('Member ID',{exact:true}).selectOption('Old ID');
    await section.getByLabel('Direction (IN / OUT / DENIED)',{exact:true}).selectOption('Movement');
    await expect(section.getByRole('heading',{name:'Preview · 60 visits · first 20 shown'})).toBeVisible();
    assert.equal(store.visits().total,0);
    await page.screenshot({path:'test-results/history-import-preview.png',fullPage:true});
    let batches=0;
    await page.route('**/api/log-import',async route=>{if(++batches===2){await route.fetch();await route.abort();}else await route.continue();});
    await section.getByRole('button',{name:'Import 60 visits',exact:true}).click();
    await expect(section.getByRole('status')).toContainText('Import stopped: 50 visits confirmed');
    assert.equal(store.visits().total,60);
    await section.getByRole('button',{name:'Import 60 visits',exact:true}).click();
    await expect(section.getByRole('status')).toContainText('Complete: 0 visits imported; 60 duplicates skipped');
    assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM events').get().n,120);
    await page.goto(url+'/#logs');await expect(page.locator('.pagination')).toContainText('of 60 records');
    await expect(page.locator('tbody')).toContainText('09:00:00');assert.deepEqual(errors,[]);
  }finally{await browser?.close();await new Promise(r=>server.close(r));store.close();rmSync(dir,{recursive:true,force:true});}
});
