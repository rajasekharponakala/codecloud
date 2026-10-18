#!/usr/bin/env node
// Prints a JSON array of lab ids for the CI matrix.
//   node scripts/list-labs.js                         every lab and playground
//   node scripts/list-labs.js --changed-files FILE    only labs affected by the paths listed in FILE
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadContent } from '../src/content/loader.js';

const root = path.resolve(import.meta.dirname, '..');
const { values: args } = parseArgs({ options: { 'changed-files': { type: 'string' } } });
const { labs } = loadContent(path.join(root, 'content'));
const all = [...labs.keys()].sort();

// Changes to these affect how every lab is provisioned or graded.
const GLOBAL = [/^src\/runtime\//, /^src\/content\//, /^src\/cli\.js$/, /^package(-lock)?\.json$/];

function affected(files) {
  const selected = new Set();
  for (const file of files) {
    if (GLOBAL.some((re) => re.test(file))) return all;
    const lab = file.match(/^content\/labs\/([^/]+)\//)?.[1];
    if (lab && labs.has(lab)) selected.add(lab);
    const image = file.match(/^content\/images\/([^/]+)\//)?.[1];
    if (image) for (const l of labs.values()) if (l.imageName === image) selected.add(l.id);
  }
  return all.filter((id) => selected.has(id));
}

const ids = args['changed-files']
  ? affected(fs.readFileSync(args['changed-files'], 'utf8').split('\n').map((l) => l.trim()).filter(Boolean))
  : all;
console.log(JSON.stringify(ids));
