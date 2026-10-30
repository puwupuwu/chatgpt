import {test,expect} from '@playwright/test';
import {PDFDocument,rgb} from 'pdf-lib';
import {fixture} from '../fixture.js';
import {readFile} from 'node:fs/promises';
import {listContent} from '../../src/content.js';

test('text mode ignores overlapping shapes and supports direct typing and text-list access',async({page})=>{
 const doc=await PDFDocument.load(await fixture());
 // A later paint operation spans the text: this used to steal the text click.
 doc.getPage(0).drawRectangle({x:20,y:450,width:450,height:130,color:rgb(1,1,0),opacity:.12});
 await page.goto('/');
 await page.locator('#file').setInputFiles({name:'overlap.pdf',mimeType:'application/pdf',buffer:Buffer.from(await doc.save())});
 await expect(page.locator('[data-tool="edit-text"]')).toHaveAttribute('aria-pressed','true');
 const hit=page.getByRole('button',{name:'Text: Original invoice',exact:true});
 await expect(hit).toBeVisible();
 await expect(page.locator('.object-box[data-object-type="shape"]')).toHaveCount(0);
 await expect(page.locator('.resize-grip')).toHaveCount(0);
 await hit.click();
 const editor=page.locator('#inlineText');await expect(editor).toBeFocused();
 await editor.press('Control+End');await page.keyboard.insertText(' edited');
 await page.getByRole('button',{name:'Done',exact:true}).click();
 await expect(page.getByRole('button',{name:'Text: Original invoice edited',exact:true})).toBeVisible();
 await page.locator('#objectList').selectOption({label:'Text: Keep this line'});
 await expect(editor).toBeFocused();await editor.press('Control+End');await page.keyboard.insertText(' ქართულად');
 await editor.press('Control+Enter');
 await expect(page.locator('#export')).toBeEnabled();
 await page.getByRole('button',{name:'Edit objects',exact:false}).click();
 await expect(page.locator('.object-box[data-object-type="text"]')).toHaveCount(0);
 await expect(page.locator('.object-box[data-object-type="image"]')).toHaveCount(2);
 await page.locator('.object-box[data-object-type="image"]').first().click();
 await expect(editor).toHaveCount(0);await expect(page.locator('#objectW')).toBeVisible();
 const wait=page.waitForEvent('download');await page.locator('#export').click();const file=await wait;
 const items=(await listContent(await readFile(await file.path()),0)).items;
 const text=items.filter(i=>i.type==='text').map(i=>i.text).join('\n');
 expect(text).toContain('Original invoice edited');
 expect(text).toContain('Keep this line ქართულად');
 expect(text).not.toContain('Original invoice edited edited');
});

test('text mode explains pages with no editable text',async({page})=>{
 const doc=await PDFDocument.create();doc.addPage([500,600]).drawRectangle({x:20,y:20,width:100,height:100,color:rgb(.3,.4,.5)});
 await page.goto('/');await page.locator('#file').setInputFiles({name:'shapes.pdf',mimeType:'application/pdf',buffer:Buffer.from(await doc.save())});
 await expect(page.locator('#status')).toContainText('No editable text found');
 await expect(page.locator('#status')).toContainText('OCR');
 await expect(page.locator('.object-box')).toHaveCount(0);
 await page.getByRole('button',{name:'Edit objects'}).click();
 await expect(page.locator('.object-box[data-object-type="shape"]')).toHaveCount(1);
});
