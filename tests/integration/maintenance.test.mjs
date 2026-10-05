import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {Store} from '../../server/database.mjs';
import {createApp} from '../../server/index.mjs';
import {passwordHash} from '../../server/config.mjs';
test('admin clear requires pause and confirmation, makes a backup, then signs out',{timeout:45000},async()=>{
  const dir=mkdtempSync(join(tmpdir(),'gatekeeper-clear-ui-')),store=new Store(join(dir,'db.sqlite'));
  store.saveMembers([{id:'STD001',name:'Test Student',department:'CS',role:'Student'}]);
  const server=createApp({store,config:{mode:'local',users:[{id:'ADM-ASIET-001',role:'admin',hash:passwordHash('admin-test-password')}]}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();
    await page.goto('http://127.0.0.1:'+server.address().port+'/#admin');await page.getByLabel('Terminal password',{exact:true}).fill('admin-test-password');await page.getByRole('button',{name:'Open administration',exact:true}).click();
    await page.getByRole('button',{name:'Clear database',exact:true}).click();await expect(page.getByRole('button',{name:'Clear local database',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.getByRole('button',{name:'Pause checkpoint',exact:true}).click();await expect(page.getByRole('button',{name:'Resume checkpoint',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Clear database',exact:true}).click();await expect(page.locator('dialog')).toContainText('1 members');
    await page.getByLabel('Confirmation',{exact:true}).fill('CLEAR LOCAL DATABASE');await page.getByLabel('Administrator password',{exact:true}).fill('wrong-password');
    await page.getByRole('button',{name:'Clear local database',exact:true}).click();await expect(page.locator('dialog [role=alert]')).toContainText('incorrect');assert.equal(store.members().length,1);
    await page.getByLabel('Administrator password',{exact:true}).fill('admin-test-password');await page.getByRole('button',{name:'Clear local database',exact:true}).click();
    await expect(page.getByRole('button',{name:'Open administration',exact:true})).toBeVisible();assert.equal(store.members().length,0);assert.equal(store.locked,true);
    const report=JSON.parse(store.db.prepare("SELECT value FROM settings WHERE key='last_database_clear'").get().value),backup=new Store(report.backupPath);try{assert.equal(backup.members().length,1);}finally{backup.close();}
  }finally{await browser?.close();await new Promise(r=>server.close(r));store.close();rmSync(dir,{recursive:true,force:true});}
});
