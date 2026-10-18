// Runs against a real Docker Engine. Enable with: npm run test:docker
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { buildApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { DockerRuntime } from '../src/runtime/docker.js';
import { repoContent, testConfig } from './helpers.js';

describe.runIf(process.env.CODECLOUD_DOCKER_TESTS)('Docker runtime (integration)', () => {
  const config = testConfig();
  const runtime = new DockerRuntime(config.docker);
  let app;
  let cookie;
  let base;

  beforeAll(async () => {
    app = await buildApp({ config, db: openDb(':memory:'), content: repoContent(), runtime, logger: false });
    await app.listen({ port: 0, host: '127.0.0.1' });
    base = `127.0.0.1:${app.server.address().port}`;
    const res = await fetch(`http://${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'integration', password: 'integration-pass' }),
    });
    cookie = res.headers.get('set-cookie').split(';')[0];
  });

  afterAll(async () => {
    for (const s of app.labs.listSessions(1)) await app.labs.stopSession(1, s.id);
    await app.close();
  });

  const api = async (method, path, body) => {
    const res = await fetch(`http://${base}/api${path}`, {
      method,
      headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  };

  it('provisions a lab, grades work typed into the browser terminal, and cleans up', { timeout: 180_000 }, async () => {
    const { session } = await api('POST', '/labs/linux-files/sessions');
    await app.labs.settle();
    expect((await api('GET', `/lab-sessions/${session.id}`)).session.status).toBe('running');
    expect((await api('POST', `/lab-sessions/${session.id}/tasks/make-dir/check`, {})).passed).toBe(false);

    const ws = new WebSocket(`ws://${base}/api/lab-sessions/${session.id}/terminal`, { headers: { cookie, origin: `http://${base}` } });
    let output = '';
    ws.on('message', (data) => (output += data.toString()));
    await new Promise((resolve) => ws.on('open', resolve));
    ws.send(JSON.stringify({ type: 'resize', cols: 100, rows: 30 }));
    ws.send(JSON.stringify({ type: 'input', data: 'mkdir -p /root/projects/website && echo DONE-$((40+2))\r' }));
    await expect.poll(() => output, { timeout: 15_000 }).toContain('DONE-42');
    ws.close();

    expect((await api('POST', `/lab-sessions/${session.id}/tasks/make-dir/check`, {})).passed).toBe(true);

    const { containerId } = (await runtime.listManaged()).find((c) => c.sessionId === session.id);
    await api('DELETE', `/lab-sessions/${session.id}`);
    expect((await runtime.listManaged()).some((c) => c.containerId === containerId)).toBe(false);
  });

  it('times out runaway check scripts', { timeout: 60_000 }, async () => {
    const lab = repoContent().labs.get('linux-files');
    const id = await runtime.createContainer(`timeout-${Date.now()}`, lab, Date.now() + 60_000);
    try {
      const result = await runtime.exec(id, 'sleep 30', { timeoutMs: 1000 });
      expect(result).toMatchObject({ timedOut: true, exitCode: null });
      expect(await runtime.exec(id, 'echo hi; exit 3')).toMatchObject({ exitCode: 3, output: 'hi\n' });
    } finally {
      await runtime.remove(id);
    }
  });
});
