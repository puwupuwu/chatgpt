import {loadGeorgianFont} from './fonts.js';
const $=id=>document.getElementById(id);
const key='paperdesk.stamps.v1';
function readLibrary(){
 try{
  const value=JSON.parse(localStorage.getItem(key)||'[]');
  return Array.isArray(value)?value.filter(s=>typeof s.id==='string'&&typeof s.name==='string'&&/^data:image\/png;base64,/.test(s.dataUrl)&&s.dataUrl.length<3000000&&Number.isFinite(s.width)).slice(0,12):[];
 }catch{return [];}
}
function bytes(dataUrl){return Uint8Array.from(atob(dataUrl.split(',')[1]),c=>c.charCodeAt(0));}
export function stampMaker(onPlace){
 let library=readLibrary(),custom=null,current=null,version=0,selectedId=null;
 function refreshLibrary(){
  $('savedStamps').replaceChildren(new Option('Choose a saved stamp…',''));
  for(const s of library)$('savedStamps').add(new Option(s.name,s.id));
  $('removeSavedStamp').disabled=!selectedId;
 }
 async function makePreview(){
  const request=++version;$('placeStamp').disabled=true;$('stampStatus').textContent='';
  try{
   await loadGeorgianFont();
   let dataUrl,pixelWidth,height;
   if(custom){
    const bitmap=await createImageBitmap(new Blob([bytes(custom)],{type:'image/png'}));
    dataUrl=custom;pixelWidth=bitmap.width;height=bitmap.height;bitmap.close();
   }else{
    const label=$('stampText').value.trim();if(!label)throw new Error('Enter stamp text or upload a stamp image.');
    const canvas=document.createElement('canvas');canvas.width=900;canvas.height=$('stampDateEnabled').checked?270:210;
    const c=canvas.getContext('2d'),ink=$('stampColor').value;
    c.strokeStyle=ink;c.lineWidth=8;c.strokeRect(10,10,880,canvas.height-20);c.lineWidth=2;c.strokeRect(24,24,852,canvas.height-48);
    let size=70;c.font=size+'px "Paperdesk Georgian", sans-serif';
    while(c.measureText(label).width>810&&size>12){size--;c.font=size+'px "Paperdesk Georgian", sans-serif';}
    c.textAlign='center';c.textBaseline='middle';c.fillStyle=ink;c.fillText(label,450,$('stampDateEnabled').checked?105:105);
    if($('stampDateEnabled').checked){
     if(!$('stampDate').value)throw new Error('Choose a date or turn off Include date.');
     const [year,month,day]=$('stampDate').value.split('-');
     c.font='34px "Paperdesk Georgian", sans-serif';c.fillText(day+'.'+month+'.'+year,450,194);
    }
    dataUrl=canvas.toDataURL('image/png');pixelWidth=canvas.width;height=canvas.height;
   }
   if(request!==version)return;
   current={dataUrl,pixelWidth,height};$('stampPreview').src=dataUrl;$('placeStamp').disabled=false;
  }catch(error){if(request===version){current=null;$('stampStatus').textContent=error.message;}}
 }
 $('openStamps').onclick=()=>{
  selectedId=null;refreshLibrary();$('stampDialog').returnValue='';$('stampDialog').showModal();makePreview();
 };
 const date=new Date();$('stampDate').value=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
 $('stampPreset').onchange=()=>{custom=null;selectedId=null;$('stampText').value=$('stampPreset').value;makePreview();};
 for(const id of ['stampText','stampColor','stampDate','stampDateEnabled'])$(id).addEventListener('input',()=>{custom=null;selectedId=null;makePreview();});
 $('savedStamps').onchange=()=>{
  const saved=library.find(s=>s.id===$('savedStamps').value);selectedId=saved?.id||null;$('removeSavedStamp').disabled=!saved;
  if(saved){custom=saved.dataUrl;$('stampText').value=saved.name;$('stampWidth').value=saved.width;makePreview();}
 };
 $('uploadStamp').onclick=()=>$('stampImageFile').click();
 $('stampImageFile').onchange=async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  try{
   if(!['image/png','image/jpeg'].includes(file.type)||file.size>5*1024*1024)throw new Error('Choose a PNG or JPEG smaller than 5 MB.');
   const bitmap=await createImageBitmap(file);
   try{
    const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    custom=canvas.toDataURL('image/png');selectedId=null;$('stampText').value=file.name.replace(/\.[^.]+$/,'');await makePreview();
   }finally{bitmap.close();}
  }catch(error){$('stampStatus').textContent=error.message;}
 };
 $('removeSavedStamp').onclick=()=>{
  if(!selectedId)return;
  const next=library.filter(s=>s.id!==selectedId);
  try{localStorage.setItem(key,JSON.stringify(next));library=next;selectedId=null;refreshLibrary();$('stampStatus').textContent='Saved stamp removed.';}
  catch{$('stampStatus').textContent='Browser storage is unavailable.';}
 };
 $('stampForm').onsubmit=event=>{
  if(event.submitter?.id!=='placeStamp')return;
  event.preventDefault();if(!current)return;
  const width=Number($('stampWidth').value);
  if(!Number.isFinite(width)||width<30||width>500){$('stampStatus').textContent='Choose a width from 30 to 500 points.';return;}
  let stored=true;
  if($('rememberStamp').checked){
   const entry={id:crypto.randomUUID(),name:$('stampText').value.trim()||'Image stamp',dataUrl:current.dataUrl,width};
   const next=[entry,...library.filter(s=>s.dataUrl!==entry.dataUrl)].slice(0,12);
   try{localStorage.setItem(key,JSON.stringify(next));library=next;}catch{stored=false;}
  }
  const stamp={image:bytes(current.dataUrl),pixelWidth:current.pixelWidth,height:current.height,width};
  $('stampDialog').close('place');onPlace(stamp);
  if(!stored)document.getElementById('status').textContent='Click to place the stamp. Browser storage is full; this stamp was not saved for reuse.';
 };
 refreshLibrary();
}
