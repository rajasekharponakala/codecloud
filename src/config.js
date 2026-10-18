import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');

function int(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) throw new Error(`${name} must be an integer, got "${value}"`);
  return parsed;
}

export function loadConfig(overrides = {}) {
  const sessionSecret = process.env.CODECLOUD_SESSION_SECRET ?? crypto.randomBytes(32).toString('hex');
  return {
    host: process.env.HOST ?? '0.0.0.0',
    port: int('PORT', 8080),
    dataDir: path.resolve(process.env.CODECLOUD_DATA_DIR ?? path.join(root, 'data')),
    contentDir: path.resolve(process.env.CODECLOUD_CONTENT_DIR ?? path.join(root, 'content')),
    publicDir: path.join(root, 'public'),
    xtermDir: path.join(root, 'node_modules', '@xterm'),
    sessionSecret,
    cookieSecure: process.env.CODECLOUD_COOKIE_SECURE === 'true',
    allowRegistration: process.env.CODECLOUD_ALLOW_REGISTRATION !== 'false',
    docker: {
      socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock',
      // Optional OCI runtime for lab containers, e.g. "runsc" (gVisor) or "sysbox-runc".
      labRuntime: process.env.CODECLOUD_LAB_RUNTIME || undefined,
      network: process.env.CODECLOUD_LAB_NETWORK || 'bridge',
      // Optional PEM bundle mounted as the lab's system CA store, for TLS-intercepting egress proxies.
      caBundle: process.env.CODECLOUD_LAB_CA_BUNDLE || undefined,
      // Registry holding pre-built lab images (see .github/workflows/lab-images.yml), e.g. ghcr.io/acme/codecloud-labs.
      imageRegistry: process.env.CODECLOUD_LAB_IMAGE_REGISTRY || undefined,
    },
    labs: {
      maxActivePerUser: int('CODECLOUD_MAX_LABS_PER_USER', 2),
      maxExtensions: int('CODECLOUD_MAX_EXTENSIONS', 2),
      extensionMinutes: int('CODECLOUD_EXTENSION_MINUTES', 30),
      checkTimeoutMs: int('CODECLOUD_CHECK_TIMEOUT_MS', 30_000),
      reapIntervalMs: int('CODECLOUD_REAP_INTERVAL_MS', 30_000),
    },
    ...overrides,
  };
}
