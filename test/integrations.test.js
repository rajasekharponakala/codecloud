import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as tar from 'tar';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { buildEntries, catalogDocument, categorize, compileCategories, fetchCourses, labsByCategory } from '../src/integrations/edx.js';
import { courseToOlx, writeOlxArchive } from '../src/integrations/olx.js';
import { repoContent } from './helpers.js';

const sources = YAML.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../content/external/edx-sources.yaml'), 'utf8'));

const apiCourse = (overrides) => ({
  id: 'course-v1:LinuxFoundationX+LFS101x+1T2026',
  course_id: 'course-v1:LinuxFoundationX+LFS101x+1T2026',
  name: 'Introduction to Linux',
  org: 'LinuxFoundationX',
  number: 'LFS101x',
  short_description: 'Develop a good working knowledge of Linux.',
  start: '2026-01-10T00:00:00Z',
  end: null,
  pacing: 'self',
  effort: '5-7 hours/week',
  hidden: false,
  invitation_only: false,
  media: { image: { small: '/asset-v1:LinuxFoundationX+LFS101x+1T2026/small.jpg' } },
  ...overrides,
});

describe('edX sync', () => {
  const matchers = compileCategories(sources.categories);

  it.each([
    ['Introduction to Kubernetes', 'kubernetes'],
    ['Containers with Docker and Podman', 'containers'],
    ['Getting Started with OpenTofu', 'iac'],
    ['Introduction to Git for beginners', 'git'],
    ['Digital Marketing', null], // "git" must match whole words only
    ['Introduction to Linux', 'linux'],
    ['Cloud Computing Basics', 'cloud'],
    ['Databases: Relational Databases and SQL', 'databases'],
    ['Medieval History', null],
  ])('categorizes %s', (name, expected) => {
    expect(categorize({ name, short_description: '' }, matchers)).toBe(expected);
  });

  it('follows pagination with the Open edX response shape', async () => {
    const pages = {
      '1': { results: [apiCourse()], pagination: { next: 'https://lms.test/api/courses/v1/courses/?page=2&page_size=100', num_pages: 2 } },
      '2': { results: [apiCourse({ id: 'b', course_id: 'b', name: 'Kubernetes' })], pagination: { next: null, num_pages: 2 } },
    };
    const requested = [];
    const fetchImpl = async (url) => {
      requested.push(url.href);
      return { ok: true, status: 200, json: async () => pages[url.searchParams.get('page') ?? '1'] };
    };
    const courses = await fetchCourses('https://lms.test', { fetchImpl, delayMs: 0 });
    expect(courses.map((c) => c.course_id)).toEqual(['course-v1:LinuxFoundationX+LFS101x+1T2026', 'b']);
    expect(requested[0]).toContain('/api/courses/v1/courses/?page_size=100&active_only=true');
  });

  it('turns API records into validated catalog entries', () => {
    const content = repoContent();
    const raw = [
      apiCourse(),
      apiCourse({ id: 'x', course_id: 'x', name: 'Kubernetes for Developers', start: '2025-05-01T00:00:00Z' }),
      apiCourse({ id: 'hidden', course_id: 'hidden', name: 'Linux Hidden', hidden: true }),
      apiCourse({ id: 'invite', course_id: 'invite', name: 'Linux Private', invitation_only: true }),
      apiCourse({ id: 'ended', course_id: 'ended', name: 'Linux Old', end: '2020-01-01T00:00:00Z' }),
      apiCourse({ id: 'other', course_id: 'other', name: 'Poetry', short_description: 'Sonnets and verse.' }),
    ];
    const entries = buildEntries(raw, {
      provider: 'edx',
      baseUrl: 'https://courses.edx.org',
      categories: sources.categories,
      maxPerCategory: 5,
      labsByCategory: labsByCategory(content),
      now: new Date('2026-06-01'),
    });
    expect(entries.map((e) => [e.id, e.category])).toEqual([
      ['edx:x', 'kubernetes'],
      ['edx:course-v1:LinuxFoundationX+LFS101x+1T2026', 'linux'],
    ]);
    const linux = entries[1];
    expect(linux.url).toBe('https://courses.edx.org/courses/course-v1%3ALinuxFoundationX%2BLFS101x%2B1T2026/about');
    expect(linux.image).toBe('https://courses.edx.org/asset-v1:LinuxFoundationX+LFS101x+1T2026/small.jpg');
    expect(linux.related_labs).toHaveLength(3);
    expect(linux.related_labs).toContain('linux-files');
    expect(catalogDocument(entries, null).courses).toHaveLength(2);
  });

  it('keeps the newest courses per category', () => {
    const raw = ['2024', '2026', '2025'].map((year) => apiCourse({ id: year, course_id: year, start: `${year}-01-01T00:00:00Z` }));
    const entries = buildEntries(raw, {
      provider: 'edx', baseUrl: 'https://courses.edx.org', categories: sources.categories, maxPerCategory: 2, labsByCategory: new Map(),
    });
    expect(entries.map((e) => e.id)).toEqual(['edx:2026', 'edx:2025']);
  });

  it('does not rewrite the file when nothing changed', () => {
    const doc = catalogDocument([], { generated_at: 'x', courses: [] });
    expect(doc).toBeNull();
  });
});

describe('Open edX OLX export', () => {
  const { courses, labs } = repoContent();

  it('maps lessons to sections and lab quizzes to graded problems', () => {
    const files = courseToOlx(courses.get('linux-foundations'), labs, { labBaseUrl: 'https://labs.example.org' });
    expect(files.get('course.xml')).toBe('<course url_name="self_paced" org="CodeCloud" course="linux-foundations"/>\n');
    expect(files.get('course/self_paced.xml')).toContain('<chapter url_name="shell-and-filesystem"/>');
    expect(files.get('chapter/shell-and-filesystem.xml')).toContain('<sequential url_name="shell-and-filesystem-lab"/>');
    const problem = files.get('problem/shell-and-filesystem-lab-q1.xml');
    expect(problem).toContain('<choice correct="true">pwd</choice>');
    expect(problem).toContain('<code>pwd</code> prints the working directory.');
    expect(files.get('html/shell-and-filesystem-lab.html')).toContain('https://labs.example.org/#/labs/linux-files');
    for (const [file, body] of files) {
      if (file.endsWith('.json')) JSON.parse(body);
    }
  });

  it('exports every course as an importable archive', async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'olx-'));
    for (const course of courses.values()) {
      const archive = await writeOlxArchive(course, labs, out, {});
      const entries = [];
      await tar.list({ file: archive, onReadEntry: (e) => entries.push(e.path) });
      expect(entries).toContain('course/course.xml');
      expect(entries).toContain('course/course/self_paced.xml');
    }
    expect(fs.readdirSync(out).filter((f) => f.endsWith('.tar.gz'))).toHaveLength(courses.size);
  });
});
