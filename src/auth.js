import { hash, verify } from '@node-rs/argon2';

const USERNAME = /^[a-zA-Z0-9_.-]{3,32}$/;

export class AuthService {
  constructor(db, now = () => Date.now()) {
    this.db = db;
    this.now = now;
  }

  async register(username, password) {
    if (typeof username !== 'string' || !USERNAME.test(username)) {
      return { error: 'username must be 3-32 letters, digits, dots, dashes or underscores' };
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 256) {
      return { error: 'password must be 8-256 characters' };
    }
    if (this.db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
      return { error: 'that username is taken' };
    }
    const passwordHash = await hash(password);
    const { lastInsertRowid } = this.db
      .prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)')
      .run(username, passwordHash, this.now());
    return { user: { id: Number(lastInsertRowid), username } };
  }

  async login(username, password) {
    if (typeof username !== 'string' || typeof password !== 'string') return { error: 'invalid credentials' };
    const row = this.db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username);
    if (!row || !(await verify(row.password_hash, password))) return { error: 'invalid credentials' };
    return { user: { id: row.id, username: row.username } };
  }
}
