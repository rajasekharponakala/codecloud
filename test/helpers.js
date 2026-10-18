import path from 'node:path';
import { PassThrough } from 'node:stream';
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';
import { loadContent } from '../src/content/loader.js';

export const repoContent = () => loadContent(path.resolve(import.meta.dirname, '..', 'content'));

export function testConfig(overrides = {}) {
  return loadConfig({ sessionSecret: 'x'.repeat(64), ...overrides });
}

export function testDb() {
  const db = openDb(':memory:');
  db.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (1, 'alice', 'x', 0), (2, 'bob', 'x', 0)").run();
  return db;
}

/** In-memory stand-in for DockerRuntime. `files` simulates state the learner creates. */
export class FakeRuntime {
  constructor() {
    this.containers = new Map();
    this.files = new Set();
    this.failCreate = null;
    this.execs = [];
    this.gate = null;
  }

  async createContainer(sessionId, lab) {
    if (this.gate) await this.gate;
    if (this.failCreate) throw new Error(this.failCreate);
    const id = `c-${sessionId}`;
    this.containers.set(id, { sessionId, lab: lab.id });
    return id;
  }

  async waitUntilReady() {}

  async exec(containerId, script) {
    if (!this.containers.has(containerId)) throw new Error('no such container');
    this.execs.push(script);
    // Setup scripts always succeed. Check scripts (they contain `exit 1`) pass when they
    // mention a "file" the test created.
    const isCheck = script.includes('exit 1');
    const passed = !isCheck || [...this.files].some((f) => script.includes(f));
    return { exitCode: passed ? 0 : 1, output: passed ? '' : 'not done', timedOut: false };
  }

  async openShell(containerId) {
    if (!this.containers.has(containerId)) throw new Error('no such container');
    // A PassThrough echoes whatever the "learner" types, like a TTY with echo on.
    return { stream: new PassThrough(), resize: () => {} };
  }

  async remove(containerId) {
    this.containers.delete(containerId);
  }

  async listManaged() {
    return [...this.containers.entries()].map(([containerId, c]) => ({ containerId, sessionId: c.sessionId }));
  }
}
