#!/usr/bin/env node
// Builds the CodeCloud launch video end to end, following the /brag workflow
// (https://github.com/latent-spaces/brag): inspect → plan → build, check, render → deliver.
//
//   BASE_URL=http://localhost:8080 node video/build.mjs [--out brag-output] [--publish] [--skip-capture]
//
// Needs a running CodeCloud server with Docker (for real lab sessions), Playwright Chromium and
// FFmpeg. Deliverables land in <out>/: brag.mp4, brag.jpg, brag-plan.md, share-copy.txt, work/.
// --publish also copies the video and poster to docs/assets/ for the README.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const root = path.resolve(import.meta.dirname, '..');
const { values: args } = parseArgs({
  options: {
    out: { type: 'string', default: path.join(root, 'brag-output') },
    publish: { type: 'boolean', default: false },
    'skip-capture': { type: 'boolean', default: false },
  },
});
const out = path.resolve(args.out);
const work = path.join(out, 'work');
fs.mkdirSync(work, { recursive: true });

const step = (label, script, ...scriptArgs) => {
  console.log(`\n▶ ${label}`);
  execFileSync(process.execPath, [path.join(root, 'video', script), ...scriptArgs], { cwd: root, stdio: 'inherit' });
};
const ffmpeg = (...ffArgs) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...ffArgs], { stdio: 'inherit' });

// 1. Inspect: real footage of the running product, and real facts from the repository.
if (!args['skip-capture']) step('Capturing product footage', 'capture.mjs', work);
step('Collecting catalog, workflow and lab-run data', 'collect-data.mjs', work);

// 2. Plan: the storyboard lives in video/brag-plan.md and is implemented by video/compose/.
fs.copyFileSync(path.join(root, 'video', 'brag-plan.md'), path.join(out, 'brag-plan.md'));

// 3. Build, check, render.
step('Rendering review stills', 'render.mjs', work, path.join(work, 'silent.mp4'), '--stills', path.join(work, 'stills'));
step('Rendering video', 'render.mjs', work, path.join(work, 'silent.mp4'));
step('Synthesizing soundtrack', 'music.mjs', path.join(work, 'timeline.json'), path.join(work, 'music.wav'));
console.log('\n▶ Mixing');
ffmpeg(
  '-i', path.join(work, 'silent.mp4'),
  '-i', path.join(work, 'music.wav'),
  '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-shortest', '-movflags', '+faststart',
  path.join(out, 'brag.mp4'),
);

// 4. Deliver: poster (already baked in as frame 0) and share copy.
fs.copyFileSync(path.join(work, 'poster.jpg'), path.join(out, 'brag.jpg'));
fs.copyFileSync(path.join(root, 'video', 'share-copy.txt'), path.join(out, 'share-copy.txt'));

if (args.publish) {
  const assets = path.join(root, 'docs', 'assets');
  fs.copyFileSync(path.join(out, 'brag.mp4'), path.join(assets, 'codecloud-demo.mp4'));
  ffmpeg('-i', path.join(out, 'brag.jpg'), '-vf', 'scale=1280:-2', '-q:v', '3', path.join(assets, 'codecloud-demo.jpg'));
  console.log('published docs/assets/codecloud-demo.mp4 and codecloud-demo.jpg');
}
console.log(`\n✓ ${path.relative(process.cwd(), path.join(out, 'brag.mp4'))}`);
