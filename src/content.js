import {hasGeorgian,georgianFontBytes} from './fonts.js';
// SPDX-License-Identifier: AGPL-3.0-or-later
let pending;
async function engine(){
  if(!pending){
    const url=typeof window==='undefined'?'mupdf':new URL('vendor/mupdf/mupdf.js',document.baseURI).href;
    pending=import(/* @vite-ignore */url);
  }
  return pending;
}
const painting={fillPath:2,strokePath:2,fillText:1,strokeText:2,fillImage:1,fillImageMask:1};
const forwarding=['clipPath','clipStrokePath','clipText','clipStrokeText','ignoreText','fillShade','clipImageMask','popClip','beginMask','endMask','beginGroup','endGroup','beginTile','endTile','beginLayer','endLayer'];
const hexColor=c=>{
  let rgb=c?.length===3?c:c?.length===1?[c[0],c[0],c[0]]:c?.length===4?[1-Math.min(1,c[0]+c[3]),1-Math.min(1,c[1]+c[3]),1-Math.min(1,c[2]+c[3])]:[0,0,0];
  return '#'+rgb.map(v=>Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,'0')).join('');
};
const color=h=>h.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16)/255);
function describe(m,method,args,id){
  const mi=painting[method],ctm=args[mi],type=method.includes('Text')?'text':method.includes('Image')?'image':'shape';
  const bounds=type==='image'?m.Rect.transform([0,0,1,1],ctm):args[0].getBounds(method.startsWith('stroke')?args[1]:null,ctm);
  const item={id,type,bounds,method,color:hexColor(args[mi+2])};
  if(type==='text'){
    let value='',first=null,last=null;item.lineMatrices=[];
    args[0].walk({showGlyph(font,trm,gid,ucs){
      const matrix=m.Matrix.concat(trm,ctm),size=Math.hypot(matrix[0],matrix[1]);
      if(!first){first=matrix;item.font=font.getName();item.size=size;item.lineMatrices.push(matrix);}
      if(last&&Math.abs(matrix[5]-last[5])>Math.max(2,size*.6)){value+='\n';item.lineMatrices.push(matrix);}
      if(ucs>=0)value+=String.fromCodePoint(ucs);last=matrix;
    }});
    item.text=value;item.textMatrix=first;
  }
  return item;
}
function transformFor(item,patch){
  const b=item.bounds,w=Math.max(.01,b[2]-b[0]),h=Math.max(.01,b[3]-b[1]);
  const sx=patch.width==null?1:patch.width/w,sy=patch.height==null?1:patch.height/h;
  return [sx,0,0,sy,(patch.x??b[0])-b[0]*sx,(patch.y??b[1])-b[1]*sy];
}
export async function listContent(bytes,pageIndex){
  const m=await engine(),doc=m.Document.openDocument(bytes,'application/pdf'),items=[];
  let page,device,id=0;
  try{
    page=doc.loadPage(pageIndex);
    const callbacks={};
    for(const method of Object.keys(painting))callbacks[method]=(...args)=>{
      const item=describe(m,method,args,id++);
      if(item.bounds.every(Number.isFinite)&&item.bounds[2]>=item.bounds[0]&&item.bounds[3]>=item.bounds[1])items.push(item);
    };
    device=new m.Device(callbacks);page.run(device,m.Matrix.identity);device.close();
    return {items,bounds:page.getBounds()};
  }finally{device?.destroy();page?.destroy();doc.destroy();}
}
// Replay drawing commands into a new vector PDF. A selected paint operation is
// removed/replaced at its original stacking position; unrelated content is forwarded.
export async function editContent(bytes,pageIndex,objectId,patch){
  const georgian=patch.text!==undefined&&(hasGeorgian(patch.text)||patch.font==='Noto Sans Georgian')?await georgianFontBytes():null;
  const m=await engine(),doc=m.Document.openDocument(bytes,'application/pdf'),buffer=new m.Buffer();
  const writer=new m.DocumentWriter(buffer,'PDF','compress');
  let found=objectId==null;
  try{
    for(let i=0;i<doc.countPages();i++){
      const page=doc.loadPage(i),out=writer.beginPage(page.getBounds());
      let device;
      try{
        if(i!==pageIndex){page.run(out,m.Matrix.identity);}
        else{
          let id=0;
          const callbacks={};
          for(const method of forwarding)callbacks[method]=(...args)=>out[method](...args);
          for(const method of Object.keys(painting))callbacks[method]=(...args)=>{
            const selected=id++===objectId;
            if(!selected){out[method](...args);return;}
            found=true;
            if(patch.remove)return;
            const item=describe(m,method,args,objectId),mi=painting[method],ctm=args[mi],transform=transformFor(item,patch);
            if(item.type==='text'&&patch.text!==undefined){
              if(!item.textMatrix)throw new Error('This text has no editable characters.');
              let sourceFont;
              if(patch.preserveFont)args[0].walk({showGlyph(font){sourceFont??=font;}});
              const reuse=sourceFont&&[...patch.text].every(ch=>ch==='\n'||sourceFont.encodeCharacter(ch)>0);
              const font=reuse?sourceFont:georgian?new m.Font('NotoSansGeorgian',georgian):new m.Font(patch.font||'Helvetica'),text=new m.Text();
              try{
                const trm=m.Matrix.concat(item.textMatrix,transform),oldSize=Math.hypot(trm[0],trm[1])||12;
                const ratio=patch.size?patch.size/oldSize:1;
                for(let k=0;k<4;k++)trm[k]*=ratio;
                let line=0;
                for(const str of patch.text.split('\n')){
                  const matrix=patch.preserveFont&&item.lineMatrices[line]?[...item.lineMatrices[line]]:[...trm];
                  if(!(patch.preserveFont&&item.lineMatrices[line])){matrix[4]-=trm[2]*1.3*line;matrix[5]-=trm[3]*1.3*line;}
                  text.showString(font,matrix,str);line++;
                }
                out.fillText(text,m.Matrix.identity,m.ColorSpace.DeviceRGB,color(patch.color||item.color),1);
              }finally{text.destroy();if(!reuse)font.destroy();}
            }else if(item.type==='image'&&patch.image){
              const image=new m.Image(patch.image);
              try{out.fillImage(image,m.Matrix.concat(ctm,transform),1);}finally{image.destroy();}
            }else{
              args[mi]=m.Matrix.concat(ctm,transform);
              if(patch.color&&item.type!=='image'){args[mi+1]=m.ColorSpace.DeviceRGB;args[mi+2]=color(patch.color);}
              out[method](...args);
            }
          };
          device=new m.Device(callbacks);page.run(device,m.Matrix.identity);device.close();
          if(objectId==null&&patch.image){
            const image=new m.Image(patch.image);
            try{out.fillImage(image,[patch.width,0,0,patch.height,patch.x,patch.y],1);}finally{image.destroy();}
          }
          if(objectId==null&&patch.shape){
            const path=new m.Path();
            try{path.rect(patch.x,patch.y,patch.x+patch.width,patch.y+patch.height);out.fillPath(path,false,m.Matrix.identity,m.ColorSpace.DeviceRGB,color(patch.color||'#183e35'),1);}finally{path.destroy();}
          }
        }
        writer.endPage();
      }finally{device?.destroy();out.destroy();page.destroy();}
    }
    if(!found)throw new Error('The selected object has changed. Select it again.');
    writer.close();return buffer.asUint8Array().slice();
  }finally{writer.destroy();buffer.destroy();doc.destroy();}
}
