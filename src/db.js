import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS http_sessions (
  sid TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS lab_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  lab_id TEXT NOT NULL,
  container_id TEXT,
  status TEXT NOT NULL,
  error TEXT,
  extensions INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  ended_at INTEGER
);
CREATE INDEX IF NOT EXISTS lab_sessions_user ON lab_sessions(user_id, status);
CREATE TABLE IF NOT EXISTS task_results (
  lab_session_id TEXT NOT NULL REFERENCES lab_sessions(id),
  task_id TEXT NOT NULL,
  passed INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  checked_at INTEGER NOT NULL,
  PRIMARY KEY (lab_session_id, task_id)
);
CREATE TABLE IF NOT EXISTS lab_progress (
  user_id INTEGER NOT NULL REFERENCES users(id),
  lab_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, lab_id, task_id)
);
CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id INTEGER NOT NULL REFERENCES users(id),
  course_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, course_id, lesson_id)
);
`;

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

/**
 * Thin adapter so @fastify/session persists sessions in SQLite instead of its
 * in-memory default (which loses every login on restart).
 */
export class SqliteSessionStore {
  constructor(db) {
    this.db = db;
    this.getStmt = db.prepare('SELECT data, expires_at FROM http_sessions WHERE sid = ?');
    this.setStmt = db.prepare(
      'INSERT INTO http_sessions (sid, data, expires_at) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at',
    );
    this.delStmt = db.prepare('DELETE FROM http_sessions WHERE sid = ?');
    this.pruneStmt = db.prepare('DELETE FROM http_sessions WHERE expires_at < ?');
  }

  get(sid, callback) {
    try {
      const row = this.getStmt.get(sid);
      if (!row || row.expires_at < Date.now()) return callback(null, null);
      callback(null, JSON.parse(row.data));
    } catch (err) {
      callback(err);
    }
  }

  set(sid, session, callback) {
    try {
      const expires = session.cookie?.expires ? new Date(session.cookie.expires).getTime() : Date.now() + 86_400_000;
      this.setStmt.run(sid, JSON.stringify(session), expires);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      this.delStmt.run(sid);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  prune() {
    this.pruneStmt.run(Date.now());
  }
}
