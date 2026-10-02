import { createHash } from 'node:crypto';
import { readFile,writeFile,readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const paths=(await readdir(new URL('src/',root),{recursive:true})).map(name=>name.replaceAll('\\','/')).filter(name=>name.endsWith('.js')&&name!=='deploymentProfile.js'&&!name.startsWith('schools/')).sort().map(name=>'src/'+name);
const files={};
for(const path of paths)files[path]=createHash('sha256').update(await readFile(new URL(path,root))).digest('hex');
const manifest={contractVersion:1,sourceRepository:'FYam8/waseshibu-progress-cloud',deploymentOwned:['src/deploymentProfile.js','src/schools/','wrangler.jsonc'],files};
const target=new URL('shared-manifest.json',root);
if(process.argv.includes('--write'))await writeFile(target,JSON.stringify(manifest,null,2)+'\n');
else{assert.deepEqual(JSON.parse(await readFile(target,'utf8')),manifest,'Shared source hashes changed; review and regenerate the manifest');console.log('Shared manifest verified');}
