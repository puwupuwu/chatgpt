import {mkdir,cp} from 'node:fs/promises';
await mkdir('public/vendor/mupdf',{recursive:true});
await cp('node_modules/mupdf/dist','public/vendor/mupdf',{recursive:true});
