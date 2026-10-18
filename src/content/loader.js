import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { courseSchema, labSchema } from './schema.js';

export class ContentError extends Error {}

function formatIssues(file, error) {
  const lines = error.issues.map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  return `${file}:\n${lines.join('\n')}`;
}

function readYaml(file) {
  return YAML.parse(fs.readFileSync(file, 'utf8'));
}

function subdirectories(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

export function renderMarkdown(source) {
  return sanitizeHtml(marked.parse(source), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2']),
    allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, code: ['class'] },
  });
}

/** Loads and validates every course and lab under `contentDir`. Throws ContentError listing all problems. */
export function loadContent(contentDir) {
  const errors = [];
  const labs = new Map();
  const courses = new Map();

  for (const dir of subdirectories(path.join(contentDir, 'labs'))) {
    const file = path.join(dir, 'lab.yaml');
    if (!fs.existsSync(file)) continue;
    const parsed = labSchema.safeParse(readYaml(file));
    if (!parsed.success) {
      errors.push(formatIssues(file, parsed.error));
      continue;
    }
    const lab = {
      ...parsed.data,
      dir,
      description_html: renderMarkdown(parsed.data.description),
      tasks: parsed.data.tasks.map((task) => ({ ...task, prompt_html: renderMarkdown(task.prompt) })),
    };
    if (lab.environment.build && !fs.existsSync(path.join(dir, lab.environment.build, 'Dockerfile'))) {
      errors.push(`${file}: environment.build "${lab.environment.build}" has no Dockerfile`);
    }
    if (labs.has(lab.id)) errors.push(`${file}: duplicate lab id "${lab.id}"`);
    labs.set(lab.id, lab);
  }

  for (const dir of subdirectories(path.join(contentDir, 'courses'))) {
    const file = path.join(dir, 'course.yaml');
    if (!fs.existsSync(file)) continue;
    const parsed = courseSchema.safeParse(readYaml(file));
    if (!parsed.success) {
      errors.push(formatIssues(file, parsed.error));
      continue;
    }
    const course = parsed.data;
    const lessons = [];
    for (const lesson of course.lessons) {
      const lessonFile = path.join(dir, lesson.file);
      if (!fs.existsSync(lessonFile)) {
        errors.push(`${file}: lesson "${lesson.id}" points at missing file ${lesson.file}`);
        continue;
      }
      if (lesson.lab && !labs.has(lesson.lab)) errors.push(`${file}: lesson "${lesson.id}" references unknown lab "${lesson.lab}"`);
      lessons.push({ ...lesson, html: renderMarkdown(fs.readFileSync(lessonFile, 'utf8')) });
    }
    if (courses.has(course.id)) errors.push(`${file}: duplicate course id "${course.id}"`);
    courses.set(course.id, { ...course, lessons });
  }

  if (errors.length) throw new ContentError(`Invalid content:\n${errors.join('\n')}`);
  return { labs, courses };
}

/** The view of a lab that is safe to send to learners: no answers, checks or solutions. */
export function publicLab(lab) {
  return {
    id: lab.id,
    kind: lab.kind,
    title: lab.title,
    description: lab.description,
    description_html: lab.description_html,
    difficulty: lab.difficulty,
    duration_minutes: lab.duration_minutes,
    tags: lab.tags,
    tasks: lab.tasks.map((task) =>
      task.type === 'quiz'
        ? { id: task.id, type: task.type, prompt_html: task.prompt_html, options: task.options }
        : { id: task.id, type: task.type, prompt_html: task.prompt_html, hint: task.hint, has_solution: Boolean(task.solution) },
    ),
  };
}
