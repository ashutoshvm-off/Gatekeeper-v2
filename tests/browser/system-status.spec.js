import {test,expect} from '@playwright/test';

test('system panel distinguishes missing backend from live storage and clears stale data',async({page})=>{
  await page.clock.install();
  let response='missing';
  await page.route('**/api/system/status',async route=>{
    if(response==='missing')return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html>Frontend only</html>'});
    if(response==='offline')return route.fulfill({status:503,contentType:'application/json',body:'{}'});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({server:{status:'online'},database:{status:'connected'},storage:response==='invalid-storage'?{usedBytes:-1,totalBytes:10}:{usedBytes:25*1024**3,totalBytes:100*1024**3}})});
  });
  await page.goto('/');await page.getByRole('button',{name:'Open checkpoint'}).click();
  const status=page.getByRole('region',{name:'System status',exact:true});
  await expect(status).toContainText('Not connected');
  await expect(status).toContainText('Not available');
  await expect(status.locator('meter')).toHaveCount(0);
  response='online';await page.clock.fastForward(30000);
  await expect(status).toContainText('Online');await expect(status).toContainText('Connected');
  await expect(status).toContainText('25.0 GB / 100.0 GB');
  await expect(status.getByRole('meter')).toHaveAttribute('value','25');
  await page.setViewportSize({width:1366,height:768});
  await page.screenshot({path:'test-results/system-status-connected.png',fullPage:true});
  response='invalid-storage';await page.clock.fastForward(30000);
  await expect(status).toContainText('Not available');await expect(status.locator('meter')).toHaveCount(0);
  response='offline';await page.clock.fastForward(30000);
  await expect(status).toContainText('Not connected');
  await expect(status.getByText('Online',{exact:true})).toHaveCount(0);
  await expect(status).not.toContainText('25.0 GB');
});
