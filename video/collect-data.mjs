// Gathers the facts shown in the video's graphic scenes straight from the repository, so every
// number, title and log line on screen is real. Writes <out-dir>/data.json.
//
//   node video/collect-data.mjs <out-dir> [--skip-lab-run]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as tar from 'tar';
import YAML from 'yaml';
import { loadContent } from '../src/content/loader.js';
import { writeOlxArchive } from '../src/integrations/olx.js';

const root = path.resolve(import.meta.dirname, '..');
const OUT = path.resolve(process.argv[2] ?? 'brag-output/work');
const skipLabRun = process.argv.includes('--skip-lab-run');
fs.mkdirSync(OUT, { recursive: true });

const content = loadContent(path.join(root, 'content'));
const categories = new Map(content.catalog.categories.map((c) => [c.id, c.title]));
const labs = [...content.labs.values()];

// Workflows: name, triggers and schedules, read from the YAML itself.
const workflowDir = path.join(root, '.github', 'workflows');
const workflows = fs
  .readdirSync(workflowDir)
  .filter((f) => f.endsWith('.yml'))
  .sort()
  .map((file) => {
    const doc = YAML.parse(fs.readFileSync(path.join(workflowDir, file), 'utf8'));
    const on = doc.on ?? {};
    return {
      file,
      name: doc.name,
      triggers: Object.keys(on),
      crons: (on.schedule ?? []).map((s) => s.cron),
      jobs: Object.keys(doc.jobs ?? {}).length,
    };
  });

// A real smoke test of one lab: the same command the nightly workflow runs.
let labRun = [];
if (!skipLabRun) {
  try {
    labRun = execFileSync(process.execPath, ['src/cli.js', 'test-lab', 'linux-processes', '--solve'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300_000,
    })
      .trim()
      .split('\n');
  } catch (err) {
    console.error(`test-lab failed, the automation scene will omit its output: ${err.message}`);
  }
}

// A real Open edX export: the file tree inside one OLX archive.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'olx-'));
const archive = await writeOlxArchive(content.courses.get('kubernetes-fundamentals'), content.labs, tmp, {
  labBaseUrl: 'https://labs.example.org',
});
const olx = [];
await tar.list({ file: archive, onReadEntry: (entry) => olx.push(entry.path) });
fs.rmSync(tmp, { recursive: true, force: true });

const edxSources = YAML.parse(fs.readFileSync(path.join(root, 'content', 'external', 'edx-sources.yaml'), 'utf8'));
const repo =
  process.env.GITHUB_REPOSITORY ??
  execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' })
    .trim()
    .match(/github\.com[/:]([^/]+\/[^/.]+)|\/git\/([^/]+\/[^/.]+)/)
    ?.slice(1)
    .find(Boolean) ??
  'codecloud';

const data = {
  counts: {
    courses: content.courses.size,
    labs: labs.filter((l) => l.kind === 'lab').length,
    playgrounds: labs.filter((l) => l.kind === 'playground').length,
    paths: content.catalog.paths.length,
    categories: content.catalog.categories.length,
    tasks: labs.reduce((n, l) => n + l.tasks.length, 0),
  },
  courses: [...content.courses.values()]
    .map((c) => ({ title: c.title, category: categories.get(c.category), level: c.level }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title)),
  paths: content.catalog.paths.map((p) => ({ title: p.title, courses: p.courses.length })),
  environments: [...new Set(labs.map((l) => l.environment.image ?? `codecloud-lab/${l.imageName}`))].sort(),
  workflows,
  labRun,
  olx: { course: 'kubernetes-fundamentals', files: olx.filter((f) => !f.endsWith('/')) },
  edx: {
    sources: edxSources.instances.map((i) => i.base_url),
    count: content.external.length,
    courses: content.external.slice(0, 6).map((c) => ({ title: c.title, org: c.org, category: categories.get(c.category) })),
  },
  repo: `github.com/${repo}`,
};

fs.writeFileSync(path.join(OUT, 'data.json'), `${JSON.stringify(data, null, 2)}\n`);
console.log(`wrote ${path.join(OUT, 'data.json')}`);
