#!/usr/bin/env node
import { loadConfig } from './config.js';
import { loadContent, ContentError } from './content/loader.js';
import { DockerRuntime } from './runtime/docker.js';

const [command, ...args] = process.argv.slice(2);
const config = loadConfig();

function usage() {
  console.log(`Usage: codecloud <command>

Commands:
  validate                 Validate every course and lab under the content directory
  prepare <lab-id>...      Pull or build the images of the given labs (pre-warms a lab host)
  test-lab <lab-id> [--solve]
                           Provision the lab in Docker, run each task's check, and with
                           --solve run each solution first (author smoke test), then clean up
`);
}

async function testLab(labId, solve) {
  const content = loadContent(config.contentDir);
  const lab = content.labs.get(labId);
  if (!lab) throw new Error(`unknown lab "${labId}"`);
  const runtime = new DockerRuntime(config.docker);
  const sessionId = `test-${Date.now()}`;
  console.log(`provisioning ${lab.id} …`);
  const containerId = await runtime.createContainer(sessionId, lab, Date.now() + 3_600_000);
  let failures = 0;
  try {
    const env = lab.environment;
    if (env.ready_check) await runtime.waitUntilReady(containerId, env.ready_check, env.ready_timeout_seconds);
    if (env.setup) {
      const setup = await runtime.exec(containerId, env.setup, { timeoutMs: env.ready_timeout_seconds * 1000 });
      if (setup.exitCode !== 0) throw new Error(`setup failed:\n${setup.output}`);
    }
    const tasks = lab.tasks.filter((t) => t.type === 'task');
    // Every check must fail on the fresh environment, before any solution has run.
    for (const task of tasks) {
      const before = await runtime.exec(containerId, task.check, { workdir: env.workdir });
      if (before.exitCode === 0) {
        failures += 1;
        console.log(`✗ ${task.id}: check passes before the learner did anything`);
      }
    }
    // Then each solution, in order, must make its check pass.
    for (const task of solve ? tasks : []) {
      if (!task.solution) {
        console.log(`- ${task.id}: no solution to run`);
        continue;
      }
      const run = await runtime.exec(containerId, task.solution, { workdir: env.workdir, timeoutMs: 300_000 });
      const after = await runtime.exec(containerId, task.check, { workdir: env.workdir, timeoutMs: 120_000 });
      const ok = after.exitCode === 0;
      if (!ok) failures += 1;
      console.log(`${ok ? '✓' : '✗'} ${task.id}${ok ? '' : `\n  solution output: ${run.output.trim()}\n  check output: ${after.output.trim()}`}`);
    }
  } finally {
    await runtime.remove(containerId);
  }
  if (failures) throw new Error(`${failures} problem(s) found in ${lab.id}`);
  console.log(`${lab.id}: ok`);
}

try {
  if (command === 'validate') {
    const { courses, labs } = loadContent(config.contentDir);
    console.log(`ok: ${courses.size} courses, ${labs.size} labs`);
  } else if (command === 'prepare' && args.length) {
    const { labs } = loadContent(config.contentDir);
    const runtime = new DockerRuntime(config.docker);
    for (const id of args) {
      const lab = labs.get(id);
      if (!lab) throw new Error(`unknown lab "${id}"`);
      console.log(`${id}: ${await runtime.ensureImage(lab)}`);
    }
  } else if (command === 'test-lab' && args[0]) {
    await testLab(args[0], args.includes('--solve'));
  } else {
    usage();
    process.exitCode = command ? 1 : 0;
  }
} catch (err) {
  console.error(err instanceof ContentError ? err.message : `error: ${err.message}`);
  process.exitCode = 1;
}
