import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {Store} from '../../server/database.mjs';
import {createApp} from '../../server/index.mjs';
import {passwordHash} from '../../server/config.mjs';

test('joined scans cannot enter the queue; Enter and Tab rapid taps retain individual events',{timeout:120000},async()=>{
  const dir=mkdtempSync(join(tmpdir(),'gatekeeper-scan-boundaries-'));
  const store=new Store(join(dir,'test.sqlite'));
  store.saveMembers(['24BCS031','123123'].map(id=>({id,name:'Scanner Test',role:'Student',status:'ACTIVE',department:'CS'})));
  const server=createApp({store,config:{users:[{id:'SEC-G1-204',role:'guard',hash:passwordHash('scanner-test-password')}]}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  const count=()=>store.db.prepare('SELECT COUNT(*) AS n FROM events').get().n;
  let browser;
  try{
    browser=await chromium.launch({channel:'chrome',headless:true});
    const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url);await page.getByLabel('Terminal password',{exact:true}).fill('scanner-test-password');
    await page.getByRole('button',{name:'Open checkpoint',exact:true}).click();
    const input=page.locator('#barcode-input'),queue=page.getByRole('region',{name:'Scan queue'});
    await expect(input).toBeFocused();
    await input.pressSequentially('24BCS03124BCS031');await input.press('Enter');
    await expect(page.getByRole('alert')).toContainText('Nothing was queued');
    assert.equal(count(),0);await expect(queue).toContainText('0 pending');
    // Rejected input is selected: the next card replaces it without a reset click.
    assert.deepEqual(await input.evaluate(e=>[e.selectionStart,e.selectionEnd]),[0,16]);
    await page.screenshot({path:'test-results/scanner-joined-input.png',fullPage:true});
    await page.keyboard.type('24BCS031');await page.keyboard.press('Enter');
    await expect(input).toHaveValue('');await expect(input).toBeFocused();
    await expect.poll(count).toBe(1);
    await page.keyboard.type('24BCS031');await page.keyboard.press('Tab');
    await expect(input).toHaveValue('');await expect(input).toBeFocused();
    await expect.poll(count).toBe(2);
    assert.deepEqual(store.db.prepare('SELECT direction FROM events ORDER BY seq').all().map(r=>r.direction),['IN','OUT']);
    await input.press('Enter');await expect(queue).toContainText('0 pending');assert.equal(count(),2);
    // A held terminator must not submit a second buffered barcode.
    await input.fill('24BCS031');
    await input.evaluate(e=>e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',repeat:true,bubbles:true,cancelable:true})));
    await expect(input).toHaveValue('24BCS031');assert.equal(count(),2);
    await input.press('Enter');await expect.poll(count).toBe(3);
    // Multiline paste must not be flattened by a single-line HTML input.
    await input.evaluate(e=>{const data=new DataTransfer();data.setData('text/plain','24BCS031\nOTHER');e.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
    await expect(page.getByRole('alert')).toContainText('Multiple lines');assert.equal(count(),3);
    await expect(input).toHaveValue('');
    // An actual repetitive identifier remains usable only with deliberate confirmation.
    await input.fill('123123');await input.press('Enter');
    await expect(page.getByRole('alert')).toContainText('same barcode joined');assert.equal(count(),3);
    await page.getByRole('button',{name:'Verify exact full ID'}).click();await expect.poll(count).toBe(4);
    assert.equal(store.db.prepare('SELECT member_id FROM events ORDER BY seq DESC LIMIT 1').get().member_id,'123123');
    // Submit complete reads in a single JS task before React can render between them.
    await page.route('**/api/scans',route=>route.abort());
    await page.evaluate(()=>{
      const e=document.querySelector('#barcode-input');
      for(let i=0;i<50;i++){
        e.value='24BCS031';
        e.dispatchEvent(new Event('input',{bubbles:true}));
        e.dispatchEvent(new KeyboardEvent('keydown',{key:i%2?'Tab':'Enter',bubbles:true,cancelable:true}));
        if(e.value!=='')throw Error('Scan did not clear synchronously');
      }
    });
    await expect(queue).toContainText('50 pending');assert.equal(count(),4);
    await page.unroute('**/api/scans');await page.getByRole('button',{name:'Retry sync now'}).click();
    await expect.poll(count,{timeout:20000}).toBe(54);
    const rows=store.db.prepare('SELECT member_id,direction FROM events ORDER BY seq').all();
    assert.ok(rows.slice(4).every((r,i)=>r.member_id==='24BCS031'&&r.direction===(i%2?'IN':'OUT')));
    assert.ok(rows.every(r=>r.member_id!=='24BCS03124BCS031'));
    // No-suffix mode is opt-in: default keyboard bursts must wait for Enter.
    await input.pressSequentially('24BCS031',{delay:5});
    await page.waitForTimeout(400);assert.equal(count(),54);await expect(input).toHaveValue('24BCS031');
    await input.press('Enter');await expect.poll(count).toBe(55);
    await page.getByLabel('Auto-submit fast scans (reader has no Enter/Tab)').check();
    await input.pressSequentially('24BCS031',{delay:5});
    await expect.poll(count).toBe(56);await expect(input).toHaveValue('');
    // Suffix arriving before the idle deadline cannot create a second tap.
    await input.pressSequentially('24BCS031',{delay:5});await input.press('Enter');
    await expect.poll(count).toBe(57);await page.waitForTimeout(400);assert.equal(count(),57);
    // Slow manual entry and short codes are never auto-submitted.
    await input.pressSequentially('24BCS031',{delay:85});
    await page.waitForTimeout(400);assert.equal(count(),57);await expect(input).toHaveValue('24BCS031');
    await input.press('Enter');await expect.poll(count).toBe(58);
    await input.pressSequentially('ABC',{delay:5});await page.waitForTimeout(400);
    assert.equal(count(),58);await input.fill('');
    await input.pressSequentially('24BCS03124BCS031',{delay:5});
    await expect(page.getByRole('alert')).toContainText('Nothing was queued');assert.equal(count(),58);
    await page.keyboard.type('24BCS031',{delay:5});await expect.poll(count).toBe(59);
    await input.pressSequentially('24BCS031',{delay:5});
    // Leaving the field cancels auto-submit; text stays available for manual submission.
    await page.getByRole('button',{name:'Retry sync now'}).focus();await page.waitForTimeout(400);
    assert.equal(count(),59);await expect(input).toHaveValue('24BCS031');
    await input.press('Enter');await expect.poll(count).toBe(60);
    await page.reload();await expect(input).toBeVisible();
    await expect(page.getByLabel('Auto-submit fast scans (reader has no Enter/Tab)')).toBeChecked();
    await page.screenshot({path:'test-results/scanner-auto-submit.png',fullPage:true});
    assert.deepEqual(errors,[]);
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));store.close();rmSync(dir,{recursive:true,force:true});}
});
