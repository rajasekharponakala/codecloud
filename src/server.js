import path from 'node:path';
import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { loadContent } from './content/loader.js';
import { DockerRuntime } from './runtime/docker.js';
import { buildApp, defaultDbPath } from './app.js';

const config = loadConfig();
const content = loadContent(config.contentDir);
const db = openDb(defaultDbPath(config));
const runtime = new DockerRuntime(config.docker);
const app = await buildApp({ config, db, content, runtime });

if (!process.env.CODECLOUD_SESSION_SECRET) {
  app.log.warn('CODECLOUD_SESSION_SECRET is not set; logins will not survive a restart');
}
try {
  await runtime.ping();
} catch (err) {
  app.log.error({ err }, `cannot reach Docker at ${config.docker.socketPath}; labs will fail to start`);
}

app.labs.recoverAfterRestart();
const reaper = setInterval(() => {
  app.labs.reap().catch((err) => app.log.error({ err }, 'reaper failed'));
  app.sessionStore.prune();
}, config.labs.reapIntervalMs);
reaper.unref();

app.log.info(`loaded ${content.courses.size} courses and ${content.labs.size} labs from ${path.relative(process.cwd(), config.contentDir) || '.'}`);
await app.listen({ host: config.host, port: config.port });

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    clearInterval(reaper);
    await app.close();
    db.close();
    process.exit(0);
  });
}
