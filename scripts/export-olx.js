#!/usr/bin/env node
// Exports CodeCloud courses as Open edX OLX archives that Studio can import.
// Usage: node scripts/export-olx.js [--out DIR] [--lab-base-url https://labs.example.org] [--org NAME] [course-id ...]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadContent } from '../src/content/loader.js';
import { writeOlxArchive } from '../src/integrations/olx.js';

const root = path.resolve(import.meta.dirname, '..');
const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'content-dir': { type: 'string', default: path.join(root, 'content') },
    out: { type: 'string', default: path.join(root, 'dist', 'olx') },
    'lab-base-url': { type: 'string', default: process.env.CODECLOUD_PUBLIC_URL },
    org: { type: 'string', default: 'CodeCloud' },
  },
});

const { courses, labs } = loadContent(path.resolve(args['content-dir']));
const selected = positionals.length ? positionals : [...courses.keys()];
fs.mkdirSync(args.out, { recursive: true });
for (const id of selected) {
  const course = courses.get(id);
  if (!course) throw new Error(`unknown course "${id}"`);
  const archive = await writeOlxArchive(course, labs, args.out, { org: args.org, labBaseUrl: args['lab-base-url'] });
  console.log(path.relative(process.cwd(), archive));
}
