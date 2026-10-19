// Records real product footage for the video. Drives a running CodeCloud server with Playwright
// and captures every repaint through the Chrome DevTools screencast as timestamped JPEG frames
// (crisper than Playwright's WebM recorder). Writes clips/<flow>/NNNNN.jpg, clips.json (frame
// timestamps), and markers.json (when each moment happened), so the composition can cut precisely.
//
//   BASE_URL=http://localhost:8080 node video/capture.mjs <out-dir>
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const OUT = path.resolve(process.argv[2] ?? 'brag-output/work');
const SIZE = { width: 1600, height: 900 };
const SCALE = 1.5; // device pixel ratio: frames are 2400×1350 so the video can zoom in on the terminal
const CLIPS = path.join(OUT, 'clips');
fs.mkdirSync(CLIPS, { recursive: true });

const browser = await chromium.launch();
const markers = {};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const clips = {};

/** Runs `fn` in a fresh browser context, screencasting it, and stores its markers under `name`. */
async function record(name, fn, { signedIn = true } = {}) {
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: SCALE, colorScheme: 'light' });
  const page = await context.newPage();
  page.on('dialog', (dialog) => dialog.accept());
  if (signedIn) await signIn(page);

  const dir = path.join(CLIPS, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const frames = (clips[name] = []);
  const cdp = await context.newCDPSession(page);
  const t0 = Date.now() / 1000;
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    const file = `${name}/${String(frames.length).padStart(5, '0')}.jpg`;
    fs.writeFileSync(path.join(CLIPS, file), Buffer.from(data, 'base64'));
    frames.push({ t: Math.max(0, metadata.timestamp - t0), file });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 90,
    maxWidth: SIZE.width * SCALE,
    maxHeight: SIZE.height * SCALE,
  });

  const clip = (markers[name] = {});
  const mark = (label) => {
    clip[label] = Date.now() / 1000 - t0;
  };
  try {
    await fn(page, mark);
    mark('end');
  } finally {
    await cdp.send('Page.stopScreencast').catch(() => {});
    await context.close();
    console.log(`recorded ${name}: ${frames.length} frames, ${JSON.stringify(clip)}`);
  }
}

async function signIn(page) {
  const credentials = { username: 'learner', password: 'learner-password' };
  const register = await page.request.post(`${BASE}/api/auth/register`, { data: credentials });
  if (!register.ok()) {
    const login = await page.request.post(`${BASE}/api/auth/login`, { data: credentials });
    if (!login.ok()) throw new Error(`cannot sign in: ${await login.text()}`);
  }
  // Start every recording from a clean slate: end labs left over from an earlier run.
  const { sessions } = await (await page.request.get(`${BASE}/api/lab-sessions`)).json();
  for (const session of sessions) await page.request.delete(`${BASE}/api/lab-sessions/${session.id}`);
}

async function smoothScroll(page, dy, ms = 1500) {
  const steps = Math.max(1, Math.round(ms / 40));
  for (let i = 0; i < steps; i += 1) {
    await page.mouse.wheel(0, dy / steps);
    await pause(40);
  }
}

const terminalText = (page) => page.locator('.xterm-rows').innerText();

/** Types a command like a person would and waits until `expect` shows up in the terminal. */
async function run(page, command, expect, timeout = 60_000) {
  await page.locator('div.terminal').first().click();
  await page.keyboard.type(command, { delay: 38 });
  await page.keyboard.press('Enter');
  if (expect) {
    const started = Date.now();
    while (!(expect instanceof RegExp ? expect : new RegExp(expect)).test(await terminalText(page))) {
      if (Date.now() - started > timeout) throw new Error(`timed out waiting for ${expect} after: ${command}`);
      await pause(200);
    }
  }
  await pause(500);
}

async function openLab(page, mark, labId) {
  await page.goto(`${BASE}/#/labs/${labId}`);
  await page.getByText('Preparing your lab environment').waitFor();
  mark('provisioning');
  await page.locator('.xterm').waitFor({ timeout: 300_000 });
  mark('ready');
  await page.waitForFunction(() => /[#$]\s*$/m.test(document.querySelector('.xterm-rows')?.innerText ?? ''), null, { timeout: 30_000 });
  await pause(600);
}

async function check(page, index) {
  const task = page.locator('.task').nth(index);
  await task.scrollIntoViewIfNeeded();
  await task.getByRole('button', { name: 'Check' }).click();
  await task.locator('.result.ok').waitFor({ timeout: 120_000 });
}

async function endLab(page) {
  await page.getByRole('button', { name: 'End lab' }).click();
  await page.waitForURL(/#\/(labs|playgrounds)$/);
}

// 1. Catalog: learning paths, topic filter and search.
await record('catalog', async (page, mark) => {
  await page.goto(`${BASE}/`);
  await page.locator('.card').first().waitFor();
  await pause(1200);
  mark('loaded');
  await smoothScroll(page, 760, 1800);
  mark('scrolled');
  await pause(700);
  await page.getByRole('button', { name: 'Kubernetes', exact: true }).click();
  mark('filtered');
  await pause(1200);
  await page.locator('input[type=search]').click();
  await page.keyboard.type('helm', { delay: 120 });
  mark('searched');
  await pause(1800);
});

// 2. Learning path → course → lesson.
await record('learn', async (page, mark) => {
  await page.goto(`${BASE}/#/paths/kubernetes-administrator`);
  await page.locator('.lessons li').first().waitFor();
  await pause(1000);
  mark('path');
  await page.getByRole('link', { name: 'Kubernetes Fundamentals' }).click();
  await page.locator('.lessons li').first().waitFor();
  await pause(1100);
  mark('course');
  await page.getByRole('link', { name: 'Workloads and services' }).click();
  await page.locator('article.lesson').waitFor();
  await pause(900);
  mark('lesson');
  await smoothScroll(page, 520, 1600);
  await pause(800);
  mark('lesson-end');
});

// 3. A Linux lab end to end: provision, terminal, checks, quiz, hint, solution, extend, end.
await record('lab-linux', async (page, mark) => {
  await openLab(page, mark, 'linux-files');
  await run(page, 'mkdir -p /root/projects/website', null);
  mark('typed-mkdir');
  await run(page, 'echo "Hello CodeCloud" > /root/projects/website/index.html', null);
  await run(page, 'ls -l /root/projects/website && cat /root/projects/website/index.html', 'Hello CodeCloud\\s*\\n.*#');
  mark('typed');
  await check(page, 2);
  mark('checked-1');
  await check(page, 3);
  mark('checked-2');
  const quiz = page.locator('.task').nth(0);
  await quiz.scrollIntoViewIfNeeded();
  await quiz.locator('input[value="1"]').check();
  await quiz.getByRole('button', { name: 'Submit' }).click();
  await quiz.locator('.result.ok').waitFor();
  mark('quiz');
  await pause(900);
  const perms = page.locator('.task').nth(5);
  await perms.scrollIntoViewIfNeeded();
  await perms.getByRole('button', { name: 'Hint' }).click();
  await pause(900);
  mark('hint');
  await perms.getByRole('button', { name: 'Solution' }).click();
  await perms.locator('pre').waitFor();
  await pause(1200);
  mark('solution');
  await page.getByRole('button', { name: 'Extend' }).click();
  await pause(1000);
  mark('extended');
  await endLab(page);
  mark('ended');
  await pause(800);
});

// 4. Docker lab: a private Docker engine.
await record('lab-docker', async (page, mark) => {
  await openLab(page, mark, 'docker-basics');
  await run(page, 'docker run -d --name web -p 8080:80 nginx:alpine', /[0-9a-f]{64}/, 180_000);
  mark('ran');
  await run(page, 'docker ps --format "table {{.Names}}\\t{{.Image}}\\t{{.Ports}}"', /web\s+nginx:alpine/);
  mark('ps');
  await check(page, 2);
  await check(page, 1);
  mark('checked');
  await pause(1200);
  await endLab(page);
});

// 5. Kubernetes lab: a real k3s cluster.
await record('lab-k8s', async (page, mark) => {
  await openLab(page, mark, 'kubernetes-pods');
  await run(page, 'clear', null);
  mark('nodes-start');
  await run(page, 'kubectl get nodes', /Ready\s+control-plane/);
  mark('nodes');
  await pause(800);
  await run(page, 'kubectl create deployment frontend --image=nginx:alpine --replicas=3', /created/);
  mark('created');
  await run(page, 'kubectl get deployments', /frontend/);
  await check(page, 2);
  mark('checked');
  await pause(1500);
  await endLab(page);
});

// 6. Playgrounds, the labs grid, and the catalog filtered to edX.
await record('explore', async (page, mark) => {
  await page.goto(`${BASE}/#/playgrounds`);
  await page.locator('.card').first().waitFor();
  await pause(1500);
  mark('playgrounds');
  await page.goto(`${BASE}/#/labs`);
  await page.locator('.card').first().waitFor();
  await pause(800);
  mark('labs');
  await smoothScroll(page, 900, 2200);
  mark('labs-end');
  await page.goto(`${BASE}/`);
  await page.locator('.card').first().waitFor();
  await page.getByRole('button', { name: 'edX', exact: true }).click();
  await page.locator('input[type=search]').scrollIntoViewIfNeeded();
  await pause(600);
  mark('edx');
  await smoothScroll(page, 500, 1500);
  await pause(1500);
  mark('edx-end');
}, { signedIn: false });

fs.writeFileSync(path.join(OUT, 'markers.json'), `${JSON.stringify(markers, null, 2)}\n`);
fs.writeFileSync(path.join(OUT, 'clips.json'), JSON.stringify(clips));
await browser.close();
