import './style.css';
import * as pdfjs from 'pdfjs-dist';
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { inspect, buildPdf, samplePdf } from './pdf.js';
pdfjs.GlobalWorkerOptions.workerSrc=worker;
const $=id=>document.getElementById(id);
let original=null,pages=[],current=0,tool='text',busy=false,viewport,history=[],future=[],dirty=false,name='document.pdf',gesture=null,point=null;
const copy=x=>structuredClone(x);
const status=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);};
function controls(){
  for(const id of ['export','rotate','delete','moveLeft','moveRight','prev','next']) $(id).disabled=busy||!pages.length;
  $('delete').disabled=busy||pages.length<2;
  $('prev').disabled=$('moveLeft').disabled=busy||current===0;
  $('next').disabled=$('moveRight').disabled=busy||current>=pages.length-1;
  $('undo').disabled=busy||!history.length;$('redo').disabled=busy||!future.length;
  $('open').disabled=$('choose').disabled=$('sample').disabled=$('zoom').disabled=busy;
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
  const data=await buildPdf(original,pages);
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
  controls();
}
async function openBytes(bytes,filename){
  if(dirty&&!confirm('Open a new PDF and discard your unexported edits?'))return;
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
function snapshot(){return {pages:copy(pages),current};}
async function change(fn){await locked(async()=>{
  const before=snapshot();fn();
  try{await render();history.push(before);if(history.length>50)history.shift();future=[];dirty=true;status('Edit applied. Export to save a copy.');}
  catch(e){pages=before.pages;current=before.current;await render();throw e;}
});}
$('open').onclick=$('choose').onclick=()=>$('file').click();
$('file').onchange=async e=>{await openFile(e.target.files[0]);e.target.value='';};
$('sample').onclick=()=>locked(async()=>openBytes(await samplePdf(),'welcome.pdf'));
document.addEventListener('dragover',e=>{e.preventDefault();$('empty').classList.add('dragging');});
document.addEventListener('dragleave',()=>$('empty').classList.remove('dragging'));
document.addEventListener('drop',e=>{e.preventDefault();$('empty').classList.remove('dragging');openFile(e.dataTransfer.files[0]);});
for(const button of document.querySelectorAll('[data-tool]'))button.onclick=()=>{
  tool=button.dataset.tool;
  for(const b of document.querySelectorAll('[data-tool]')){b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));}
  $('hint').textContent={text:'Click on the page to place a text note.',highlight:'Drag across the area you want to highlight.',pen:'Draw with your mouse, pen, or finger to add a signature.'}[tool];
};
$('zoom').onchange=()=>{if(original)locked(render);};
$('prev').onclick=()=>locked(async()=>{current--;await render();});
$('next').onclick=()=>locked(async()=>{current++;await render();});
$('rotate').onclick=()=>change(()=>pages[current].rotation=(pages[current].rotation+90)%360);
$('delete').onclick=()=>change(()=>{if(pages.length>1){pages.splice(current,1);current=Math.min(current,pages.length-1);}});
$('moveLeft').onclick=()=>change(()=>{[pages[current-1],pages[current]]=[pages[current],pages[current-1]];current--;});
$('moveRight').onclick=()=>change(()=>{[pages[current+1],pages[current]]=[pages[current],pages[current+1]];current++;});
async function travel(from,to){if(!from.length)return;await locked(async()=>{
  const before=snapshot(),next=from[from.length-1];pages=copy(next.pages);current=next.current;
  try{await render();from.pop();to.push(before);dirty=true;status('History restored.');}catch(e){pages=before.pages;current=before.current;await render();throw e;}
});}
$('undo').onclick=()=>travel(history,future);$('redo').onclick=()=>travel(future,history);
document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||$('textDialog').open)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?travel(future,history):travel(history,future);}
});
function pos(e){const r=$('ink').getBoundingClientRect();return [Math.max(0,Math.min(viewport.width,(e.clientX-r.left)*viewport.width/r.width)),Math.max(0,Math.min(viewport.height,(e.clientY-r.top)*viewport.height/r.height))];}
$('ink').onpointerdown=e=>{
  if(busy||!original||e.button!==0)return;
  const p=pos(e);
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
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
controls();
