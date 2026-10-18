#!/usr/bin/env node
// Refreshes content/external/edx.json from the Open edX Course API.
// Usage: node scripts/sync-edx.js [--base-url URL] [--out FILE] [--max-pages N]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import YAML from 'yaml';
import { loadContent } from '../src/content/loader.js';
import { buildEntries, catalogDocument, fetchCourses, labsByCategory } from '../src/integrations/edx.js';

const root = path.resolve(import.meta.dirname, '..');
const { values: args } = parseArgs({
  options: {
    'content-dir': { type: 'string', default: path.join(root, 'content') },
    'base-url': { type: 'string' },
    out: { type: 'string' },
    'max-pages': { type: 'string', default: '500' },
    'delay-ms': { type: 'string', default: '250' },
  },
});

const contentDir = path.resolve(args['content-dir']);
const config = YAML.parse(fs.readFileSync(path.join(contentDir, 'external', 'edx-sources.yaml'), 'utf8'));
const out = path.resolve(args.out ?? path.join(contentDir, 'external', 'edx.json'));
const content = loadContent(contentDir);
const known = new Set(content.catalog.categories.map((c) => c.id));
for (const c of config.categories) {
  if (!known.has(c.id)) throw new Error(`edx-sources.yaml: unknown category "${c.id}"`);
}

const instances = args['base-url'] ? [{ provider: 'edx', base_url: args['base-url'] }] : config.instances;
const courses = [];
for (const instance of instances) {
  const raw = await fetchCourses(instance.base_url, {
    maxPages: Number(args['max-pages']),
    delayMs: Number(args['delay-ms']),
    log: (line) => console.error(line),
  });
  courses.push(
    ...buildEntries(raw, {
      provider: instance.provider,
      baseUrl: instance.base_url,
      categories: config.categories,
      maxPerCategory: config.max_per_category,
      labsByCategory: labsByCategory(content),
    }),
  );
}

const previous = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null;
const doc = catalogDocument(courses, previous);
if (!doc) {
  console.log(`unchanged: ${courses.length} courses`);
} else {
  fs.writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`wrote ${courses.length} courses to ${path.relative(root, out)}`);
}
