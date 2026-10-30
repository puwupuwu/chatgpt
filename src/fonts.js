let cached;
export const hasGeorgian=text=>/[\u10a0-\u10ff\u1c90-\u1cbf\u2d00-\u2d2f]/u.test(text);
export async function georgianFontBytes(){
 if(!cached)cached=(async()=>{
  if(typeof window==='undefined'){
   const module='node:fs/promises';const fs=await import(/* @vite-ignore */module);
   return new Uint8Array(await fs.readFile(new URL('../public/vendor/fonts/NotoSansGeorgian-Regular.ttf',import.meta.url)));
  }
  const response=await fetch(new URL('vendor/fonts/NotoSansGeorgian-Regular.ttf',document.baseURI));
  if(!response.ok)throw new Error('Georgian font could not be loaded. Please retry.');
  return new Uint8Array(await response.arrayBuffer());
 })().catch(error=>{cached=null;throw error;});
 return cached;
}
let browserFont;
export async function loadGeorgianFont(){
 if(typeof document==='undefined')return;
 if(!browserFont)browserFont=(async()=>{
  const face=new FontFace('Paperdesk Georgian',await georgianFontBytes());
  await face.load();document.fonts.add(face);
 })().catch(error=>{browserFont=null;throw error;});
 return browserFont;
}
