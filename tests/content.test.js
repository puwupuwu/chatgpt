import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {listContent,editContent} from '../src/content.js';
import {fixture,png} from './fixture.js';
test('replaces original text without keeping hidden old text',async()=>{
 const bytes=await fixture(),scene=await listContent(bytes,0),target=scene.items.find(i=>i.text==='Original invoice');
 assert.ok(target);
 const out=await editContent(bytes,0,target.id,{text:'Updated invoice',font:'Helvetica',size:24,color:'#183e35'});
 const after=await listContent(out,0),text=after.items.filter(i=>i.type==='text').map(i=>i.text).join(' ');
 assert.match(text,/Updated invoice/);assert.doesNotMatch(text,/Original invoice/);assert.match(text,/Keep this line/);
 assert.equal(after.items.filter(i=>i.type==='image').length,2);
});
test('moves/resizes one image instance; deletes/replaces independently',async()=>{
 const bytes=await fixture(),scene=await listContent(bytes,0),image=scene.items.find(i=>i.type==='image');
 const moved=await editContent(bytes,0,image.id,{x:120,y:150,width:45,height:35});
 const images=(await listContent(moved,0)).items.filter(i=>i.type==='image');
 assert.equal(images.length,2);assert.ok(Math.abs(images[0].bounds[0]-120)<.1);assert.ok(Math.abs(images[0].bounds[2]-165)<.1);
 assert.ok(Math.abs(images[1].bounds[0]-200)<.1);
 const replaced=await editContent(moved,0,images[0].id,{image:png(20,50,200)});
 const deleted=await editContent(replaced,0,(await listContent(replaced,0)).items.find(i=>i.type==='image').id,{remove:true});
 assert.equal((await listContent(deleted,0)).items.filter(i=>i.type==='image').length,1);
});
test('vector shapes remain vectors and can be recolored, moved, deleted, inserted',async()=>{
 const bytes=await fixture(),shape=(await listContent(bytes,0)).items.find(i=>i.type==='shape');
 const edited=await editContent(bytes,0,shape.id,{x:250,y:400,width:80,height:40,color:'#ff0000'});
 const vector=(await listContent(edited,0)).items.find(i=>i.type==='shape');
 assert.equal(vector.color,'#ff0000');assert.ok(Math.abs(vector.bounds[0]-250)<.1);
 const deleted=await editContent(edited,0,vector.id,{remove:true});
 assert.equal((await listContent(deleted,0)).items.filter(i=>i.type==='shape').length,0);
 const added=await editContent(deleted,0,null,{shape:true,x:10,y:20,width:70,height:30,color:'#123456'});
 assert.equal((await listContent(added,0)).items.filter(i=>i.type==='shape').length,1);
});
test('rotated cropped pages preserve displayed bounds during editing',async()=>{
 const bytes=await fixture(true),scene=await listContent(bytes,0),item=scene.items.find(i=>i.type==='text');
 const output=await editContent(bytes,0,item.id,{remove:true}),after=await listContent(output,0);
 assert.deepEqual(after.bounds,scene.bounds);assert.equal((await PDFDocument.load(output)).getPageCount(),1);
});
