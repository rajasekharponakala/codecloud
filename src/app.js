import path from 'node:path';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import { SqliteSessionStore } from './db.js';
import { AuthService } from './auth.js';
import { LabService } from './labs/service.js';
import { apiRoutes } from './routes/api.js';
import { terminalRoutes } from './routes/terminal.js';

/** Builds the HTTP app. `runtime` is the lab runtime (DockerRuntime in production, a fake in tests). */
export async function buildApp({ config, db, content, runtime, logger = true }) {
  const app = Fastify({ logger, trustProxy: true });
  const store = new SqliteSessionStore(db);
  const auth = new AuthService(db);
  const labs = new LabService({ db, runtime, content, config, logger: app.log });

  await app.register(fastifyCookie);
  await app.register(fastifySession, {
    secret: config.sessionSecret,
    cookieName: 'codecloud.sid',
    store,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'strict', secure: config.cookieSecure, maxAge: 7 * 86_400_000, path: '/' },
  });
  await app.register(fastifyWebsocket, { options: { maxPayload: 64 * 1024 } });

  await app.register(fastifyStatic, { root: config.publicDir, prefix: '/' });
  await app.register(fastifyStatic, { root: config.xtermDir, prefix: '/vendor/xterm/', decorateReply: false });

  app.get('/healthz', async () => ({ ok: true }));
  await app.register(apiRoutes, { prefix: '/api', auth, labs, content, config });
  await app.register(terminalRoutes, { prefix: '/api', labs });

  app.decorate('labs', labs);
  app.decorate('sessionStore', store);
  return app;
}

export const defaultDbPath = (config) => path.join(config.dataDir, 'codecloud.db');
