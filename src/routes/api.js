import { publicLab } from '../content/loader.js';
import { LabError } from '../labs/service.js';

function requireUser(request, reply, done) {
  if (!request.session.get('user')) {
    reply.code(401).send({ error: 'sign in first' });
    return;
  }
  done();
}

const userId = (request) => request.session.get('user').id;

export async function apiRoutes(app, { auth, labs, content, config }) {
  app.setErrorHandler((err, request, reply) => {
    if (err instanceof LabError) return reply.code(err.statusCode).send({ error: err.message });
    if (err.validation) return reply.code(400).send({ error: err.message });
    request.log.error(err);
    return reply.code(err.statusCode ?? 500).send({ error: err.statusCode ? err.message : 'internal error' });
  });

  const credentials = {
    body: {
      type: 'object',
      required: ['username', 'password'],
      properties: { username: { type: 'string' }, password: { type: 'string' } },
    },
  };

  app.post('/auth/register', { schema: credentials }, async (request, reply) => {
    if (!config.allowRegistration) return reply.code(403).send({ error: 'registration is disabled' });
    const result = await auth.register(request.body.username, request.body.password);
    if (result.error) return reply.code(400).send({ error: result.error });
    await request.session.regenerate();
    request.session.set('user', result.user);
    return { user: result.user };
  });

  app.post('/auth/login', { schema: credentials }, async (request, reply) => {
    const result = await auth.login(request.body.username, request.body.password);
    if (result.error) return reply.code(401).send({ error: result.error });
    await request.session.regenerate();
    request.session.set('user', result.user);
    return { user: result.user };
  });

  app.post('/auth/logout', async (request) => {
    await request.session.destroy();
    return { ok: true };
  });

  app.get('/me', async (request) => ({ user: request.session.get('user') ?? null }));

  const courseSummary = (c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    level: c.level,
    category: c.category,
    tags: c.tags,
    duration_hours: c.duration_hours ?? null,
    lesson_count: c.lessons.length,
    lab_count: c.lessons.filter((l) => l.lab).length,
  });

  // Catalog order: category order from catalog.yaml, then beginner → advanced, then title.
  const levels = ['beginner', 'intermediate', 'advanced'];
  const categoryOrder = content.catalog.categories.map((c) => c.id);
  const orderedCourses = [...content.courses.values()].sort(
    (a, b) =>
      categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) ||
      levels.indexOf(a.level) - levels.indexOf(b.level) ||
      a.title.localeCompare(b.title),
  );

  app.get('/courses', async () => ({ courses: orderedCourses.map(courseSummary) }));

  // Everything the catalog page needs in one request: native courses, learning paths and
  // courses synced from edX (see scripts/sync-edx.js).
  app.get('/catalog', async () => ({
    categories: content.catalog.categories,
    paths: content.catalog.paths,
    courses: orderedCourses.map(courseSummary),
    external: content.external,
  }));

  app.get('/courses/:courseId', async (request, reply) => {
    const course = content.courses.get(request.params.courseId);
    if (!course) return reply.code(404).send({ error: 'unknown course' });
    return {
      course: {
        ...course,
        lessons: course.lessons.map(({ id, title, lab }) => ({ id, title, lab })),
      },
    };
  });

  app.get('/courses/:courseId/lessons/:lessonId', async (request, reply) => {
    const lesson = content.courses.get(request.params.courseId)?.lessons.find((l) => l.id === request.params.lessonId);
    if (!lesson) return reply.code(404).send({ error: 'unknown lesson' });
    return { lesson: { id: lesson.id, title: lesson.title, lab: lesson.lab, html: lesson.html } };
  });

  app.post('/courses/:courseId/lessons/:lessonId/complete', { preHandler: requireUser }, async (request) => {
    labs.completeLesson(userId(request), request.params.courseId, request.params.lessonId);
    return { ok: true };
  });

  app.get('/labs', async () => ({ labs: [...content.labs.values()].map(publicLab) }));

  app.get('/labs/:labId', async (request, reply) => {
    const lab = content.labs.get(request.params.labId);
    if (!lab) return reply.code(404).send({ error: 'unknown lab' });
    return { lab: publicLab(lab) };
  });

  app.post('/labs/:labId/sessions', { preHandler: requireUser }, async (request, reply) => {
    reply.code(202);
    return { session: labs.startLab(userId(request), request.params.labId) };
  });

  app.get('/lab-sessions', { preHandler: requireUser }, async (request) => ({
    sessions: labs.listSessions(userId(request)),
  }));

  app.get('/lab-sessions/:sessionId', { preHandler: requireUser }, async (request) => ({
    session: labs.getSession(userId(request), request.params.sessionId),
  }));

  app.delete('/lab-sessions/:sessionId', { preHandler: requireUser }, async (request) => ({
    session: await labs.stopSession(userId(request), request.params.sessionId),
  }));

  app.post('/lab-sessions/:sessionId/extend', { preHandler: requireUser }, async (request) => ({
    session: labs.extendSession(userId(request), request.params.sessionId),
  }));

  app.post(
    '/lab-sessions/:sessionId/tasks/:taskId/check',
    {
      preHandler: requireUser,
      schema: { body: { type: ['object', 'null'], properties: { answer: { type: 'integer' } } } },
    },
    async (request) =>
      labs.checkTask(userId(request), request.params.sessionId, request.params.taskId, request.body?.answer),
  );

  app.get('/lab-sessions/:sessionId/tasks/:taskId/solution', { preHandler: requireUser }, async (request) =>
    labs.solution(userId(request), request.params.sessionId, request.params.taskId),
  );

  app.get('/progress', { preHandler: requireUser }, async (request) => labs.progress(userId(request)));
}
