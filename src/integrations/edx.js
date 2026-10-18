import { externalCatalogSchema } from '../content/schema.js';

const USER_AGENT = 'CodeCloud-catalog-sync (+https://github.com/rajasekharponakala/codecloud)';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Compiles category keywords into whole-word, case-insensitive matchers. */
export function compileCategories(categories) {
  return categories.map(({ id, keywords }) => ({
    id,
    pattern: new RegExp(`(^|[^a-z0-9])(${keywords.map(escapeRegex).join('|')})(?=$|[^a-z0-9])`, 'i'),
  }));
}

export function categorize(course, matchers) {
  const text = `${course.name ?? ''} ${course.short_description ?? ''}`;
  return matchers.find((m) => m.pattern.test(text))?.id ?? null;
}

function absolute(base, uri) {
  if (!uri) return null;
  try {
    const url = new URL(uri, base);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Fetches every public course from an Open edX instance's Course API, following pagination.
 * Responses look like { results: [...], pagination: { next, count, num_pages } }.
 */
export async function fetchCourses(baseUrl, { fetchImpl = fetch, pageSize = 100, maxPages = 500, delayMs = 250, log = () => {} } = {}) {
  const courses = [];
  let url = new URL('/api/courses/v1/courses/', baseUrl);
  url.searchParams.set('page_size', String(pageSize));
  url.searchParams.set('active_only', 'true');
  for (let page = 1; url && page <= maxPages; page += 1) {
    const res = await fetchWithRetry(url, fetchImpl);
    const body = await res.json();
    courses.push(...(body.results ?? []));
    log(`${baseUrl}: page ${page}${body.pagination?.num_pages ? `/${body.pagination.num_pages}` : ''}, ${courses.length} courses`);
    const next = body.pagination?.next ?? body.next ?? null;
    url = next ? new URL(next, baseUrl) : null;
    if (url && delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return courses;
}

async function fetchWithRetry(url, fetchImpl, attempts = 4) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const res = await fetchImpl(url, { headers: { accept: 'application/json', 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(30_000) });
      if (res.ok) return res;
      lastError = new Error(`GET ${url} → ${res.status}`);
      if (res.status < 500 && res.status !== 429) break;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
  }
  throw lastError;
}

/**
 * Turns raw Course API records into catalog entries: drops hidden, invitation-only and ended
 * courses, assigns categories, links related CodeCloud labs, and keeps the newest
 * `maxPerCategory` per category. Output is sorted so unchanged data produces identical files.
 */
export function buildEntries(raw, { provider, baseUrl, categories, maxPerCategory, labsByCategory, now = new Date() }) {
  const matchers = compileCategories(categories);
  const seen = new Set();
  const byCategory = new Map();
  for (const course of raw) {
    const id = course.course_id ?? course.id;
    if (!id || seen.has(id) || course.hidden || course.invitation_only) continue;
    if (course.end && new Date(course.end) < now) continue;
    const category = categorize(course, matchers);
    if (!category) continue;
    seen.add(id);
    const entry = {
      id: `${provider}:${id}`,
      provider,
      title: course.name.trim(),
      org: course.org ?? '',
      number: course.number ?? '',
      short_description: (course.short_description ?? '').trim(),
      url: new URL(`/courses/${encodeURIComponent(id)}/about`, baseUrl).href,
      image: absolute(baseUrl, course.media?.image?.small ?? course.media?.course_image?.uri),
      start: course.start ?? null,
      end: course.end ?? null,
      pacing: course.pacing ?? null,
      effort: course.effort || null,
      category,
      related_labs: (labsByCategory.get(category) ?? []).slice(0, 3),
    };
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(entry);
  }
  const order = categories.map((c) => c.id);
  return [...byCategory.entries()]
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .flatMap(([, entries]) =>
      entries
        .sort((a, b) => (b.start ?? '').localeCompare(a.start ?? '') || a.id.localeCompare(b.id))
        .slice(0, maxPerCategory),
    );
}

/** Labs attached to native courses, grouped by the course category, in catalog order. */
export function labsByCategory(content) {
  const map = new Map();
  for (const course of content.courses.values()) {
    for (const lesson of course.lessons) {
      if (!lesson.lab) continue;
      const labs = map.get(course.category) ?? [];
      if (!labs.includes(lesson.lab)) labs.push(lesson.lab);
      map.set(course.category, labs);
    }
  }
  return map;
}

/**
 * Builds the external catalog document. Returns null when the course list is unchanged from
 * `previous`, so scheduled runs do not churn the file (and open no pull request).
 */
export function catalogDocument(courses, previous, now = new Date()) {
  if (previous && JSON.stringify(previous.courses) === JSON.stringify(courses)) return null;
  return externalCatalogSchema.parse({ generated_at: now.toISOString(), courses });
}
