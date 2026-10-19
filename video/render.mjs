// Renders the composition frame by frame with Playwright and encodes it with FFmpeg.
//
//   node video/render.mjs <work-dir> <out.mp4> [--stills DIR]
//
// Writes <work-dir>/timeline.json (scene cuts, used by music.mjs) and <work-dir>/poster.jpg.
// Frame 0 of the video is the poster, so every player shows it as the thumbnail. With
// --stills, it only saves review stills (each scene's middle and every transition) and exits.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const [workArg, outArg] = process.argv.slice(2);
const work = path.resolve(workArg ?? 'brag-output/work');
const out = path.resolve(outArg ?? path.join(work, 'video.mp4'));
const stillsIndex = process.argv.indexOf('--stills');
const stillsDir = stillsIndex > 0 ? path.resolve(process.argv[stillsIndex + 1]) : null;

const mounts = {
  '/compose/': path.join(root, 'video', 'compose'),
  '/work/': work,
  '/fonts/inter/': path.join(root, 'node_modules', '@fontsource', 'inter'),
  '/fonts/mono/': path.join(root, 'node_modules', '@fontsource', 'jetbrains-mono'),
};
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const prefix = Object.keys(mounts).find((p) => url.startsWith(p));
  const file = prefix && path.resolve(mounts[prefix], `.${url.slice(prefix.length - 1)}`);
  if (!file || !file.startsWith(mounts[prefix]) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', (err) => console.error(`composition error: ${err.message}`));
await page.goto(`http://127.0.0.1:${server.address().port}/compose/index.html`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60_000 });
const timeline = await page.evaluate(() => window.__timeline);
fs.writeFileSync(path.join(work, 'timeline.json'), `${JSON.stringify(timeline, null, 2)}\n`);

const shot = async (t, options = {}) => {
  await page.evaluate((time) => window.__frame(time), t);
  return page.screenshot({ type: 'jpeg', quality: 95, ...options });
};

if (stillsDir) {
  fs.mkdirSync(stillsDir, { recursive: true });
  for (const s of timeline.scenes) {
    await shot(s.start + s.dur / 2, { path: path.join(stillsDir, `${s.id}-mid.jpg`) });
    await shot(s.start + s.dur - 0.05, { path: path.join(stillsDir, `${s.id}-out.jpg`) });
    await shot(s.start + Math.min(0.2, s.dur / 2), { path: path.join(stillsDir, `${s.id}-in.jpg`) });
  }
  console.log(`stills in ${stillsDir}`);
} else {
  const poster = await shot(timeline.poster, { path: path.join(work, 'poster.jpg') });
  const total = Math.round(timeline.duration * timeline.fps);
  const ffmpeg = spawn('ffmpeg', [
    '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(timeline.fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const write = (buf) => (ffmpeg.stdin.write(buf) ? Promise.resolve() : new Promise((resolve) => ffmpeg.stdin.once('drain', resolve)));
  const started = Date.now();
  for (let i = 0; i < total; i += 1) {
    // Frame 0 is the poster (replacing, not adding, a frame keeps duration and audio sync).
    await write(i === 0 ? poster : await shot(i / timeline.fps));
    if (i % 150 === 0) console.log(`frame ${i}/${total} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
  }
  ffmpeg.stdin.end();
  const code = await new Promise((resolve) => ffmpeg.on('close', resolve));
  if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);
  console.log(`rendered ${total} frames (${timeline.duration.toFixed(1)}s) to ${out}`);
}

await browser.close();
server.close();
