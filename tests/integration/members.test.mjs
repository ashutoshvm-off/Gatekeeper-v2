import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {Store} from '../../server/database.mjs';
import {createApp} from '../../server/index.mjs';
import {passwordHash} from '../../server/config.mjs';
test('member actions edit, cancel deletion and confirm deletion in the browser',{timeout:60000},async()=>{
  const dir=mkdtempSync(join(tmpdir(),'gatekeeper-member-ui-')),store=new Store(join(dir,'test.sqlite'));
  store.saveMembers([{id:'STD001',name:'Original Student',role:'Student',department:'CS',status:'ACTIVE'}]);
  const server=createApp({store,config:{users:[{id:'ADM-ASIET-001',role:'admin',hash:passwordHash('test-admin-password')}]}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1366,height:900}});
    await page.goto('http://127.0.0.1:'+server.address().port+'/#data');
    await page.getByLabel('Terminal password',{exact:true}).fill('test-admin-password');await page.getByRole('button',{name:'Open administration'}).click();
    await page.getByRole('button',{name:'Edit Original Student',exact:true}).click();
    await page.getByLabel('Full name',{exact:true}).fill('Updated Student');await page.getByRole('button',{name:'Save record',exact:true}).click();
    await expect(page.locator('tbody')).toContainText('Updated Student');assert.equal(store.members()[0].name,'Updated Student');
    await page.getByRole('button',{name:'Delete Updated Student',exact:true}).click();
    await expect(page.locator('dialog')).toContainText('Existing scan history and incident logs will be retained');
    await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(store.members().length,1);
    await page.getByRole('button',{name:'Delete Updated Student',exact:true}).click();await page.getByRole('button',{name:'Delete member',exact:true}).click();
    await expect(page.locator('tbody tr')).toHaveCount(0);assert.equal(store.members().length,0);assert.equal(store.incidents().length,1);
  }finally{await browser?.close();await new Promise(r=>server.close(r));store.close();rmSync(dir,{recursive:true,force:true});}
});
