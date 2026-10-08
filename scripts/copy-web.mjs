import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source = path.join(root,'apps/web/dist'); const target = path.join(root,'apps/api/wwwroot');
if (path.dirname(target) !== path.join(root,'apps/api')) throw new Error('Unexpected web output path.');
await fs.rm(target,{recursive:true,force:true}); await fs.cp(source,target,{recursive:true});
console.log('Web assets prepared for the Node.js API.');
