import {test,expect} from '@playwright/test';

test('consecutive scanner inputs are accepted without a reset or focus click',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Open checkpoint'}).click();
  const input=page.locator('#barcode-input');
  const logCount=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('gatekeeper-logs-v1')).length);
  const initial=await logCount();
  await expect(input).toBeFocused();
  for(const [index,id] of ['ASI22CS084','NOT-REGISTERED','ASI22CS084'].entries()){
    await page.keyboard.type(id,{delay:5});
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();
    await expect.poll(logCount).toBe(initial+index+1);
    await expect(page.locator('.verification-status')).toBeVisible();
    await expect(page.getByText('Ready for next scan',{exact:true})).toBeVisible();
    await page.keyboard.press('Enter');
    expect(await logCount()).toBe(initial+index+1);
  }
  const logs=await page.evaluate(()=>JSON.parse(localStorage.getItem('gatekeeper-logs-v1')));
  expect(logs[0].direction).not.toBe(logs[2].direction);
  expect(logs[1].direction).toBe('DENIED');
  await expect(page.getByRole('button',{name:'Next scan',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Flag incident'}).click();
  await page.getByLabel('Incident details').fill('Review this access event.');
  await page.keyboard.press('F2');
  await expect(page.getByLabel('Incident details')).toBeFocused();
  await page.getByRole('button',{name:'Save incident'}).click();
  await expect(input).toBeFocused();
  await page.keyboard.type('ASI22CS084');
  await page.keyboard.press('Enter');
  await expect.poll(logCount).toBe(initial+4);
  await expect(input).toHaveValue('');
});
