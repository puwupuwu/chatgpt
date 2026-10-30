import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
export async function inspect(bytes) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p,index)=>({index,rotation:p.getRotation().angle,annotations:[]}));
}
export function color(hex) { return rgb(...hex.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16)/255)); }
export async function buildPdf(bytes,pages) {
  if (!pages.length) throw new Error('Keep at least one page.');
  const source=await PDFDocument.load(bytes);
  const doc=await PDFDocument.create();
  const font=await doc.embedFont(StandardFonts.Helvetica);
  const copies=await doc.copyPages(source,pages.map(p=>p.index));
  for(let i=0;i<copies.length;i++){
    const p=copies[i]; doc.addPage(p); p.setRotation(degrees(pages[i].rotation));
    for(const a of pages[i].annotations){
      if(a.type==='text') p.drawText(a.text,{x:a.x,y:a.y,size:a.size,font,color:color(a.color),lineHeight:a.size*1.3});
      if(a.type==='highlight') p.drawRectangle({x:a.x,y:a.y,width:a.width,height:a.height,color:rgb(1,0.8,0.15),opacity:0.32});
      if(a.type==='pen') for(let j=1;j<a.points.length;j++) p.drawLine({start:{x:a.points[j-1][0],y:a.points[j-1][1]},end:{x:a.points[j][0],y:a.points[j][1]},thickness:2,color:color(a.color)});
    }
  }
  return doc.save();
}
export async function samplePdf(){
  const d=await PDFDocument.create(); const font=await d.embedFont(StandardFonts.Helvetica);
  for(let i=0;i<2;i++){const p=d.addPage([595,842]);p.drawText(i?'A little space for your ideas.':'Good things start on paper.',{x:55,y:735,size:26,font,color:rgb(.09,.24,.20)});p.drawText(i?'Add a note. Make your mark.':'A sample document for your first edit.',{x:55,y:695,size:14,font});p.drawText('PROJECT NOTES',{x:55,y:620,size:11,font});for(let y=580;y>160;y-=45)p.drawLine({start:{x:55,y},end:{x:540,y},color:rgb(.85,.86,.83),thickness:1});p.drawText(String(i+1).padStart(2,'0'),{x:55,y:55,size:11,font});}
  return d.save();
}