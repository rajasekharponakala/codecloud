import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { buildApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { FakeRuntime, repoContent, testConfig } from './helpers.js';

describe('HTTP API', () => {
  let app;
  let runtime;

  beforeEach(async () => {
    runtime = new FakeRuntime();
    app = await buildApp({ config: testConfig(), db: openDb(':memory:'), content: repoContent(), runtime, logger: false });
  });
  afterEach(() => app.close());

  async function signUp(username = 'alice') {
    const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { username, password: 'correct horse' } });
    expect(res.statusCode).toBe(200);
    return res.headers['set-cookie'].split(';')[0];
  }

  const call = (cookie, method, url, payload) => app.inject({ method, url, payload, headers: { cookie } });

  it('registers, signs in and out', async () => {
    const cookie = await signUp();
    expect((await call(cookie, 'GET', '/api/me')).json().user.username).toBe('alice');
    expect((await app.inject({ method: 'POST', url: '/api/auth/register', payload: { username: 'alice', password: 'whatever1' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'alice', password: 'wrong pass' } })).statusCode).toBe(401);
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'alice', password: 'correct horse' } });
    expect(login.statusCode).toBe(200);
    await call(cookie, 'POST', '/api/auth/logout');
    expect((await call(cookie, 'GET', '/api/me')).json().user).toBeNull();
  });

  it('sets a hardened session cookie', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { username: 'carol', password: 'correct horse' } });
    expect(res.headers['set-cookie']).toMatch(/HttpOnly/);
    expect(res.headers['set-cookie']).toMatch(/SameSite=Strict/);
  });

  it('serves the catalog publicly without answers', async () => {
    const { labs } = (await app.inject('/api/labs')).json();
    expect(labs.length).toBeGreaterThan(0);
    expect(JSON.stringify(labs)).not.toMatch(/"(answer|check|solution)"/);
    const { course } = (await app.inject('/api/courses/linux-foundations')).json();
    expect(course.lessons[0]).not.toHaveProperty('html');
    const { lesson } = (await app.inject('/api/courses/linux-foundations/lessons/shell-and-filesystem')).json();
    expect(lesson.html).toContain('<h1>');
  });

  it('serves the whole catalog with paths and categories', async () => {
    const catalog = (await app.inject('/api/catalog')).json();
    expect(catalog.courses.length).toBeGreaterThanOrEqual(20);
    expect(catalog.paths.map((p) => p.id)).toContain('kubernetes-administrator');
    const categories = new Set(catalog.categories.map((c) => c.id));
    for (const course of catalog.courses) expect(categories.has(course.category)).toBe(true);
    expect(Array.isArray(catalog.external)).toBe(true);
  });

  it('requires sign-in for labs', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/labs/linux-files/sessions' })).statusCode).toBe(401);
  });

  it('runs a lab end to end', async () => {
    const cookie = await signUp();
    const start = await call(cookie, 'POST', '/api/labs/linux-files/sessions');
    expect(start.statusCode).toBe(202);
    const { id } = start.json().session;
    await app.labs.settle();
    expect((await call(cookie, 'GET', `/api/lab-sessions/${id}`)).json().session.status).toBe('running');

    const wrong = await call(cookie, 'POST', `/api/lab-sessions/${id}/tasks/pwd-quiz/check`, { answer: 3 });
    expect(wrong.json().passed).toBe(false);
    const right = await call(cookie, 'POST', `/api/lab-sessions/${id}/tasks/pwd-quiz/check`, { answer: 1 });
    expect(right.json().passed).toBe(true);
    runtime.files.add('/root/projects/website');
    expect((await call(cookie, 'POST', `/api/lab-sessions/${id}/tasks/make-dir/check`, {})).json().passed).toBe(true);
    expect((await call(cookie, 'GET', `/api/lab-sessions/${id}/tasks/make-dir/solution`)).json().solution).toContain('mkdir');
    expect((await call(cookie, 'GET', '/api/progress')).json().labs['linux-files'].sort()).toEqual(['make-dir', 'pwd-quiz']);

    const other = await signUp('bob');
    expect((await call(other, 'GET', `/api/lab-sessions/${id}`)).statusCode).toBe(404);

    expect((await call(cookie, 'DELETE', `/api/lab-sessions/${id}`)).json().session.status).toBe('stopped');
    expect(runtime.containers.size).toBe(0);
  });

  it('bridges the terminal over a WebSocket and rejects foreign origins', async () => {
    const cookie = await signUp();
    const { id } = (await call(cookie, 'POST', '/api/labs/linux-files/sessions')).json().session;
    await app.labs.settle();
    await app.listen({ port: 0, host: '127.0.0.1' });
    const { port } = app.server.address();
    const url = `ws://127.0.0.1:${port}/api/lab-sessions/${id}/terminal`;

    const ws = new WebSocket(url, { headers: { cookie, origin: `http://127.0.0.1:${port}` } });
    const echoed = new Promise((resolve) => ws.on('message', (data) => resolve(data.toString())));
    ws.on('open', () => ws.send(JSON.stringify({ type: 'input', data: 'ls\r' })));
    expect(await echoed).toBe('ls\r');
    ws.close();

    const evil = new WebSocket(url, { headers: { cookie, origin: 'https://evil.example' } });
    const code = await new Promise((resolve) => evil.on('close', (c) => resolve(c)));
    expect(code).toBe(1008);
  });
});
