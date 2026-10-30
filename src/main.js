import './style.css';
import * as pdfjs from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { inspect, buildPdf, samplePdf } from './pdf.js';
import { listContent, editContent } from './content.js';
import {hasGeorgian,loadGeorgianFont} from './fonts.js';
import {stampMaker} from './stamps.js';
pdfjs.GlobalWorkerOptions.workerSrc=worker;
const $=id=>document.getElementById(id);
let original=null,pages=[],current=0,tool='text',busy=false,viewport,history=[],future=[],dirty=false,name='document.pdf',gesture=null,point=null;
let inlineEdit=null;
let pendingStamp=null;
let renderedBytes=null,contentItems=[],selected=null,objectDrag=null,imageMode='insert';
const copy=x=>structuredClone(x);
const status=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);};
function controls(){
  const editing=!!inlineEdit;
  $('objectList').disabled=busy||editing;
  for(const id of ['openStamps','insertImage','insertShape','applyObject','removeObject','replaceImage'])$(id).disabled=busy||!original||editing;
  $('applyObject').disabled=busy||!original;
  for(const id of ['export','rotate','delete','moveLeft','moveRight','prev','next']) $(id).disabled=busy||!pages.length||editing;
  $('delete').disabled=busy||editing||pages.length<2;
  $('prev').disabled=$('moveLeft').disabled=busy||editing||current===0;
  $('next').disabled=$('moveRight').disabled=busy||editing||current>=pages.length-1;
  $('undo').disabled=busy||editing||!history.length;$('redo').disabled=busy||editing||!future.length;
  $('open').disabled=$('choose').disabled=$('sample').disabled=$('zoom').disabled=busy||editing;
  for(const b of document.querySelectorAll('[data-tool]'))b.disabled=busy||editing;
  $('position').textContent=(current+1)+' / '+pages.length;
  $('pageCount').textContent=pages.length?pages.length+' pages':'';
}
async function locked(fn){
  if(busy)return;
  busy=true;controls();
  try{await fn();}catch(e){console.error(e);status('Could not complete this action: '+e.message,true);}
  finally{busy=false;controls();}
}
async function render(){
  closeInline();
  const data=await buildPdf(original,pages);
  renderedBytes=data.slice();selected=null;contentItems=[];$('objects').replaceChildren();$('properties').hidden=true;
  const doc=await pdfjs.getDocument({data:data.slice(),isEvalSupported:false}).promise;
  try{
    const p=await doc.getPage(current+1);
    viewport=p.getViewport({scale:Number($('zoom').value)});
    const canvas=$('canvas'),overlay=$('ink'),ratio=window.devicePixelRatio||1;
    canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);
    canvas.style.width=overlay.style.width=viewport.width+'px';canvas.style.height=overlay.style.height=viewport.height+'px';
    overlay.width=Math.ceil(viewport.width);overlay.height=Math.ceil(viewport.height);
    await p.render({canvasContext:canvas.getContext('2d'),viewport,transform:[ratio,0,0,ratio,0,0]}).promise;
  }finally{await doc.destroy();}
  if(tool==='select')await refreshContent();
  controls();
}
async function openBytes(bytes,filename){
  if((dirty||inlineEdit)&&!confirm('Open a new PDF and discard your unexported edits?'))return;
  const next=await inspect(bytes);
  if(!next.length)throw new Error('This PDF has no pages.');
  const old={original,pages,current,name,history,future,dirty};
  original=bytes;pages=next;current=0;name=filename;history=[];future=[];dirty=false;
  try{await render();}catch(e){({original,pages,current,name,history,future,dirty}=old);throw e;}
  $('filename').textContent=filename;$('empty').hidden=true;$('editor').hidden=false;
  status('Ready to edit. Your file stays on this device.');
}
async function openFile(file){if(!file)return;await locked(async()=>{
  if(file.size>50*1024*1024)throw new Error('Please choose a PDF smaller than 50 MB.');
  status('Opening PDF…');
  await openBytes(new Uint8Array(await file.arrayBuffer()),file.name);
});}
function snapshot(){return {original,pages:copy(pages),current};}
async function change(fn){await locked(async()=>{
  const before=snapshot();fn();
  try{await render();history.push(before);if(history.length>50)history.shift();future=[];dirty=true;status('Edit applied. Export to save a copy.');}
  catch(e){original=before.original;pages=before.pages;current=before.current;await render();throw e;}
});}
$('open').onclick=$('choose').onclick=()=>$('file').click();
$('file').onchange=async e=>{await openFile(e.target.files[0]);e.target.value='';};
$('sample').onclick=()=>locked(async()=>openBytes(await samplePdf(),'welcome.pdf'));
document.addEventListener('dragover',e=>{e.preventDefault();$('empty').classList.add('dragging');});
document.addEventListener('dragleave',()=>$('empty').classList.remove('dragging'));
document.addEventListener('drop',e=>{e.preventDefault();$('empty').classList.remove('dragging');openFile(e.dataTransfer.files[0]);});
for(const button of document.querySelectorAll('[data-tool]'))button.onclick=async()=>{
  if(busy)return;
  pendingStamp=null;tool=button.dataset.tool;
  for(const b of document.querySelectorAll('[data-tool]')){b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));}
  $('contentPanel').hidden=tool!=='select';$('objects').hidden=tool!=='select';$('ink').style.pointerEvents=tool==='select'?'none':'auto';
  if(tool==='select'&&original)await locked(refreshContent);
  $('hint').textContent={select:'Click text to type directly on the page. Drag objects to move them.',text:'Click on the page to place a text note.',highlight:'Drag across the area you want to highlight.',pen:'Draw with your mouse, pen, or finger to add a signature.'}[tool];
};
$('zoom').onchange=()=>{if(original)locked(render);};
$('prev').onclick=()=>locked(async()=>{current--;await render();});
$('next').onclick=()=>locked(async()=>{current++;await render();});
$('rotate').onclick=()=>change(()=>pages[current].rotation=(pages[current].rotation+90)%360);
$('delete').onclick=()=>change(()=>{if(pages.length>1){pages.splice(current,1);current=Math.min(current,pages.length-1);}});
$('moveLeft').onclick=()=>change(()=>{[pages[current-1],pages[current]]=[pages[current],pages[current-1]];current--;});
$('moveRight').onclick=()=>change(()=>{[pages[current+1],pages[current]]=[pages[current],pages[current+1]];current++;});
async function travel(from,to){if(!from.length)return;await locked(async()=>{
  const before=snapshot(),next=from[from.length-1];original=next.original;pages=copy(next.pages);current=next.current;
  try{await render();from.pop();to.push(before);dirty=true;status('History restored.');}catch(e){original=before.original;pages=before.pages;current=before.current;await render();throw e;}
});}
$('undo').onclick=()=>travel(history,future);$('redo').onclick=()=>travel(future,history);
document.addEventListener('keydown',e=>{
  if($('stampDialog').open||e.target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||$('textDialog').open)return;
  if(tool==='select'&&selected!==null&&(e.key==='Delete'||e.key==='Backspace')){e.preventDefault();applyContent({remove:true});return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?travel(future,history):travel(history,future);}
});
function pos(e){const r=$('ink').getBoundingClientRect();return [Math.max(0,Math.min(viewport.width,(e.clientX-r.left)*viewport.width/r.width)),Math.max(0,Math.min(viewport.height,(e.clientY-r.top)*viewport.height/r.height))];}
$('ink').onpointerdown=e=>{
  if(busy||!original||e.button!==0||tool==='select')return;
  const p=pos(e);
  if(tool==='stamp'){
    if(!pendingStamp)return;const stamp=pendingStamp;pendingStamp=null;
    const zoom=Number($('zoom').value),width=stamp.width,height=stamp.width*stamp.height/stamp.pixelWidth;
    tool='select';$('contentPanel').hidden=false;$('objects').hidden=false;$('ink').style.pointerEvents='none';
    for(const b of document.querySelectorAll('[data-tool]')){b.classList.toggle('selected',b.dataset.tool==='select');b.setAttribute('aria-pressed',String(b.dataset.tool==='select'));}
    applyContent({image:stamp.image,x:Math.max(0,Math.min(p[0]/zoom,viewport.width/zoom-width)),y:Math.max(0,Math.min(p[1]/zoom,viewport.height/zoom-height)),width,height},null);return;
  }
  if(tool==='text'){point=viewport.convertToPdfPoint(...p);$('textValue').value='';$('textDialog').returnValue='';$('textDialog').showModal();$('textValue').focus();return;}
  $('ink').setPointerCapture(e.pointerId);gesture={tool,points:[p],id:e.pointerId,color:$('color').value};
};
$('ink').onpointermove=e=>{
  if(!gesture||gesture.id!==e.pointerId)return;
  gesture.points.push(pos(e));
  const c=$('ink').getContext('2d');c.clearRect(0,0,$('ink').width,$('ink').height);
  const first=gesture.points[0],last=gesture.points.at(-1);
  if(gesture.tool==='highlight'){c.fillStyle='#ffcc2652';c.fillRect(first[0],first[1],last[0]-first[0],last[1]-first[1]);}
  else{c.strokeStyle=gesture.color;c.lineWidth=2*Number($('zoom').value);c.lineCap='round';c.lineJoin='round';c.beginPath();gesture.points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.stroke();}
};
$('ink').onpointerup=e=>{
  if(!gesture||gesture.id!==e.pointerId)return;
  const g=gesture;gesture=null;$('ink').getContext('2d').clearRect(0,0,$('ink').width,$('ink').height);
  if(g.points.length<2)return;
  const pts=g.points.map(p=>viewport.convertToPdfPoint(...p));
  let a;
  if(g.tool==='highlight'){const first=pts[0],last=pts.at(-1);a={type:'highlight',x:Math.min(first[0],last[0]),y:Math.min(first[1],last[1]),width:Math.abs(last[0]-first[0]),height:Math.abs(last[1]-first[1])};if(a.width<1||a.height<1)return;}
  else a={type:'pen',points:pts,color:g.color};
  change(()=>pages[current].annotations.push(a));
};
$('ink').onpointercancel=()=>{gesture=null;$('ink').getContext('2d').clearRect(0,0,$('ink').width,$('ink').height);};
$('textDialog').addEventListener('close',()=>{
  if($('textDialog').returnValue!=='add')return;
  const text=$('textValue').value.trim(),size=Math.max(8,Math.min(72,Number($('size').value)||18));
  if(!text)return;
  change(()=>pages[current].annotations.push({type:'text',text,x:point[0],y:point[1],size,color:$('color').value}));
});
$('export').onclick=()=>locked(async()=>{
  status('Preparing your PDF…');
  const bytes=await buildPdf(original,pages),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  const a=document.createElement('a');a.href=url;a.download=name.replace(/\.pdf$/i,'')+'-edited.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  dirty=false;status('Export downloaded. Your original file is unchanged.');
});
window.addEventListener('beforeunload',e=>{if(dirty||inlineEdit){e.preventDefault();e.returnValue='';}});
controls();

function objectLabel(item){return item.type==='text'?'Text: '+item.text.replace(/\s+/g,' ').slice(0,70):item.type==='image'?'Image '+(item.id+1):'Vector shape '+(item.id+1);}
async function refreshContent(){
  if(!renderedBytes)return;
  status('Reading editable content…');
  const result=await listContent(renderedBytes,current);contentItems=result.items;
  const list=$('objectList');list.replaceChildren(new Option('Select an object…',''));
  for(const item of contentItems)list.add(new Option(objectLabel(item),String(item.id)));
  paintObjects();status(contentItems.length+' editable objects. Select one to edit.');
}
function paintObjects(){
  const root=$('objects');root.replaceChildren();const zoom=Number($('zoom').value);
  for(const item of contentItems){
    const b=item.bounds,button=document.createElement('button');button.className='object-box';if(item.type==='text')button.classList.add('text-object');
    button.dataset.objectId=item.id;button.dataset.objectType=item.type;button.title=objectLabel(item);button.setAttribute('aria-label',objectLabel(item));
    button.style.cssText='left:'+b[0]*zoom+'px;top:'+b[1]*zoom+'px;width:'+Math.max(6,(b[2]-b[0])*zoom)+'px;height:'+Math.max(6,(b[3]-b[1])*zoom)+'px';
    const grip=document.createElement('span');grip.className='resize-grip';button.append(grip);
    button.onclick=e=>{if(!busy&&!inlineEdit){selectObject(item.id);if(item.type==='text')startInline(item,e);}};
    button.onpointerdown=e=>{
      if(busy||inlineEdit||e.button!==0)return;e.preventDefault();selectObject(item.id);button.setPointerCapture(e.pointerId);
      objectDrag={id:item.id,start:[e.clientX,e.clientY],bounds:[...b],resize:e.target===grip,button,changed:false,pointer:e.pointerId};
    };
    button.onpointermove=e=>{
      if(!objectDrag||objectDrag.pointer!==e.pointerId)return;
      const d=objectDrag,dx=(e.clientX-d.start[0])/zoom,dy=(e.clientY-d.start[1])/zoom;
      if(Math.abs(dx)+Math.abs(dy)<2&&!d.changed)return;
      d.changed=true;
      if(d.resize){$('objectW').value=Math.max(1,d.bounds[2]-d.bounds[0]+dx).toFixed(1);$('objectH').value=Math.max(1,d.bounds[3]-d.bounds[1]+dy).toFixed(1);}
      else{$('objectX').value=(d.bounds[0]+dx).toFixed(1);$('objectY').value=(d.bounds[1]+dy).toFixed(1);}
      button.style.left=$('objectX').value*zoom+'px';button.style.top=$('objectY').value*zoom+'px';button.style.width=$('objectW').value*zoom+'px';button.style.height=$('objectH').value*zoom+'px';
    };
    button.onpointerup=()=>{const d=objectDrag;objectDrag=null;if(d?.changed)applyContent(geometry());};
    button.onpointercancel=()=>{objectDrag=null;paintObjects();if(selected!==null)selectObject(selected);};
    root.append(button);
  }
}
function selectObject(id){
  const item=contentItems.find(i=>i.id===id);if(!item)return;
  selected=id;$('properties').hidden=false;$('objectList').value=String(id);$('objectType').textContent=objectLabel(item);
  for(const b of $('objects').children)b.classList.toggle('active',Number(b.dataset.objectId)===id);
  const [x,y,x2,y2]=item.bounds;
  for(const [key,val] of Object.entries({objectX:x,objectY:y,objectW:Math.max(1,x2-x),objectH:Math.max(1,y2-y)}))$(key).value=val.toFixed(1);
  $('textProperties').hidden=item.type!=='text';$('replaceImage').hidden=item.type!=='image';$('objectColorLabel').hidden=item.type==='image';
  $('objectText').value=item.text||'';$('objectSize').value=Math.round(item.size||18);$('objectColor').value=item.color;
  $('objectFont').value=hasGeorgian(item.text||'')?'Noto Sans Georgian':item.font?.includes('Times')?'Times-Roman':item.font?.includes('Courier')?'Courier':'Helvetica';
}
$('objectList').onchange=e=>{if(e.target.value!=='')selectObject(Number(e.target.value));};
function geometry(){
  const patch={x:Number($('objectX').value),y:Number($('objectY').value),width:Number($('objectW').value),height:Number($('objectH').value)};
  if(!Object.values(patch).every(Number.isFinite)||patch.width<=0||patch.height<=0)throw new Error('Use finite positions and positive dimensions.');
  return patch;
}
async function applyContent(patch,id=selected){
  if(!original||(!patch.image&&!patch.shape&&id===null))return;
  closeInline();
  await locked(async()=>{
    status('Updating PDF content…');await new Promise(resolve=>requestAnimationFrame(resolve));
    const before=snapshot();
    try{
      const bytes=await editContent(renderedBytes,current,id,patch);
      original=bytes;pages=await inspect(bytes);
      await render();history.push(before);if(history.length>30)history.shift();future=[];dirty=true;
      status('Content updated. Export to save your changes.');
    }catch(e){original=before.original;pages=before.pages;current=before.current;await render();throw e;}
  });
}
$('applyObject').onclick=()=>{
  try{
    const item=contentItems.find(i=>i.id===selected);if(!item)return;
    const patch=geometry();
    if(item.type!=='image')patch.color=$('objectColor').value;
    if(item.type==='text'){
      patch.text=$('objectText').value;patch.font=$('objectFont').value;patch.size=Number($('objectSize').value);
      if(!Number.isFinite(patch.size)||patch.size<4||patch.size>200)throw new Error('Font size must be between 4 and 200.');
    }
    applyContent(patch);
  }catch(e){status(e.message,true);}
};
$('removeObject').onclick=()=>applyContent({remove:true});
$('insertImage').onclick=()=>{imageMode='insert';$('imageFile').click();};
$('replaceImage').onclick=()=>{imageMode='replace';$('imageFile').click();};
$('imageFile').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file||busy)return;
  try{
    if(!['image/png','image/jpeg'].includes(file.type)||file.size>20*1024*1024)throw new Error('Choose a PNG or JPEG image smaller than 20 MB.');
    const image=new Uint8Array(await file.arrayBuffer());
    if(imageMode==='replace')await applyContent({image});
    else{
      const bitmap=await createImageBitmap(file);const width=Math.min(200,viewport.width/Number($('zoom').value)-40),height=width*bitmap.height/bitmap.width;bitmap.close();
      await applyContent({image,x:20,y:20,width,height},null);
    }
  }catch(e){status('Could not load image: '+e.message,true);}
};
$('insertShape').onclick=()=>applyContent({shape:true,x:40,y:40,width:140,height:80,color:$('color').value},null);

function closeInline(){
  if(!inlineEdit)return;
  inlineEdit.host.remove();inlineEdit=null;$('objects').classList.remove('editing');
}
function startInline(item,event){
  if(busy||inlineEdit)return;
  const zoom=Number($('zoom').value),b=item.bounds,host=document.createElement('div');
  host.className='inline-text-host';host.style.left=b[0]*zoom+'px';host.style.top=b[1]*zoom+'px';
  host.style.width=Math.max(100,(b[2]-b[0])*zoom+20)+'px';
  const editor=document.createElement('div');editor.id='inlineText';editor.className='inline-text';
  editor.contentEditable='plaintext-only';editor.setAttribute('role','textbox');editor.setAttribute('aria-label','Edit text on page');editor.setAttribute('aria-multiline','true');editor.spellcheck=false;
  editor.style.fontSize=(item.size||18)*zoom+'px';editor.style.color=item.color;
  editor.style.fontFamily=item.font?.includes('Times')?'Times New Roman, serif':item.font?.includes('Courier')?'Courier New, monospace':'Arial, sans-serif';
  editor.style.fontFamily+=', "Paperdesk Georgian"';
  if(hasGeorgian(item.text))editor.style.fontFamily='"Paperdesk Georgian", Arial, sans-serif';
  editor.style.minHeight=Math.max((b[3]-b[1])*zoom,(item.size||18)*zoom*1.3)+'px';
  editor.textContent=item.text;
  const bar=document.createElement('div');bar.className='inline-toolbar';
  const done=document.createElement('button');done.textContent='Done';done.className='primary';done.type='button';
  const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.type='button';
  const hint=document.createElement('span');hint.textContent='Ctrl/⌘ Enter saves · Esc cancels';
  bar.append(done,cancel,hint);host.append(editor,bar);$('sheet').append(host);
  inlineEdit={host,editor,item};$('objects').classList.add('editing');controls();
  editor.oninput=()=>{$('objectText').value=editor.innerText;if(hasGeorgian(editor.innerText))editor.style.fontFamily='"Paperdesk Georgian", Arial, sans-serif';};
  editor.onkeydown=e=>{
    e.stopPropagation();
    if(e.key==='Escape'){e.preventDefault();cancelInline();}
    else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();saveInline();}
  };
  editor.onpaste=e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'));};
  done.onclick=saveInline;cancel.onclick=cancelInline;editor.focus({preventScroll:true});
  const selection=window.getSelection();let range;
  if(event?.clientX){
    if(document.caretPositionFromPoint){
      const p=document.caretPositionFromPoint(event.clientX,event.clientY);
      if(p&&editor.contains(p.offsetNode)){range=document.createRange();range.setStart(p.offsetNode,p.offset);range.collapse(true);}
    }else if(document.caretRangeFromPoint){
      const r=document.caretRangeFromPoint(event.clientX,event.clientY);if(r&&editor.contains(r.startContainer))range=r;
    }
  }
  if(!range){range=document.createRange();range.selectNodeContents(editor);range.collapse(false);}
  selection.removeAllRanges();selection.addRange(range);
  status('Edit letters directly here. Use Done to keep changes or Escape to cancel.');
}
function cancelInline(){
  const item=inlineEdit?.item;closeInline();controls();if(item)selectObject(item.id);
  status('Text edit canceled.');
}
async function saveInline(){
  if(!inlineEdit||busy)return;
  const {editor,item}=inlineEdit,text=editor.innerText.replace(/\r\n/g,'\n');
  if(text===item.text){closeInline();controls();status('Text unchanged.');return;}
  if(text.length>10000){status('Please keep this text block under 10,000 characters.',true);return;}
  await applyContent({text,preserveFont:true},item.id);
}
$('objectText').addEventListener('input',()=>{if(inlineEdit)inlineEdit.editor.textContent=$('objectText').value;});

loadGeorgianFont().catch(error=>status(error.message,true));
stampMaker(async stamp=>{
 if(busy||!original||inlineEdit)return;
 pendingStamp=stamp;tool='stamp';$('contentPanel').hidden=true;$('objects').hidden=true;$('ink').style.pointerEvents='auto';
 for(const b of document.querySelectorAll('[data-tool]')){b.classList.remove('selected');b.setAttribute('aria-pressed','false');}
 status('Click on the page to place your stamp. Choose another tool to cancel.');
});
