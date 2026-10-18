import { beforeEach, describe, expect, it } from 'vitest';
import { LabService } from '../src/labs/service.js';
import { FakeRuntime, repoContent, testConfig, testDb } from './helpers.js';

describe('LabService', () => {
  let clock;
  let runtime;
  let db;
  let labs;

  beforeEach(() => {
    clock = 1_000_000;
    runtime = new FakeRuntime();
    db = testDb();
    labs = new LabService({ db, runtime, content: repoContent(), config: testConfig(), logger: {}, now: () => clock });
  });

  async function running(userId = 1, labId = 'linux-files') {
    const session = labs.startLab(userId, labId);
    await labs.settle();
    return labs.getSession(userId, session.id);
  }

  it('provisions a container and becomes running', async () => {
    const started = labs.startLab(1, 'linux-files');
    expect(started.status).toBe('provisioning');
    await labs.settle();
    const session = labs.getSession(1, started.id);
    expect(session.status).toBe('running');
    expect(session.seconds_left).toBe(30 * 60);
    expect(runtime.containers.size).toBe(1);
    expect(runtime.execs[0]).toContain('mkdir -p /root/reports'); // the setup script ran
  });

  it('reuses the active session for the same lab and caps concurrent labs', async () => {
    const first = await running(1, 'linux-files');
    expect(labs.startLab(1, 'linux-files').id).toBe(first.id);
    await running(1, 'linux-processes');
    expect(() => labs.startLab(1, 'docker-basics')).toThrow(/already have 2 running labs/);
  });

  it('marks failed provisioning and cleans up', async () => {
    runtime.failCreate = 'image not found';
    const started = labs.startLab(1, 'linux-files');
    await labs.settle();
    expect(labs.getSession(1, started.id)).toMatchObject({ status: 'failed', error: 'image not found' });
  });

  it('grades quiz answers without leaking the right one', async () => {
    const session = await running();
    expect(await labs.checkTask(1, session.id, 'pwd-quiz', 0)).toMatchObject({ passed: false });
    expect(await labs.checkTask(1, session.id, 'pwd-quiz', 1)).toMatchObject({ passed: true });
    await expect(labs.checkTask(1, session.id, 'pwd-quiz', undefined)).rejects.toThrow(/option index/);
  });

  it('grades shell tasks by running the check in the container and records progress', async () => {
    const session = await running();
    expect((await labs.checkTask(1, session.id, 'make-dir')).passed).toBe(false);
    runtime.files.add('/root/projects/website');
    expect((await labs.checkTask(1, session.id, 'make-dir')).passed).toBe(true);
    // A later failing attempt must not erase a pass.
    runtime.files.clear();
    await labs.checkTask(1, session.id, 'make-dir');
    expect(labs.getSession(1, session.id).results['make-dir']).toEqual({ passed: true, attempts: 3 });
    expect(labs.progress(1).labs['linux-files']).toEqual(['make-dir']);
  });

  it('keeps sessions private to their owner', async () => {
    const session = await running(1);
    expect(() => labs.getSession(2, session.id)).toThrow(/not found/);
    await expect(labs.checkTask(2, session.id, 'make-dir')).rejects.toThrow(/not found/);
    expect(() => labs.solution(2, session.id, 'make-dir')).toThrow(/not found/);
  });

  it('extends a limited number of times', async () => {
    const session = await running();
    const extended = labs.extendSession(1, session.id);
    expect(extended.seconds_left).toBe(60 * 60);
    labs.extendSession(1, session.id);
    expect(() => labs.extendSession(1, session.id)).toThrow(/no extensions left/);
  });

  it('stops a session and removes its container', async () => {
    const session = await running();
    expect((await labs.stopSession(1, session.id)).status).toBe('stopped');
    expect(runtime.containers.size).toBe(0);
    await expect(labs.checkTask(1, session.id, 'make-dir')).rejects.toThrow(/stopped/);
  });

  it('removes the container when the learner stops a lab mid-provisioning', async () => {
    let release;
    runtime.gate = new Promise((resolve) => (release = resolve));
    const started = labs.startLab(1, 'linux-files');
    await labs.stopSession(1, started.id);
    release();
    await labs.settle();
    expect(labs.getSession(1, started.id).status).toBe('stopped');
    expect(runtime.containers.size).toBe(0);
  });

  it('reaps expired sessions and orphaned containers', async () => {
    const session = await running();
    runtime.containers.set('orphan', { sessionId: 'gone' });
    clock += 31 * 60_000;
    await labs.reap();
    expect(labs.getSession(1, session.id).status).toBe('expired');
    expect(runtime.containers.size).toBe(0);
  });

  it('tracks lesson completion', () => {
    labs.completeLesson(1, 'linux-foundations', 'shell-and-filesystem');
    expect(labs.progress(1).lessons).toEqual({ 'linux-foundations': ['shell-and-filesystem'] });
    expect(() => labs.completeLesson(1, 'linux-foundations', 'nope')).toThrow(/unknown lesson/);
  });
});
