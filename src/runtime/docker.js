import fs from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import Docker from 'dockerode';

const MANAGED_LABEL = 'io.codecloud.managed';
const SESSION_LABEL = 'io.codecloud.session';
const MAX_OUTPUT_BYTES = 16 * 1024;
const CA_PATH = '/etc/ssl/certs/ca-certificates.crt';

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [path.relative(base, full)];
  });
}

function truncate(text) {
  return text.length > MAX_OUTPUT_BYTES ? `${text.slice(0, MAX_OUTPUT_BYTES)}\n…(truncated)` : text;
}

/**
 * Lab runtime backed by the Docker Engine API (via dockerode). Every lab session is one
 * disposable container; terminals and grading scripts are `docker exec` processes in it.
 */
export class DockerRuntime {
  constructor({ socketPath, labRuntime, network, caBundle } = {}) {
    this.docker = new Docker(socketPath ? { socketPath } : undefined);
    this.labRuntime = labRuntime;
    this.network = network ?? 'bridge';
    this.caBundle = caBundle;
  }

  async ping() {
    await this.docker.ping();
  }

  imageTagFor(lab) {
    return lab.environment.image ?? `codecloud-lab/${lab.id}:latest`;
  }

  async ensureImage(lab) {
    const tag = this.imageTagFor(lab);
    try {
      await this.docker.getImage(tag).inspect();
      return tag;
    } catch (err) {
      if (err.statusCode !== 404) throw err;
    }
    const stream = lab.environment.build
      ? await this.buildImage(lab, tag)
      : await this.docker.pull(tag);
    await new Promise((resolve, reject) =>
      this.docker.modem.followProgress(stream, (err, events) => {
        const failed = events?.find((event) => event.error);
        if (err || failed) reject(err ?? new Error(failed.error));
        else resolve();
      }),
    );
    return tag;
  }

  async buildImage(lab, tag) {
    const context = path.join(lab.dir, lab.environment.build);
    return this.docker.buildImage({ context, src: listFiles(context) }, { t: tag });
  }

  async createContainer(sessionId, lab, expiresAt) {
    const env = lab.environment;
    const image = await this.ensureImage(lab);
    const container = await this.docker.createContainer({
      name: `codecloud-${sessionId}`,
      Image: image,
      // No command: keep the container idling for exec sessions. `command: []`: use the image's own CMD.
      Cmd: env.command === undefined ? ['sleep', 'infinity'] : env.command.length ? env.command : undefined,
      Hostname: env.hostname,
      WorkingDir: env.workdir,
      Env: Object.entries({
        TERM: 'xterm-256color',
        ...(this.caBundle ? { SSL_CERT_FILE: CA_PATH } : {}),
        ...env.env,
      }).map(([k, v]) => `${k}=${v}`),
      Labels: {
        [MANAGED_LABEL]: 'true',
        [SESSION_LABEL]: sessionId,
        'io.codecloud.lab': lab.id,
        'io.codecloud.expires-at': String(expiresAt),
      },
      HostConfig: {
        Privileged: env.privileged,
        Memory: env.memory_mb * 1024 * 1024,
        NanoCpus: Math.round(env.cpus * 1e9),
        PidsLimit: env.pids_limit,
        NetworkMode: this.network,
        Runtime: this.labRuntime,
        AutoRemove: false,
        Init: env.command ? undefined : true,
        SecurityOpt: env.privileged ? undefined : ['no-new-privileges'],
        Binds: this.caBundle ? [`${path.resolve(this.caBundle)}:${CA_PATH}:ro`] : undefined,
      },
    });
    await container.start();
    return container.id;
  }

  /** Runs `script` with /bin/sh in the container. Resolves to { exitCode, output, timedOut }. */
  async exec(containerId, script, { timeoutMs = 30_000, workdir } = {}) {
    const container = this.docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: ['/bin/sh', '-c', script],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: workdir,
    });
    const stream = await exec.start({ hijack: true, stdin: false });
    const sink = new PassThrough();
    const chunks = [];
    sink.on('data', (chunk) => chunks.push(chunk));
    container.modem.demuxStream(stream, sink, sink);

    let timer;
    const finished = new Promise((resolve, reject) => {
      stream.on('end', () => resolve(false));
      stream.on('close', () => resolve(false));
      stream.on('error', reject);
    });
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(true), timeoutMs);
    });
    const timedOut = await Promise.race([finished, timeout]);
    clearTimeout(timer);
    if (timedOut) stream.destroy();

    const output = truncate(Buffer.concat(chunks).toString('utf8'));
    if (timedOut) return { exitCode: null, output, timedOut: true };
    const { ExitCode } = await exec.inspect();
    return { exitCode: ExitCode, output, timedOut: false };
  }

  /** Polls `script` until it exits 0 or the deadline passes. */
  async waitUntilReady(containerId, script, timeoutSeconds) {
    const deadline = Date.now() + timeoutSeconds * 1000;
    let last;
    while (Date.now() < deadline) {
      last = await this.exec(containerId, script, { timeoutMs: 15_000 });
      if (last.exitCode === 0) return;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error(`environment was not ready after ${timeoutSeconds}s: ${last?.output?.trim() ?? ''}`);
  }

  /**
   * Starts an interactive TTY shell. Returns { stream, resize(cols, rows) } where `stream` is a
   * duplex: write keystrokes to it, read terminal output from it.
   */
  async openShell(containerId, { shell, workdir, cols = 120, rows = 30 }) {
    const container = this.docker.getContainer(containerId);
    // Fall back to /bin/sh for images without the configured shell (e.g. busybox-based ones).
    // `docker exec` starts with umask 0000; use the usual 022 so files look like a normal login.
    const cmd = ['/bin/sh', '-c', `umask 022; if [ -x ${shell} ]; then exec ${shell} -l; else exec /bin/sh -l; fi`];
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      WorkingDir: workdir,
      Env: ['TERM=xterm-256color'],
    });
    const stream = await exec.start({ hijack: true, stdin: true, Tty: true });
    const resize = (w, h) => exec.resize({ w, h }).catch(() => {});
    await resize(cols, rows);
    return { stream, resize };
  }

  async remove(containerId) {
    try {
      await this.docker.getContainer(containerId).remove({ force: true, v: true });
    } catch (err) {
      if (err.statusCode !== 404) throw err;
    }
  }

  /** Session ids of every container this platform manages, running or not. */
  async listManaged() {
    const containers = await this.docker.listContainers({ all: true, filters: { label: [`${MANAGED_LABEL}=true`] } });
    return containers.map((c) => ({ containerId: c.Id, sessionId: c.Labels[SESSION_LABEL] }));
  }
}
