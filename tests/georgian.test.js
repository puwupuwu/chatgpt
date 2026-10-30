import {test} from 'node:test';
import assert from 'node:assert/strict';
import fontkit from '@pdf-lib/fontkit';
import {georgianFontBytes,hasGeorgian} from '../src/fonts.js';
import {buildPdf,inspect,samplePdf} from '../src/pdf.js';
import {listContent,editContent} from '../src/content.js';
import {fixture} from './fixture.js';
const phrase='გამარჯობა საქართველო ᲒᲐᲛᲐᲠᲯᲝᲑᲐ Invoice 123';
test('bundled Georgian font contains both Georgian cases and Latin glyphs',async()=>{
 const bytes=await georgianFontBytes(),font=fontkit.create(bytes);
 for(const char of phrase+' ABC123')assert.ok(font.hasGlyphForCodePoint(char.codePointAt(0)),char);
 assert.ok(hasGeorgian(phrase));assert.equal(hasGeorgian('ABC'),false);
});
test('added Georgian text is embedded and survives PDF extraction',async()=>{
 const bytes=await samplePdf(),pages=await inspect(bytes);
 pages[0].annotations.push({type:'text',text:phrase,x:60,y:100,size:18,color:'#123456'});
 const output=await buildPdf(bytes,pages),scene=await listContent(output,0);
 assert.ok(scene.items.some(i=>i.text===phrase),JSON.stringify(scene.items.filter(i=>i.type==='text')));
});
test('existing text can be replaced and edited inline in Georgian',async()=>{
 const bytes=await fixture(),item=(await listContent(bytes,0)).items.find(i=>i.text==='Original invoice');
 const first=await editContent(bytes,0,item.id,{text:'ქართული ტექსტი',preserveFont:true});
 const georgian=(await listContent(first,0)).items.find(i=>i.text==='ქართული ტექსტი');assert.ok(georgian);
 const second=await editContent(first,0,georgian.id,{text:'ქართული ტექსტის ცვლილება Invoice 123',preserveFont:true});
 assert.ok((await listContent(second,0)).items.some(i=>i.text==='ქართული ტექსტის ცვლილება Invoice 123'));
});
