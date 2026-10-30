import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {inspect,buildPdf,samplePdf} from '../src/pdf.js';
test('exports annotations, page rotation, reordering and deletion in a readable PDF',async()=>{
 const bytes=await samplePdf(),pages=await inspect(bytes);
 assert.equal(pages.length,2);
 pages[1].rotation=90;
 pages[1].annotations=[{type:'text',text:'Approved',x:30,y:40,size:18,color:'#183e35'},{type:'highlight',x:20,y:40,width:100,height:20},{type:'pen',color:'#123456',points:[[20,30],[40,50],[60,35]]}];
 const output=await buildPdf(bytes,[pages[1]]);
 const doc=await PDFDocument.load(output);
 assert.equal(doc.getPageCount(),1);
 assert.equal(doc.getPage(0).getRotation().angle,90);
 assert.equal(doc.getPage(0).getWidth(),595);
 assert.equal((await PDFDocument.load(bytes)).getPageCount(),2);
});
test('rejects empty exports, malformed documents and unsupported text',async()=>{
 const bytes=await samplePdf(),pages=await inspect(bytes);
 await assert.rejects(()=>buildPdf(bytes,[]),/at least one/);
 await assert.rejects(()=>inspect(new Uint8Array([1,2,3])));
 pages[0].annotations.push({type:'text',text:'😀',x:10,y:10,size:12,color:'#000000'});
 await assert.rejects(()=>buildPdf(bytes,pages));
});
test('preserves cropped and rotated page coordinates',async()=>{
 const src=await PDFDocument.create();const page=src.addPage([600,800]);page.setCropBox(20,30,500,700);
 const bytes=await src.save();const pages=await inspect(bytes);pages[0].rotation=270;
 const out=await PDFDocument.load(await buildPdf(bytes,pages));
 assert.deepEqual(out.getPage(0).getCropBox(),{x:20,y:30,width:500,height:700});
 assert.equal(out.getPage(0).getRotation().angle,270);
});