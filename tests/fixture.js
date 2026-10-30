import {PDFDocument,StandardFonts,rgb,degrees} from 'pdf-lib';
import {deflateSync} from 'node:zlib';
function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(name,data){const type=Buffer.from(name),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([size,type,data,sum]);}
export function png(red=220,green=70,blue=50){
 const hdr=Buffer.alloc(13);hdr.writeUInt32BE(2,0);hdr.writeUInt32BE(2,4);hdr[8]=8;hdr[9]=2;
 const pixels=Buffer.from([0,red,green,blue,red,green,blue,0,red,green,blue,red,green,blue]);
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',hdr),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
export async function fixture(rotated=false){
 const d=await PDFDocument.create(),p=d.addPage([500,600]),font=await d.embedFont(StandardFonts.Helvetica),image=await d.embedPng(png());
 p.drawText('Original invoice',{x:40,y:530,size:24,font});
 p.drawText('Keep this line',{x:40,y:480,size:16,font});
 p.drawImage(image,{x:40,y:300,width:90,height:70});p.drawImage(image,{x:200,y:300,width:90,height:70});
 p.drawRectangle({x:40,y:100,width:100,height:60,color:rgb(.1,.6,.3)});
 if(rotated){p.setCropBox(20,20,450,550);p.setRotation(degrees(90));}
 return d.save();
}
