import {navigate} from './helpers';
import {test,expect} from '@playwright/test';
test('complete checkpoint, registry, reporting and administrator workflow',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:1080});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Checkpoint sign in'})).toBeVisible();
  await page.screenshot({path:'test-results/login-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Open checkpoint'}).click();
  await expect(page.getByRole('heading',{name:'Identity verification'})).toBeVisible();
  await page.screenshot({path:'test-results/scanner-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'ASI22CS084'}).click();
  await page.getByRole('button',{name:'Verify ID'}).click();
  await expect(page.getByText(/Identity verified · .* recorded/)).toBeVisible();
  const first=await page.locator('.verification-status strong').textContent();
  await page.locator('#barcode-input').fill('ASI22CS084');
  await page.getByRole('button',{name:'Verify ID'}).click();
  await expect(page.locator('.verification-status strong')).not.toHaveText(first);
  await page.locator('#barcode-input').fill('NOT-REGISTERED');
  await page.locator('#barcode-input').press('Enter');
  await expect(page.getByText('Access denied',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Flag incident'}).click();
  await page.getByLabel('Incident details').fill('Unregistered visitor requires follow-up.');
  await page.getByRole('button',{name:'Save incident'}).click();
  await navigate(page,'Data management');
  await page.getByRole('button',{name:'Add member'}).click();
  await page.getByLabel('Full name',{exact:true}).fill('Test Campus Member');
  await page.getByLabel('Institutional ID',{exact:true}).fill('TEST-001');
  await page.getByLabel('Department',{exact:true}).fill('Computer Science');
  await page.getByRole('button',{name:'Save record'}).click();
  await page.getByPlaceholder('Search name, ID or department…').fill('TEST-001');
  await expect(page.getByText('Test Campus Member',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByText('Test Campus Member',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Edit Test Campus Member'}).click();
  await page.getByLabel('Card status').selectOption('SUSPENDED');
  await page.getByRole('button',{name:'Save record'}).click();
  await navigate(page,'Scanner');
  await page.locator('#barcode-input').fill('TEST-001');
  await page.locator('#barcode-input').press('Enter');
  await expect(page.getByText('Access denied',{exact:true})).toBeVisible();
  await navigate(page,'Access logs');
  await page.getByPlaceholder('Search name, ID or department…').fill('TEST-001');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export CSV'}).click();
  expect((await download).suggestedFilename()).toBe('gatekeeper-transit.csv');
  await navigate(page,'Access privileges');
  const toggle=page.getByRole('switch').first();const previous=await toggle.getAttribute('aria-checked');await toggle.click();await expect(toggle).toHaveAttribute('aria-checked',previous==='true'?'false':'true');
  await navigate(page,'Administration');
  await expect(page.getByText('Unregistered visitor requires follow-up.')).toBeVisible();
  await page.getByRole('button',{name:'Pause checkpoint'}).click();
  await navigate(page,'Scanner');
  await page.locator('#barcode-input').fill('ASI22CS084');await page.locator('#barcode-input').press('Enter');
  await expect(page.getByText(/Checkpoint paused by administrator/)).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'test-results/scanner-mobile.png',fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  for(const name of ['Access logs','Data management','Access privileges','Administration']){
    await navigate(page,name);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),name).toBe(true);
  }
  await page.getByRole('button',{name:'Sign out'}).click();
  await expect(page.getByRole('heading',{name:'Checkpoint sign in'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('imports validate before updating and spreadsheet/PDF/card exports work',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Open checkpoint'}).click();
  await navigate(page,'Data management');
  const file=page.getByLabel('Import records file');
  await file.setInputFiles({name:'invalid.csv',mimeType:'text/csv',buffer:Buffer.from('id,name\nIMPORT-001,Valid Name\n,Missing ID')});
  await expect(page.getByRole('status')).toContainText('Row 2');
  await page.getByPlaceholder('Search name, ID or department…').fill('IMPORT-001');
  await expect(page.getByText('No matching records')).toBeVisible();
  await file.setInputFiles({name:'valid.csv',mimeType:'text/csv',buffer:Buffer.from('id,name,department,barcode\nIMPORT-001,Imported Member,Science,CARD-001')});
  await expect(page.getByText('Imported Member',{exact:true})).toBeVisible();
  for(const format of ['XLSX','PDF']){
    await page.getByRole('button',{name:new RegExp(format)}).click();
    const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Download 1 records'}).click();
    expect((await promise).suggestedFilename()).toBe(`gatekeeper-registry.${format.toLowerCase()}`);
  }
  await page.getByRole('button',{name:'View barcode for Imported Member'}).click();
  await expect(page.getByRole('img',{name:'Barcode for CARD-001'})).toBeVisible();
  await page.emulateMedia({media:'print'});
  await expect(page.locator('.print-card')).toBeVisible();
  await page.emulateMedia({media:'screen'});
  await page.getByRole('button',{name:'Close dialog'}).click();
  await page.setViewportSize({width:320,height:740});
  for(const name of ['Scanner','Access logs','Data management','Access privileges','Administration']){
    await navigate(page,name);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),name).toBe(true);
  }
});
