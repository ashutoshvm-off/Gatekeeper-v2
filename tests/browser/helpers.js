import {expect} from '@playwright/test';

export async function navigate(page,name){
  const heading={Scanner:'Identity verification','Access logs':'Access logs','Data management':'Data management','Access privileges':'Access privileges',Administration:'Campus administration'}[name];
  if(name!=='Scanner')await page.getByRole('button',{name:'Management options',exact:true}).click();
  await page.getByRole('link',{name,exact:true}).click();
  const login=page.getByRole('heading',{name:'Administrator sign in',exact:true});
  const destination=page.getByRole('heading',{name:heading,exact:true});
  await expect(login.or(destination)).toBeVisible();
  if(await login.isVisible()){
    await page.getByLabel('Terminal password',{exact:true}).fill('admin-demo');
    await page.getByRole('button',{name:'Open administration'}).click();
  }
  await expect(destination).toBeVisible();
}
