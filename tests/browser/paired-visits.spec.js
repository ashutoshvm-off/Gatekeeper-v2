import {navigate} from './helpers';
import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import Papa from 'papaparse';

test('paired visits, role choices, gate migration and exports agree',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('gatekeeper-records-v1',JSON.stringify([
      {id:'STU-001',name:'Test Student',role:'Student',department:'CS',status:'ACTIVE'},
      {id:'LIB-001',name:'Test Librarian',role:'Librarian',department:'Library',status:'ACTIVE'},
      {id:'FAC-001',name:'Legacy Faculty',role:'Faculty',department:'CS',status:'ACTIVE'},
    ]));
    localStorage.setItem('gatekeeper-logs-v1',JSON.stringify([
      {key:'2',id:'STU-001',name:'Test Student',role:'Student',department:'CS',date:'2026-10-01',time:'08:00:00',direction:'OUT',gate:'Gate 02'},
      {key:'1',id:'STU-001',name:'Test Student',role:'Student',department:'CS',date:'2026-09-30',time:'20:00:00',direction:'IN',gate:'Gate 01'},
    ]));
    sessionStorage.setItem('gatekeeper-session',JSON.stringify({id:'SEC-G1-204',role:'admin',adminUnlocked:true,gate:'Gate 03'}));
  });
  await page.goto('/#logs');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  for(const text of ['20:00:00','08:00:00','Checked out'])await expect(page.locator('tbody tr')).toContainText(text);
  await expect(page.getByLabel('Filter role').locator('option')).toHaveText(['All roles','Student','Staff','Librarian']);
  await expect(page.getByLabel('Filter checkpoint')).toHaveCount(0);
  await page.getByLabel('Filter date').fill('2026-10-01');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV'}).click();
  const file=await download;
  const csv=Papa.parse(await fs.readFile(await file.path(),'utf8'),{header:true,skipEmptyLines:true}).data;
  expect(csv).toHaveLength(1);
  expect(csv[0]).toMatchObject({checkInDate:'2026-09-30',checkInTime:'20:00:00',checkOutDate:'2026-10-01',checkOutTime:'08:00:00',gate:'Gate 1'});
  await navigate(page,'Scanner');
  const input=page.locator('#barcode-input');
  await input.fill('LIB-001');await input.press('Enter');
  await navigate(page,'Access logs');
  await page.getByLabel('Filter role').selectOption('Librarian');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('Not yet checked out');
  await navigate(page,'Scanner');
  await input.fill('LIB-001');await input.press('Enter');
  await navigate(page,'Access logs');
  await page.getByLabel('Filter role').selectOption('Librarian');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('Checked out');
  await page.getByRole('button',{name:'Reset',exact:true}).click();
  await page.setViewportSize({width:1440,height:900});
  await page.screenshot({path:'test-results/paired-access-logs.png',fullPage:true});
  await navigate(page,'Data management');
  await page.getByRole('button',{name:'Add member'}).click();
  await expect(page.getByLabel('Role',{exact:true}).locator('option')).toHaveText(['Select role','Student','Staff','Librarian']);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('gatekeeper-records-v1')).find(r=>r.id==='FAC-001').role)).toBe('Staff');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('gatekeeper-logs-v1')).every(r=>r.gate==='Gate 1'))).toBe(true);
});
