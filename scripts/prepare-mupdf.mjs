import {mkdir,cp} from 'node:fs/promises';
await mkdir('public/vendor/mupdf',{recursive:true});
await cp('node_modules/mupdf/dist','public/vendor/mupdf',{recursive:true});

const {writeFile}=await import('node:fs/promises');
const root='https://raw.githubusercontent.com/notofonts/noto-fonts/ffebf8c1ee449e544955a7e813c54f9b73848eac/';
await mkdir('public/vendor/fonts',{recursive:true});
for(const [source,name] of [['hinted/ttf/NotoSansGeorgian/NotoSansGeorgian-Regular.ttf','NotoSansGeorgian-Regular.ttf'],['LICENSE','OFL.txt']]){
 const response=await fetch(root+source);
 if(!response.ok)throw new Error('Could not download bundled font asset: '+response.status+' '+source);
 await writeFile('public/vendor/fonts/'+name,new Uint8Array(await response.arrayBuffer()));
}
