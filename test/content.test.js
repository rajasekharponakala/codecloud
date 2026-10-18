import { describe, expect, it } from 'vitest';
import { labSchema } from '../src/content/schema.js';
import { publicLab, renderMarkdown } from '../src/content/loader.js';
import { repoContent } from './helpers.js';

const base = {
  id: 'demo',
  title: 'Demo',
  environment: { image: 'ubuntu:24.04' },
  tasks: [{ id: 't1', type: 'task', prompt: 'do it', check: 'true' }],
};

describe('content', () => {
  it('loads every course and lab shipped in the repository', () => {
    const { courses, labs } = repoContent();
    expect(courses.size).toBeGreaterThan(0);
    expect(labs.size).toBeGreaterThan(0);
    for (const course of courses.values()) {
      for (const lesson of course.lessons) expect(lesson.html).toContain('<h1>');
    }
  });

  it('applies environment defaults', () => {
    const lab = labSchema.parse(base);
    expect(lab.kind).toBe('lab');
    expect(lab.environment).toMatchObject({ privileged: false, memory_mb: 512, shell: '/bin/bash' });
  });

  it.each([
    ['a lab without tasks', { ...base, tasks: [] }, 'at least one task'],
    ['duplicate task ids', { ...base, tasks: [base.tasks[0], base.tasks[0]] }, 'duplicate task id'],
    ['an out-of-range quiz answer', { ...base, tasks: [{ id: 'q', type: 'quiz', prompt: 'p', options: ['a', 'b'], answer: 2 }] }, 'out of range'],
    ['an environment without image or build', { ...base, environment: {} }, 'image'],
    ['an invalid id', { ...base, id: 'Bad Id' }, 'lowercase'],
  ])('rejects %s', (_name, input, message) => {
    const result = labSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error.issues.map((i) => i.message).join(' ')).toContain(message);
  });

  it('allows a playground without tasks', () => {
    expect(labSchema.safeParse({ ...base, kind: 'playground', tasks: [] }).success).toBe(true);
  });

  it('never exposes answers, checks or solutions to learners', () => {
    for (const lab of repoContent().labs.values()) {
      const json = JSON.stringify(publicLab(lab));
      for (const task of lab.tasks) {
        const view = publicLab(lab).tasks.find((t) => t.id === task.id);
        expect(view).not.toHaveProperty('answer');
        expect(view).not.toHaveProperty('check');
        expect(view).not.toHaveProperty('solution');
        if (task.type === 'task') expect(json).not.toContain(JSON.stringify(task.check).slice(1, -1));
      }
    }
  });

  it('sanitizes markdown', () => {
    const html = renderMarkdown('# Hi\n\n<script>alert(1)</script><img src=x onerror=alert(1)>');
    expect(html).toContain('<h1>Hi</h1>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
  });
});
