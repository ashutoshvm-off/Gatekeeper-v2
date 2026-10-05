import {navigate} from './helpers';
import {test,expect} from '@playwright/test';

test('scanner fits the viewport before and after verification',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Open checkpoint'}).click();
  for(const [width,height] of [[1440,900],[1366,768],[1280,720],[1920,1080],[1024,768],[390,844],[320,740]]){
    await page.setViewportSize({width,height});
    for(const id of [null,'ASI22CS084','UNREGISTERED']){
      if(id){await page.locator('#barcode-input').fill(id);await page.locator('#barcode-input').press('Enter');}
      const layout=await page.evaluate(()=>({
        pageHeight:document.documentElement.scrollHeight,
        viewportHeight:innerHeight,
        pageWidth:document.documentElement.scrollWidth,
        viewportWidth:innerWidth,
        panels:[...document.querySelectorAll('.scan-grid>.panel')].map(el=>({overflow:el.scrollHeight-el.clientHeight,bottom:el.getBoundingClientRect().bottom})),
      }));
      expect(layout.pageHeight,`${width}x${height} ${id} page height`).toBeLessThanOrEqual(height+1);
      expect(layout.pageWidth,`${width}x${height} page width`).toBeLessThanOrEqual(width);
      for(const panel of layout.panels){
        expect(panel.bottom,`${width}x${height} ${id} panel position`).toBeLessThanOrEqual(height);
        expect(panel.overflow,`${width}x${height} ${id} panel content`).toBeLessThanOrEqual(1);
      }
    }
    if(width===1366||width===390)await page.screenshot({path:`test-results/scanner-fit-${width}.png`,fullPage:true});
  }
  await navigate(page,'Data management');
  await expect(page.locator('.scanner-workspace')).toHaveCount(0);
});
