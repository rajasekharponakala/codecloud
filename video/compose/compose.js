// The CodeCloud launch video as a pure function of time: window.__frame(t) draws frame t and
// resolves once every image on it has decoded. render.mjs screenshots it at 30 fps.
// Footage scenes replay real recordings (clips.json + markers.json from capture.mjs); graphic
// scenes draw only facts from data.json (collect-data.mjs).

const [data, markers, clips] = await Promise.all(
  ['data.json', 'markers.json', 'clips.json'].map((f) => fetch(`/work/${f}`).then((r) => r.json())),
);
const stage = document.getElementById('stage');
const FADE = 0.3;

// ---------- helpers ----------

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, x) => a + (b - a) * x;
const easeOut = (x) => 1 - (1 - clamp(x)) ** 3;
const easeInOut = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
/** 0 → 1 over [start, start + dur], eased. */
const enter = (t, start, dur = 0.45) => easeOut((t - start) / dur);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'style') Object.assign(node.style, v);
    else node.setAttribute(k, v);
  }
  node.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

/** Appear: fade + rise. Text that must be read settles within ~0.45 s and then holds. */
function appear(node, t, start, { dy = 24, dur = 0.45 } = {}) {
  const p = enter(t, start, dur);
  node.style.opacity = p;
  node.style.transform = `${node.dataset.baseTransform ?? ''} translateY(${(1 - p) * dy}px)`;
}

const marker = (clip, name) => {
  const value = markers[clip]?.[name];
  if (value === undefined) throw new Error(`missing marker ${clip}.${name}`);
  return value;
};

/** Index of the last frame captured at or before clip time `t`. */
function frameAt(clip, t) {
  const frames = clips[clip];
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return frames[lo].file;
}

function humanCron(cron) {
  const [m, h, , , dow] = cron.split(' ');
  const time = `${h.padStart(2, '0')}:${m.padStart(2, '0')} UTC`;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return dow === '*' ? `nightly ${time}` : `weekly · ${days[Number(dow)]} ${time}`;
}

// ---------- scene types ----------

const scenes = [];
let cursor = 0;
function addScene(id, dur, root, update) {
  root.classList.add('scene');
  stage.append(root);
  scenes.push({ id, start: cursor, dur, root, update });
  cursor += dur;
}

/**
 * A footage scene: one or more segments of a recording, each with a playback speed and a camera
 * move (zoom z around focus point x, y — fractions of the frame).
 */
function footage(id, { segments, caption, bleed = false, extraHold = 0 }) {
  const img = el('img');
  const viewport = el('div', { class: 'viewport' }, img);
  const url = el('div', { class: 'url' });
  const speed = el('div', { class: 'speed' });
  const win = bleed
    ? el('div', { class: 'bleed' }, viewport)
    : el(
        'div',
        { class: 'window' },
        el('div', { class: 'bar' },
          el('div', { class: 'dot', style: { background: '#ff5f57' } }),
          el('div', { class: 'dot', style: { background: '#febc2e' } }),
          el('div', { class: 'dot', style: { background: '#28c840' } }),
          url),
        viewport,
        speed,
      );
  const cap = caption
    ? el('div', { class: `caption ${caption.dark ? 'dark' : ''}` }, el('h2', {}, caption.title), caption.sub && el('p', {}, caption.sub))
    : null;
  const root = el('div', {}, win, cap);

  const resolved = segments.map((s) => {
    const from = marker(s.clip, s.from[0]) + s.from[1];
    const to = marker(s.clip, s.to[0]) + s.to[1];
    const rate = s.fit ? (to - from) / s.fit : s.speed ?? 1;
    return { ...s, from, to, rate, dur: (to - from) / rate };
  });
  const total = resolved.reduce((n, s) => n + s.dur, 0) + extraHold;
  const [vw, vh] = bleed ? [1920, 1080] : [1600, 900];

  addScene(id, total, root, (t) => {
    let start = 0;
    let seg = resolved[resolved.length - 1];
    for (const s of resolved) {
      if (t < start + s.dur) {
        seg = s;
        break;
      }
      start += s.dur;
    }
    const local = clamp(t - start, 0, seg.dur);
    img.src = `/work/clips/${frameAt(seg.clip, seg.from + local * seg.rate)}`;
    const p = easeInOut(clamp(local / seg.dur));
    const cam0 = seg.cam ?? { z: 1, x: 0.5, y: 0.5 };
    const cam1 = seg.cam1 ?? cam0;
    const z = lerp(cam0.z, cam1.z, p);
    const fx = lerp(cam0.x, cam1.x, p);
    const fy = lerp(cam0.y, cam1.y, p);
    const tx = clamp(vw / 2 - fx * vw * z, vw - vw * z, 0);
    const ty = clamp(vh / 2 - fy * vh * z, vh - vh * z, 0);
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`;
    url.textContent = seg.url ?? '';
    speed.style.display = seg.rate > 1.05 ? 'flex' : 'none';
    speed.textContent = `▶▶ ${Math.round(seg.rate * 10) / 10}× ${seg.speedLabel ?? 'speed'}`;
    if (cap) {
      cap.dataset.baseTransform = caption.dark ? '' : 'translateX(-50%)';
      appear(cap, t, caption.at ?? 0.35);
    }
  });
}

const K8S_TERMINAL = { z: 2.15, x: 0.47, y: 0.2 };
const LINUX_TERMINAL = { z: 1.75, x: 0.52, y: 0.2 };
const TASKS = { z: 1.3, x: 0.36, y: 0.43 };

// 1. Hook — a real cluster answering, full bleed.
footage('hook', {
  bleed: true,
  segments: [{ clip: 'lab-k8s', from: ['nodes-start', -0.2], to: ['nodes', 2.3], cam: { z: 2.05, x: 0.48, y: 0.31 }, cam1: { z: 2.25, x: 0.48, y: 0.31 } }],
  caption: { title: 'A real Kubernetes cluster.', sub: 'In your browser. In seconds.', dark: true, at: 0.9 },
});

// 2. Reveal — wordmark and the real catalog numbers.
{
  const c = data.counts;
  const stats = [
    [c.courses, 'courses'],
    [c.labs, 'graded labs'],
    [c.playgrounds, 'playgrounds'],
    [c.paths, 'learning paths'],
  ].map(([n, label]) => ({ n, node: el('div', { class: 'stat' }, el('b', {}, '0'), el('span', {}, label)) }));
  const word = el('div', { class: 'wordmark' }, 'Code', el('span', {}, 'Cloud'));
  const tag = el('div', { class: 'tagline' }, 'Open-source, hands-on DevOps labs.');
  const root = el('div', {}, el('div', { class: 'center' }, word, tag, el('div', { class: 'stats' }, stats.map((s) => s.node))));
  addScene('reveal', 4.6, root, (t) => {
    appear(word, t, 0.05, { dy: 40, dur: 0.6 });
    word.style.transform += ` scale(${lerp(0.92, 1, enter(t, 0.05, 0.8))})`;
    appear(tag, t, 0.45);
    stats.forEach((s, i) => {
      appear(s.node, t, 0.9 + i * 0.14);
      s.node.querySelector('b').textContent = String(Math.round(s.n * enter(t, 1.0 + i * 0.14, 0.9)));
    });
  });
}

// 3. Catalog.
footage('catalog', {
  segments: [{ clip: 'catalog', from: ['loaded', -0.4], to: ['searched', 1.6], url: 'localhost:8080/#/', cam: { z: 1, x: 0.5, y: 0.5 }, cam1: { z: 1.12, x: 0.45, y: 0.45 } }],
  caption: { title: `${data.counts.courses} courses across ${data.counts.categories} topics`, sub: 'Learning paths, topic filters and search' },
});

// 4. Paths and lessons.
footage('learn', {
  segments: [{ clip: 'learn', from: ['path', -0.5], to: ['lesson-end', 0.1], url: 'localhost:8080/#/paths/kubernetes-administrator', cam: { z: 1.08, x: 0.4, y: 0.35 }, cam1: { z: 1.0, x: 0.5, y: 0.5 } }],
  caption: { title: 'Learning paths → courses → lessons', sub: 'Short lessons, each paired with a hands-on lab' },
});

// 5. One click → a private machine (real boot time).
footage('start', {
  segments: [{ clip: 'lab-linux', from: ['provisioning', -0.3], to: ['ready', 1.2], url: 'localhost:8080/#/labs/linux-files' }],
  caption: { title: 'One click. Your own machine.', sub: 'A fresh, disposable container for every learner', at: 0.2 },
  extraHold: 0.6,
});

// 6. Do the work in a real root shell.
footage('work', {
  segments: [{ clip: 'lab-linux', from: ['ready', 0.6], to: ['typed', 0.5], speed: 1.6, url: 'localhost:8080/#/labs/linux-files', cam: LINUX_TERMINAL, cam1: { ...LINUX_TERMINAL, z: 1.9 } }],
  caption: { title: 'A real root shell in the browser', sub: 'xterm.js over a WebSocket into the lab container' },
});

// 7. Auto-grading: checks, quiz, hint, solution.
footage('grading', {
  segments: [
    { clip: 'lab-linux', from: ['typed', 0.0], to: ['quiz', 1.0], speed: 0.6, url: 'localhost:8080/#/labs/linux-files', cam: { z: 1.25, x: 0.3, y: 0.3 }, cam1: TASKS },
    { clip: 'lab-linux', from: ['quiz', 1.0], to: ['solution', 0.9], speed: 1.2, url: 'localhost:8080/#/labs/linux-files', cam: TASKS, cam1: { ...TASKS, z: 1.38 } },
  ],
  caption: { title: 'Check grades the real machine', sub: 'Shell checks run inside the lab · quizzes · hints · solutions' },
});

// 8. Docker-in-Docker.
footage('docker', {
  segments: [
    { clip: 'lab-docker', from: ['provisioning', 0], to: ['ready', 0.4], fit: 2.2, speedLabel: 'booting a private Docker engine', url: 'localhost:8080/#/labs/docker-basics' },
    { clip: 'lab-docker', from: ['ready', 0.4], to: ['checked', 1.0], speed: 2.2, url: 'localhost:8080/#/labs/docker-basics', cam: { z: 1.6, x: 0.5, y: 0.22 }, cam1: { z: 1.3, x: 0.35, y: 0.3 } },
  ],
  caption: { title: 'Real Docker', sub: 'A private Docker engine per learner (Docker-in-Docker)', at: 2.4 },
});

// 9. Kubernetes.
footage('kubernetes', {
  segments: [{ clip: 'lab-k8s', from: ['nodes', 0.6], to: ['checked', 1.4], speed: 1.5, url: 'localhost:8080/#/labs/kubernetes-pods', cam: K8S_TERMINAL, cam1: { z: 1.3, x: 0.3, y: 0.4 } }],
  caption: { title: 'Real Kubernetes', sub: 'A single-node k3s cluster per learner, graded with kubectl' },
});

// 10. Playgrounds and labs.
footage('explore', {
  segments: [{ clip: 'explore', from: ['playgrounds', -0.8], to: ['labs-end', 0.2], url: 'localhost:8080/#/playgrounds' }],
  caption: { title: `${data.counts.playgrounds} playgrounds · ${data.counts.labs} graded labs`, sub: `Ubuntu, Docker and Kubernetes sandboxes · ${data.counts.tasks} tasks` },
});

// 11. Breadth — every real course title.
{
  const head = el('div', { class: 'heading' }, el('h2', {}, 'From Linux to Kubernetes to the cloud'), el('p', {}, `Every course ships with lessons and a hands-on lab — ${data.counts.courses} courses, ${data.counts.categories} topics`));
  const cards = data.courses.map((c) => el('div', { class: 'course' }, el('b', {}, c.title), el('br'), el('span', {}, c.category)));
  const root = el('div', {}, head, el('div', { class: 'grid' }, cards));
  addScene('breadth', 5, root, (t) => {
    appear(head, t, 0.05);
    cards.forEach((card, i) => appear(card, t, 0.35 + i * 0.07, { dy: 18, dur: 0.35 }));
  });
}

// 12. edX in, Open edX out.
{
  if (data.edx.count > 0) {
    footage('edx-catalog', {
      segments: [{ clip: 'explore', from: ['edx', -0.2], to: ['edx-end', 0], url: 'localhost:8080/#/' }],
      caption: { title: `${data.edx.count} edX courses in the catalog`, sub: 'Synced weekly from the Open edX Course API' },
    });
  }
  const left =
    data.edx.count > 0
      ? el('div', { class: 'panel' }, el('h3', {}, 'edX courses, synced weekly'), el('div', { class: 'sub' }, 'Listed beside CodeCloud courses, with labs to practise'),
          data.edx.courses.slice(0, 5).map((c) => el('div', { class: 'edx-card' }, el('b', {}, c.title), el('span', {}, el('span', { class: 'badge' }, 'edX'), `${c.org} · ${c.category}`))))
      : el('div', { class: 'panel' }, el('h3', {}, 'edX courses in the catalog'), el('div', { class: 'sub' }, 'A weekly GitHub workflow syncs the Open edX Course API'),
          el('div', { class: 'term mono' }, el('span', { class: 'prompt' }, '$ '), 'node scripts/sync-edx.js\n',
            el('span', { class: 'ok' }, `GET ${data.edx.sources[0]}\n    /api/courses/v1/courses/\n`), '→ categorized, linked to labs\n→ pull request: content/external/edx.json'));
  const files = data.olx.files.slice(0, 13);
  const treeLines = files.map((f) => el('div', {}, el('span', { class: 'dim' }, f.split('/').slice(0, -1).join('/') + '/'), f.split('/').pop()));
  const right = el('div', { class: 'panel' }, el('h3', {}, 'Export any course to Open edX'), el('div', { class: 'sub' }, `${data.olx.course}.tar.gz — lessons, labs, graded problems`), el('div', { class: 'tree mono' }, treeLines));
  const head = el('div', { class: 'heading' }, el('h2', {}, 'Works with edX, both ways'), el('p', {}, 'Bring edX courses in · take CodeCloud courses to any Open edX site'));
  const root = el('div', {}, head, el('div', { class: 'panels' }, left, right));
  addScene('edx', 5.6, root, (t) => {
    appear(head, t, 0.05);
    appear(left, t, 0.35);
    appear(right, t, 0.7);
    treeLines.forEach((line, i) => appear(line, t, 1.0 + i * 0.12, { dy: 8, dur: 0.25 }));
  });
}

// 13. Automation — the real workflows and a real nightly lab run.
{
  const icons = { 'ci.yml': '✓', 'labs.yml': '▶', 'lab-images.yml': '⬢', 'edx-sync.yml': '⇄', 'olx-export.yml': '⇪' };
  const order = ['labs.yml', 'lab-images.yml', 'edx-sync.yml', 'olx-export.yml', 'ci.yml'];
  const wfs = order.map((f) => data.workflows.find((w) => w.file === f)).filter(Boolean);
  const cards = wfs.map((w) =>
    el('div', { class: 'wf' },
      el('div', { class: 'icon' }, icons[w.file] ?? '•'),
      el('div', {}, el('b', {}, w.name), el('span', { class: 'mono' }, `.github/workflows/${w.file}`)),
      el('div', { class: 'when' }, w.crons.length ? humanCron(w.crons[0]) : w.triggers.includes('release') ? 'on push & release' : 'every push & PR')));
  const lines = ['$ node src/cli.js test-lab linux-processes --solve', ...data.labRun];
  const termLines = lines.map((line) =>
    el('div', {}, line.startsWith('$') ? [el('span', { class: 'prompt' }, '$ '), line.slice(2)] : line.startsWith('✓') || line.endsWith(': ok') ? el('span', { class: 'ok' }, line) : line));
  const term = el('div', { class: 'term mono side-term' }, termLines);
  const head = el('div', { class: 'heading' }, el('h2', {}, 'GitHub Actions keeps every lab working'), el('p', {}, 'Nightly, CI boots each lab and runs its reference solutions; images, edX and exports refresh on schedule'));
  const root = el('div', {}, head, el('div', { class: 'flow' }, cards), term);
  addScene('automation', 6.6, root, (t) => {
    appear(head, t, 0.05);
    cards.forEach((card, i) => appear(card, t, 0.4 + i * 0.22, { dy: 16 }));
    appear(term, t, 0.6);
    termLines.forEach((line, i) => {
      line.style.opacity = t > 1.0 + i * 0.45 ? 1 : 0;
    });
  });
}

// 14. Outro — self-host it.
{
  const word = el('div', { class: 'wordmark', style: { fontSize: '120px' } }, 'Code', el('span', {}, 'Cloud'));
  const typed = el('span');
  const cmd = el('div', { class: 'outro-cmd mono' }, el('span', { class: 'prompt' }, '$ '), typed, el('span', { class: 'cursor' }));
  const repo = el('div', { class: 'repo' }, data.repo);
  const fine = el('div', { class: 'fineprint' }, 'Open source · AGPL-3.0 · Docker · k3s · xterm.js · Fastify');
  const root = el('div', {}, el('div', { class: 'center' }, word, cmd, repo, fine));
  const text = 'docker compose up -d';
  addScene('outro', 5.2, root, (t) => {
    appear(word, t, 0.05);
    appear(cmd, t, 0.35);
    typed.textContent = text.slice(0, Math.floor(clamp((t - 0.6) / 1.0) * text.length));
    appear(repo, t, 1.8);
    appear(fine, t, 2.2);
  });
}

// ---------- timeline ----------

const duration = cursor;
const grading = scenes.find((s) => s.id === 'grading');

window.__timeline = {
  duration,
  fps: 30,
  poster: grading.start + grading.dur - 0.4,
  scenes: scenes.map(({ id, start, dur }) => ({ id, start, dur })),
};

/** Draws frame `t` (seconds) and waits until its images are decoded. */
window.__frame = async (t) => {
  for (const s of scenes) {
    const active = t >= s.start && t < s.start + s.dur;
    s.root.style.display = active ? 'block' : 'none';
    if (!active) continue;
    const local = t - s.start;
    s.update(local);
    const fadeIn = s === scenes[0] ? 1 : clamp(local / FADE);
    const fadeOut = clamp((s.start + s.dur - t) / (s === scenes[scenes.length - 1] ? 0.8 : FADE));
    s.root.style.opacity = Math.min(fadeIn, fadeOut);
  }
  await Promise.all([...stage.querySelectorAll('img')].filter((img) => img.offsetParent && img.src).map((img) => img.decode().catch(() => {})));
};

await document.fonts.ready;
await Promise.all([...document.fonts].map((f) => f.load()));
window.__ready = true;
