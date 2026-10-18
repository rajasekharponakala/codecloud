/* global Terminal, FitAddon */
const view = document.getElementById('view');
const account = document.getElementById('account');
let me = null;
let teardown = () => {};

/** Minimal element builder: h('div', {class: 'x', onclick}, child, 'text'). Strings become text nodes. */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key === 'html') el.innerHTML = value; // only ever server-sanitized markdown
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `${res.status} ${res.statusText}`);
  return data;
}

function render(...nodes) {
  view.classList.remove('wide');
  view.replaceChildren(...nodes);
}

function renderAccount() {
  account.replaceChildren(
    ...(me
      ? [h('span', {}, me.username), h('button', { onclick: logout }, 'Sign out')]
      : [h('a', { href: '#/login' }, 'Sign in')]),
  );
}

async function logout() {
  await api('/auth/logout', { method: 'POST' });
  me = null;
  renderAccount();
  location.hash = '#/';
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------- pages ----------

async function loginPage() {
  const error = h('p', { class: 'error' });
  const username = h('input', { placeholder: 'Username', autocomplete: 'username' });
  const password = h('input', { placeholder: 'Password', type: 'password', autocomplete: 'current-password' });
  const submit = (path) => async (event) => {
    event.preventDefault();
    try {
      const { user } = await api(path, { method: 'POST', body: { username: username.value, password: password.value } });
      me = user;
      renderAccount();
      location.hash = sessionStorage.getItem('after-login') ?? '#/';
      sessionStorage.removeItem('after-login');
    } catch (err) {
      error.textContent = err.message;
    }
  };
  render(
    h(
      'form',
      { class: 'auth', onsubmit: submit('/auth/login') },
      h('h1', {}, 'Sign in'),
      username,
      password,
      h('button', { class: 'primary', type: 'submit' }, 'Sign in'),
      h('button', { type: 'button', onclick: submit('/auth/register') }, 'Create account'),
      error,
    ),
  );
}

async function coursesPage() {
  const [{ courses }, progress] = await Promise.all([api('/courses'), me ? api('/progress') : { lessons: {} }]);
  render(
    h('h1', {}, 'Courses'),
    h('p', { class: 'muted' }, 'Learn by doing: every course pairs short lessons with hands-on, auto-graded labs.'),
    h(
      'div',
      { class: 'grid' },
      courses.map((c) =>
        h(
          'div',
          { class: 'card' },
          h('h3', {}, c.title),
          h('span', { class: 'pill' }, c.level),
          h('p', { class: 'muted' }, c.description),
          h(
            'div',
            { class: 'actions' },
            h('a', { href: `#/courses/${c.id}` }, 'Open course'),
            h('span', { class: 'muted' }, `${progress.lessons[c.id]?.length ?? 0}/${c.lesson_count} lessons`),
          ),
        ),
      ),
    ),
  );
}

async function coursePage(courseId) {
  const [{ course }, progress] = await Promise.all([api(`/courses/${courseId}`), me ? api('/progress') : { lessons: {} }]);
  const done = new Set(progress.lessons[courseId] ?? []);
  render(
    h('a', { href: '#/' }, '← Courses'),
    h('h1', {}, course.title),
    h('p', { class: 'muted' }, course.description),
    h(
      'ol',
      { class: 'lessons' },
      course.lessons.map((l) =>
        h(
          'li',
          {},
          h('span', {}, done.has(l.id) ? '✅' : '⬜'),
          h('a', { href: `#/courses/${courseId}/${l.id}` }, l.title),
          l.lab && h('span', { class: 'pill' }, 'lab'),
        ),
      ),
    ),
  );
}

async function lessonPage(courseId, lessonId) {
  const [{ course }, { lesson }] = await Promise.all([api(`/courses/${courseId}`), api(`/courses/${courseId}/lessons/${lessonId}`)]);
  const index = course.lessons.findIndex((l) => l.id === lessonId);
  const next = course.lessons[index + 1];
  const markDone = async () => {
    if (me) await api(`/courses/${courseId}/lessons/${lessonId}/complete`, { method: 'POST' });
    location.hash = next ? `#/courses/${courseId}/${next.id}` : `#/courses/${courseId}`;
  };
  render(
    h('a', { href: `#/courses/${courseId}` }, `← ${course.title}`),
    h('article', { class: 'lesson', html: lesson.html }),
    h(
      'p',
      { class: 'actions' },
      lesson.lab && h('button', { class: 'primary', onclick: () => (location.hash = `#/labs/${lesson.lab}`) }, 'Start the lab'),
      ' ',
      h('button', { onclick: markDone }, next ? 'Mark complete & continue' : 'Mark complete'),
    ),
  );
}

async function labsPage(kind) {
  const [{ labs }, progress] = await Promise.all([api('/labs'), me ? api('/progress') : { labs: {} }]);
  const items = labs.filter((l) => l.kind === kind);
  render(
    h('h1', {}, kind === 'lab' ? 'Hands-on labs' : 'Playgrounds'),
    h(
      'p',
      { class: 'muted' },
      kind === 'lab'
        ? 'Each lab boots a fresh environment just for you and checks your work as you go.'
        : 'Free-form sandboxes with the tools pre-installed. No tasks, no grading.',
    ),
    h(
      'div',
      { class: 'grid' },
      items.map((lab) => {
        const done = progress.labs[lab.id]?.length ?? 0;
        return h(
          'div',
          { class: 'card' },
          h('h3', {}, lab.title),
          h('div', {}, h('span', { class: 'pill' }, lab.difficulty), ' ', h('span', { class: 'pill' }, `${lab.duration_minutes} min`)),
          h('div', { class: 'muted', html: lab.description_html }),
          h(
            'div',
            { class: 'actions' },
            h('a', { href: `#/labs/${lab.id}` }, kind === 'lab' ? 'Start lab' : 'Launch'),
            kind === 'lab' && h('span', { class: 'muted' }, `${done}/${lab.tasks.length} tasks`),
          ),
        );
      }),
    ),
  );
}

async function labPage(labId) {
  if (!me) {
    sessionStorage.setItem('after-login', location.hash);
    location.hash = '#/login';
    return;
  }
  let { session } = await api(`/labs/${labId}/sessions`, { method: 'POST' });
  const status = h('div', { class: 'status' }, 'Preparing your lab environment…');
  render(status);
  let cancelled = false;
  teardown = () => {
    cancelled = true;
  };
  while (session.status === 'provisioning' && !cancelled) {
    await new Promise((r) => setTimeout(r, 1500));
    ({ session } = await api(`/lab-sessions/${session.id}`));
    status.textContent = `Preparing your lab environment… (${Math.round((Date.now() - session.created_at) / 1000)}s)`;
  }
  if (cancelled) return;
  if (session.status !== 'running') {
    status.replaceChildren(
      h('p', { class: 'error' }, `The lab could not start: ${session.error ?? session.status}`),
      h('button', { onclick: () => labPage(labId) }, 'Try again'),
    );
    return;
  }
  runningLab(session);
}

function runningLab(session) {
  const lab = session.lab;
  const timer = h('span', { class: 'timer' });
  const termEl = h('div', { class: 'terminal' });
  let secondsLeft = session.seconds_left;

  const extendBtn = h('button', { onclick: async () => {
    try {
      ({ session } = await api(`/lab-sessions/${session.id}/extend`, { method: 'POST' }));
      secondsLeft = session.seconds_left;
      extendBtn.disabled = session.extensions_left === 0;
    } catch (err) {
      alert(err.message);
    }
  } }, 'Extend');
  extendBtn.disabled = session.extensions_left === 0;

  const stopBtn = h('button', { onclick: async () => {
    if (!confirm('End this lab? The environment will be deleted.')) return;
    await api(`/lab-sessions/${session.id}`, { method: 'DELETE' });
    location.hash = lab.kind === 'lab' ? '#/labs' : '#/playgrounds';
  } }, 'End lab');

  const passedCount = () => Object.values(session.results).filter((r) => r.passed).length;
  const score = h('span', { class: 'muted' });
  const updateScore = () => {
    score.textContent = lab.tasks.length ? `${passedCount()}/${lab.tasks.length} complete` : '';
  };
  updateScore();

  const taskCards = lab.tasks.map((task, i) => {
    const result = h('div', { class: 'result' });
    const card = h('section', { class: `task ${session.results[task.id]?.passed ? 'passed' : ''}` });
    const setResult = (passed, text) => {
      result.className = `result ${passed ? 'ok' : 'bad'}`;
      result.textContent = text;
      if (passed) card.classList.add('passed');
      session.results[task.id] = { passed: passed || session.results[task.id]?.passed };
      updateScore();
    };
    let controls;
    if (task.type === 'quiz') {
      const name = `q-${task.id}`;
      controls = h(
        'div',
        { class: 'options' },
        task.options.map((option, idx) => h('label', {}, h('input', { type: 'radio', name, value: idx, style: 'width:auto' }), ' ', option)),
        h('button', { class: 'primary', onclick: async () => {
          const chosen = card.querySelector(`input[name="${name}"]:checked`);
          if (!chosen) return setResult(false, 'Pick an answer first.');
          const r = await api(`/lab-sessions/${session.id}/tasks/${task.id}/check`, { method: 'POST', body: { answer: Number(chosen.value) } });
          setResult(r.passed, r.message);
        } }, 'Submit'),
      );
    } else {
      const checkBtn = h('button', { class: 'primary', onclick: async () => {
        checkBtn.disabled = true;
        checkBtn.textContent = 'Checking…';
        try {
          const r = await api(`/lab-sessions/${session.id}/tasks/${task.id}/check`, { method: 'POST', body: {} });
          setResult(r.passed, [r.message, r.output].filter(Boolean).join('\n'));
        } catch (err) {
          setResult(false, err.message);
        } finally {
          checkBtn.disabled = false;
          checkBtn.textContent = 'Check';
        }
      } }, 'Check');
      controls = h(
        'div',
        {},
        checkBtn,
        ' ',
        task.hint && h('button', { onclick: () => setResult(false, `Hint: ${task.hint}`) }, 'Hint'),
        ' ',
        task.has_solution && h('button', { onclick: async () => {
          if (!confirm('Show the solution?')) return;
          const r = await api(`/lab-sessions/${session.id}/tasks/${task.id}/solution`);
          result.className = 'result';
          result.replaceChildren(h('pre', {}, h('code', {}, r.solution)));
        } }, 'Solution'),
      );
    }
    card.append(h('strong', {}, `Task ${i + 1}`), h('div', { class: 'prompt', html: task.prompt_html }), controls, result);
    return card;
  });

  view.classList.add('wide');
  view.replaceChildren(
    h(
      'div',
      { class: 'lab' },
      h(
        'aside',
        { class: 'tasks' },
        h('div', { class: 'lab-head' }, h('strong', {}, lab.title), h('span', {}, '⏱ ', timer)),
        h('div', { class: 'lab-head' }, score, h('span', {}, extendBtn, ' ', stopBtn)),
        lab.tasks.length === 0 && h('div', { class: 'muted', html: lab.description_html }),
        taskCards,
      ),
      termEl,
    ),
  );

  const term = new Terminal({ cursorBlink: true, fontSize: 14, convertEol: false, scrollback: 5000 });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open(termEl);
  fit.fit();

  let socket;
  let closedByUs = false;
  const connect = () => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${proto}://${location.host}/api/lab-sessions/${session.id}/terminal?cols=${term.cols}&rows=${term.rows}`);
    socket.binaryType = 'arraybuffer';
    socket.onmessage = (event) => term.write(new Uint8Array(event.data));
    socket.onclose = (event) => {
      if (closedByUs) return;
      term.write(`\r\n\x1b[33m[terminal disconnected${event.reason ? `: ${event.reason}` : ''}] press Enter to reconnect\x1b[0m\r\n`);
    };
  };
  term.onData((data) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'input', data }));
    else if (data === '\r') connect();
  });
  term.onResize(({ cols, rows }) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'resize', cols, rows }));
  });
  connect();
  term.focus();

  const onResize = () => fit.fit();
  window.addEventListener('resize', onResize);
  const tick = setInterval(() => {
    secondsLeft = Math.max(0, secondsLeft - 1);
    timer.textContent = fmtTime(secondsLeft);
    if (secondsLeft === 0) {
      clearInterval(tick);
      term.write('\r\n\x1b[31m[lab time is up — the environment has been removed]\x1b[0m\r\n');
    }
  }, 1000);
  timer.textContent = fmtTime(secondsLeft);

  teardown = () => {
    closedByUs = true;
    clearInterval(tick);
    window.removeEventListener('resize', onResize);
    socket?.close();
    term.dispose();
  };
}

// ---------- router ----------

async function route() {
  teardown();
  teardown = () => {};
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  try {
    if (parts[0] === 'login') return await loginPage();
    if (parts[0] === 'labs' && parts[1]) return await labPage(parts[1]);
    if (parts[0] === 'labs') return await labsPage('lab');
    if (parts[0] === 'playgrounds') return await labsPage('playground');
    if (parts[0] === 'courses' && parts[2]) return await lessonPage(parts[1], parts[2]);
    if (parts[0] === 'courses' && parts[1]) return await coursePage(parts[1]);
    return await coursesPage();
  } catch (err) {
    render(h('p', { class: 'error' }, err.message));
  }
}

({ user: me } = await api('/me'));
renderAccount();
window.addEventListener('hashchange', route);
route();
