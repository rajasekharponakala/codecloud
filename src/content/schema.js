import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'ids are lowercase letters, digits and dashes');

const quizTask = z.object({
  id,
  type: z.literal('quiz'),
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  answer: z.number().int().nonnegative(),
  explanation: z.string().optional(),
});

const shellTask = z.object({
  id,
  type: z.literal('task'),
  prompt: z.string().min(1),
  hint: z.string().optional(),
  // Shell script executed inside the lab container; exit code 0 means the task passed.
  check: z.string().min(1),
  solution: z.string().optional(),
});

export const taskSchema = z.discriminatedUnion('type', [quizTask, shellTask]);

export const environmentSchema = z
  .object({
    image: z.string().min(1).optional(),
    // Directory (relative to the lab folder) containing a Dockerfile to build the image from.
    build: z.string().min(1).optional(),
    // Omit to run `sleep infinity` (tool-only images); [] keeps the image's default CMD (e.g. dockerd, k3s).
    command: z.array(z.string()).optional(),
    privileged: z.boolean().default(false),
    memory_mb: z.number().int().positive().default(512),
    cpus: z.number().positive().default(1),
    pids_limit: z.number().int().positive().default(512),
    shell: z.string().default('/bin/bash'),
    workdir: z.string().default('/root'),
    hostname: z.string().default('controlplane'),
    env: z.record(z.string(), z.string()).default({}),
    setup: z.string().optional(),
    ready_check: z.string().optional(),
    ready_timeout_seconds: z.number().int().positive().default(180),
  })
  .refine((env) => env.image || env.build, { message: 'environment needs "image" or "build"' });

export const labSchema = z
  .object({
    id,
    kind: z.enum(['lab', 'playground']).default('lab'),
    title: z.string().min(1),
    description: z.string().default(''),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
    duration_minutes: z.number().int().positive().default(60),
    tags: z.array(z.string()).default([]),
    environment: environmentSchema,
    tasks: z.array(taskSchema).default([]),
  })
  .superRefine((lab, ctx) => {
    const seen = new Set();
    lab.tasks.forEach((task, index) => {
      if (seen.has(task.id)) ctx.addIssue({ code: 'custom', path: ['tasks', index, 'id'], message: `duplicate task id "${task.id}"` });
      seen.add(task.id);
      if (task.type === 'quiz' && task.answer >= task.options.length) {
        ctx.addIssue({ code: 'custom', path: ['tasks', index, 'answer'], message: 'answer index is out of range' });
      }
    });
    if (lab.kind === 'lab' && lab.tasks.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['tasks'], message: 'a lab needs at least one task (use kind: playground otherwise)' });
    }
  });

export const courseSchema = z.object({
  id,
  title: z.string().min(1),
  description: z.string().default(''),
  level: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  lessons: z
    .array(
      z.object({
        id,
        title: z.string().min(1),
        file: z.string().min(1),
        // Optional hands-on lab that accompanies the lesson.
        lab: id.optional(),
      }),
    )
    .min(1),
});
