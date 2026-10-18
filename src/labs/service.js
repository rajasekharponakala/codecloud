import crypto from 'node:crypto';
import { publicLab } from '../content/loader.js';

export class LabError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const ACTIVE = ['provisioning', 'running'];

/**
 * Owns the lab-session lifecycle: provision a container, grade tasks inside it, extend or
 * stop it, and reap it when its time runs out.
 */
export class LabService {
  constructor({ db, runtime, content, config, logger = console, now = () => Date.now() }) {
    this.db = db;
    this.runtime = runtime;
    this.content = content;
    this.config = config;
    this.log = logger;
    this.now = now;
    this.pending = new Map();
  }

  lab(labId) {
    const lab = this.content.labs.get(labId);
    if (!lab) throw new LabError(404, `unknown lab "${labId}"`);
    return lab;
  }

  row(sessionId) {
    return this.db.prepare('SELECT * FROM lab_sessions WHERE id = ?').get(sessionId);
  }

  owned(userId, sessionId) {
    const row = this.row(sessionId);
    if (!row || row.user_id !== userId) throw new LabError(404, 'lab session not found');
    return row;
  }

  running(userId, sessionId) {
    const row = this.owned(userId, sessionId);
    if (row.status !== 'running') throw new LabError(409, `lab session is ${row.status}`);
    return row;
  }

  view(row) {
    const lab = this.content.labs.get(row.lab_id);
    const results = Object.fromEntries(
      this.db
        .prepare('SELECT task_id, passed, attempts FROM task_results WHERE lab_session_id = ?')
        .all(row.id)
        .map((r) => [r.task_id, { passed: Boolean(r.passed), attempts: r.attempts }]),
    );
    return {
      id: row.id,
      status: row.status,
      error: row.error,
      created_at: row.created_at,
      expires_at: row.expires_at,
      seconds_left: Math.max(0, Math.round((row.expires_at - this.now()) / 1000)),
      extensions_left: Math.max(0, this.config.labs.maxExtensions - row.extensions),
      lab: lab ? publicLab(lab) : { id: row.lab_id, title: row.lab_id, tasks: [] },
      results,
    };
  }

  listSessions(userId) {
    return this.db
      .prepare(`SELECT * FROM lab_sessions WHERE user_id = ? AND status IN ('provisioning', 'running') ORDER BY created_at DESC`)
      .all(userId)
      .map((row) => this.view(row));
  }

  getSession(userId, sessionId) {
    return this.view(this.owned(userId, sessionId));
  }

  /** Returns the learner's active session for the lab if one exists, otherwise starts provisioning a new one. */
  startLab(userId, labId) {
    const lab = this.lab(labId);
    const active = this.db
      .prepare(`SELECT * FROM lab_sessions WHERE user_id = ? AND status IN ('provisioning', 'running') ORDER BY created_at DESC`)
      .all(userId);
    const existing = active.find((row) => row.lab_id === labId);
    if (existing) return this.view(existing);
    if (active.length >= this.config.labs.maxActivePerUser) {
      throw new LabError(429, `you already have ${active.length} running labs; stop one first`);
    }

    const id = crypto.randomUUID();
    const createdAt = this.now();
    const expiresAt = createdAt + lab.duration_minutes * 60_000;
    this.db
      .prepare('INSERT INTO lab_sessions (id, user_id, lab_id, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, userId, labId, 'provisioning', createdAt, expiresAt);

    const job = this.provision(id, lab, expiresAt).finally(() => this.pending.delete(id));
    this.pending.set(id, job);
    return this.view(this.row(id));
  }

  async provision(sessionId, lab, expiresAt) {
    const env = lab.environment;
    let containerId;
    try {
      containerId = await this.runtime.createContainer(sessionId, lab, expiresAt);
      this.db.prepare('UPDATE lab_sessions SET container_id = ? WHERE id = ?').run(containerId, sessionId);
      if (env.ready_check) await this.runtime.waitUntilReady(containerId, env.ready_check, env.ready_timeout_seconds);
      if (env.setup) {
        const result = await this.runtime.exec(containerId, env.setup, { timeoutMs: env.ready_timeout_seconds * 1000 });
        if (result.exitCode !== 0) throw new Error(`setup script failed: ${result.output.trim()}`);
      }
      // The learner may have stopped the lab while it was still provisioning.
      const changed = this.db
        .prepare(`UPDATE lab_sessions SET status = 'running' WHERE id = ? AND status = 'provisioning'`)
        .run(sessionId).changes;
      if (!changed) await this.runtime.remove(containerId);
    } catch (err) {
      this.log.error?.({ err, sessionId, lab: lab.id }, 'lab provisioning failed');
      this.db
        .prepare(`UPDATE lab_sessions SET status = 'failed', error = ?, ended_at = ? WHERE id = ?`)
        .run(String(err.message ?? err), this.now(), sessionId);
      if (containerId) await this.runtime.remove(containerId).catch(() => {});
    }
  }

  async stopSession(userId, sessionId, status = 'stopped') {
    const row = userId === null ? this.row(sessionId) : this.owned(userId, sessionId);
    if (!row || !ACTIVE.includes(row.status)) return row && this.view(row);
    this.db.prepare('UPDATE lab_sessions SET status = ?, ended_at = ? WHERE id = ?').run(status, this.now(), sessionId);
    if (row.container_id) await this.runtime.remove(row.container_id);
    return this.view(this.row(sessionId));
  }

  extendSession(userId, sessionId) {
    const row = this.running(userId, sessionId);
    if (row.extensions >= this.config.labs.maxExtensions) throw new LabError(409, 'no extensions left for this lab');
    this.db
      .prepare('UPDATE lab_sessions SET expires_at = expires_at + ?, extensions = extensions + 1 WHERE id = ?')
      .run(this.config.labs.extensionMinutes * 60_000, sessionId);
    return this.view(this.row(sessionId));
  }

  recordResult(row, taskId, passed) {
    const now = this.now();
    this.db
      .prepare(
        `INSERT INTO task_results (lab_session_id, task_id, passed, checked_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(lab_session_id, task_id) DO UPDATE SET passed = MAX(passed, excluded.passed), attempts = attempts + 1, checked_at = excluded.checked_at`,
      )
      .run(row.id, taskId, passed ? 1 : 0, now);
    if (passed) {
      this.db
        .prepare('INSERT OR IGNORE INTO lab_progress (user_id, lab_id, task_id, completed_at) VALUES (?, ?, ?, ?)')
        .run(row.user_id, row.lab_id, taskId, now);
    }
  }

  /** Grades one task. Quiz tasks compare the chosen option; shell tasks run their check script in the lab. */
  async checkTask(userId, sessionId, taskId, answer) {
    const row = this.running(userId, sessionId);
    const task = this.lab(row.lab_id).tasks.find((t) => t.id === taskId);
    if (!task) throw new LabError(404, `unknown task "${taskId}"`);

    if (task.type === 'quiz') {
      if (!Number.isInteger(answer)) throw new LabError(400, 'quiz answers must be an option index');
      const passed = answer === task.answer;
      this.recordResult(row, taskId, passed);
      return { passed, message: passed ? (task.explanation ?? 'Correct!') : 'Not quite — try again.' };
    }

    const lab = this.lab(row.lab_id);
    const result = await this.runtime.exec(row.container_id, task.check, {
      timeoutMs: this.config.labs.checkTimeoutMs,
      workdir: lab.environment.workdir,
    });
    const passed = result.exitCode === 0;
    this.recordResult(row, taskId, passed);
    let message = passed ? 'Task completed.' : 'The task is not complete yet.';
    if (result.timedOut) message = 'The check timed out; make sure your work has finished and try again.';
    // Check scripts write learner-facing feedback to stdout/stderr; it never contains the solution.
    return { passed, message, output: result.output.trim() };
  }

  solution(userId, sessionId, taskId) {
    const row = this.owned(userId, sessionId);
    const task = this.lab(row.lab_id).tasks.find((t) => t.id === taskId);
    if (!task || task.type !== 'task' || !task.solution) throw new LabError(404, 'no solution for this task');
    return { solution: task.solution };
  }

  async openTerminal(userId, sessionId, size) {
    const row = this.running(userId, sessionId);
    const env = this.lab(row.lab_id).environment;
    return this.runtime.openShell(row.container_id, { shell: env.shell, workdir: env.workdir, ...size });
  }

  progress(userId) {
    const labs = {};
    for (const r of this.db.prepare('SELECT lab_id, task_id FROM lab_progress WHERE user_id = ?').all(userId)) {
      (labs[r.lab_id] ??= []).push(r.task_id);
    }
    const lessons = {};
    for (const r of this.db.prepare('SELECT course_id, lesson_id FROM lesson_progress WHERE user_id = ?').all(userId)) {
      (lessons[r.course_id] ??= []).push(r.lesson_id);
    }
    return { labs, lessons };
  }

  completeLesson(userId, courseId, lessonId) {
    const course = this.content.courses.get(courseId);
    if (!course?.lessons.some((l) => l.id === lessonId)) throw new LabError(404, 'unknown lesson');
    this.db
      .prepare('INSERT OR IGNORE INTO lesson_progress (user_id, course_id, lesson_id, completed_at) VALUES (?, ?, ?, ?)')
      .run(userId, courseId, lessonId, this.now());
  }

  /** Expires sessions whose time is up and removes containers no active session owns. */
  async reap() {
    const expired = this.db
      .prepare(`SELECT id FROM lab_sessions WHERE status IN ('provisioning', 'running') AND expires_at <= ?`)
      .all(this.now());
    for (const { id } of expired) {
      await this.stopSession(null, id, 'expired').catch((err) => this.log.error?.({ err, id }, 'failed to expire lab'));
    }
    const managed = await this.runtime.listManaged();
    for (const { containerId, sessionId } of managed) {
      const row = sessionId && this.row(sessionId);
      if (!row || !ACTIVE.includes(row.status)) {
        await this.runtime.remove(containerId).catch((err) => this.log.error?.({ err, containerId }, 'failed to remove orphan'));
      }
    }
  }

  /** On boot, sessions caught mid-provisioning by a restart cannot recover; mark them failed. */
  recoverAfterRestart() {
    this.db
      .prepare(`UPDATE lab_sessions SET status = 'failed', error = 'platform restarted during provisioning', ended_at = ? WHERE status = 'provisioning'`)
      .run(this.now());
  }

  /** Waits for in-flight provisioning (used by tests and graceful shutdown). */
  async settle() {
    await Promise.allSettled([...this.pending.values()]);
  }
}
