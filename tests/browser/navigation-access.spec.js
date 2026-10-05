import {test,expect} from '@playwright/test';

test('scanner hides management navigation and locks record pages again on return',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Open checkpoint'}).click();
  const menu=page.getByRole('button',{name:'Management options',exact:true});
  await expect(menu).toHaveAttribute('aria-expanded','false');
  for(const name of ['Access logs','Data management','Access privileges','Administration'])await expect(page.getByRole('link',{name,exact:true})).toHaveCount(0);
  await expect(page.getByText('Data stored on this device.',{exact:true})).toHaveCount(0);
  const dots=await menu.boundingBox();const signout=await page.getByRole('button',{name:'Sign out'}).boundingBox();
  expect(dots.y+dots.height).toBeLessThanOrEqual(signout.y);
  await menu.click();await expect(page.getByRole('link',{name:'Access logs',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(menu).toBeFocused();await expect(menu).toHaveAttribute('aria-expanded','false');
  await menu.click();await page.getByRole('heading',{name:'Identity verification'}).click();await expect(menu).toHaveAttribute('aria-expanded','false');
  for(const route of ['logs','data','faculty','admin']){
    await page.goto(`/#${route}`);
    await expect(page.getByRole('heading',{name:'Administrator sign in'})).toBeVisible();
    await expect(page.locator('table')).toHaveCount(0);
    await expect(page.getByLabel('Terminal password',{exact:true})).toHaveValue('');
    await expect(page.getByText('admin-demo',{exact:true})).toHaveCount(0);
  }
  await page.goto('/#data');
  await page.getByLabel('Terminal password',{exact:true}).fill('wrong-password');
  await page.getByRole('button',{name:'Open administration'}).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid administrator ID or password.');
  await page.getByLabel('Terminal password',{exact:true}).fill('admin-demo');
  await page.getByRole('button',{name:'Open administration'}).click();
  await expect(page.getByRole('heading',{name:'Data management',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Scanner',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Identity verification'})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('gatekeeper-session')).adminUnlocked)).toBe(false);
  await page.reload();await menu.click();
  await page.getByRole('link',{name:'Data management',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Administrator sign in'})).toBeVisible();
  await page.getByRole('link',{name:'Return to officer checkpoint'}).click();
  await expect(page.getByRole('heading',{name:'Identity verification'})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await menu.click();await expect(page.getByRole('link',{name:'Data management',exact:true})).toBeVisible();
  const bounds=await page.locator('.management-popover').boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(390);expect(bounds.y+bounds.height).toBeLessThanOrEqual(844);
});
