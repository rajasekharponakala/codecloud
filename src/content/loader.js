import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { catalogSchema, courseSchema, externalCatalogSchema, labSchema } from './schema.js';

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
    // Images built from a directory are named after it, so labs can share e.g. content/images/workstation.
    const buildDir = parsed.data.environment.build && path.resolve(dir, parsed.data.environment.build);
    const lab = {
      ...parsed.data,
      dir,
      buildDir,
      imageName: buildDir ? path.basename(buildDir) : null,
      description_html: renderMarkdown(parsed.data.description),
      tasks: parsed.data.tasks.map((task) => ({ ...task, prompt_html: renderMarkdown(task.prompt) })),
    };
    if (buildDir && !fs.existsSync(path.join(buildDir, 'Dockerfile'))) {
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

  const catalogFile = path.join(contentDir, 'catalog.yaml');
  let catalog = { categories: [], paths: [] };
  if (!fs.existsSync(catalogFile)) {
    errors.push(`${catalogFile}: missing`);
  } else {
    const parsed = catalogSchema.safeParse(readYaml(catalogFile));
    if (parsed.success) catalog = parsed.data;
    else errors.push(formatIssues(catalogFile, parsed.error));
  }
  const categoryIds = new Set(catalog.categories.map((c) => c.id));
  for (const course of courses.values()) {
    if (catalog.categories.length && !categoryIds.has(course.category)) {
      errors.push(`course "${course.id}": unknown category "${course.category}" (add it to catalog.yaml)`);
    }
  }
  for (const learningPath of catalog.paths) {
    for (const courseId of learningPath.courses) {
      if (!courses.has(courseId)) errors.push(`${catalogFile}: path "${learningPath.id}" references unknown course "${courseId}"`);
    }
  }

  const external = [];
  const externalDir = path.join(contentDir, 'external');
  if (fs.existsSync(externalDir)) {
    for (const name of fs.readdirSync(externalDir).filter((f) => f.endsWith('.json')).sort()) {
      const file = path.join(externalDir, name);
      const parsed = externalCatalogSchema.safeParse(JSON.parse(fs.readFileSync(file, 'utf8')));
      if (!parsed.success) {
        errors.push(formatIssues(file, parsed.error));
        continue;
      }
      for (const course of parsed.data.courses) {
        if (!categoryIds.has(course.category)) errors.push(`${file}: course "${course.id}" has unknown category "${course.category}"`);
        // A lab may have been removed since the last sync; drop stale links rather than fail.
        external.push({ ...course, related_labs: course.related_labs.filter((labId) => labs.has(labId)) });
      }
    }
  }

  if (errors.length) throw new ContentError(`Invalid content:\n${errors.join('\n')}`);
  return { labs, courses, catalog, external };
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
