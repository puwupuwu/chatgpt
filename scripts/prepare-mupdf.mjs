import {mkdir,cp} from 'node:fs/promises';
await mkdir('public/vendor/mupdf',{recursive:true});
await cp('node_modules/mupdf/dist','public/vendor/mupdf',{recursive:true});

const {writeFile}=await import('node:fs/promises');
const root='https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/';
await mkdir('public/vendor/fonts',{recursive:true});
for(const [source,name] of [['ofl/notosansgeorgian/NotoSansGeorgian%5Bwdth%2Cwght%5D.ttf','NotoSansGeorgian-Regular.ttf'],['ofl/notosansgeorgian/OFL.txt','OFL.txt']]){
 const response=await fetch(root+source);
 if(!response.ok)throw new Error('Could not download bundled font asset: '+response.status+' '+source);
 await writeFile('public/vendor/fonts/'+name,new Uint8Array(await response.arrayBuffer()));
}
