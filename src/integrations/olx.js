import fs from 'node:fs';
import path from 'node:path';
import * as tar from 'tar';

const RUN = 'self_paced';

const xml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

// Escapes text for XML and turns `code` spans into <code> elements.
const inline = (text) => xml(text).replace(/`([^`]+)`/g, '<code>$1</code>');

/**
 * Renders one CodeCloud course as an Open edX course in OLX (Open Learning XML), the format
 * Studio imports. Each lesson becomes a section; a lesson's lab becomes a subsection with the
 * lab's multiple-choice tasks as native edX problems and a link to the hands-on environment.
 * Returns a map of relative path → file contents.
 */
export function courseToOlx(course, labs, { org = 'CodeCloud', labBaseUrl, start = '2026-01-01T00:00:00Z' }) {
  const files = new Map();
  const add = (file, body) => files.set(file, body);
  const chapters = [];

  add('course.xml', `<course url_name="${RUN}" org="${xml(org)}" course="${xml(course.id)}"/>\n`);
  add('about/overview.html', `<section class="about"><h2>About This Course</h2><p>${xml(course.description)}</p></section>\n`);
  add('about/short_description.html', `${xml(course.description)}\n`);
  if (course.duration_hours) add('about/effort.html', `${course.duration_hours}:00\n`);

  for (const lesson of course.lessons) {
    const sequentials = [];

    const readId = `${lesson.id}-read`;
    add(`html/${readId}.xml`, `<html filename="${readId}" display_name="${xml(lesson.title)}"/>\n`);
    add(`html/${readId}.html`, lesson.html);
    add(`vertical/${readId}.xml`, `<vertical display_name="${xml(lesson.title)}">\n  <html url_name="${readId}"/>\n</vertical>\n`);
    add(`sequential/${readId}.xml`, `<sequential display_name="Lesson">\n  <vertical url_name="${readId}"/>\n</sequential>\n`);
    sequentials.push(readId);

    const lab = lesson.lab && labs.get(lesson.lab);
    if (lab) {
      const labId = `${lesson.id}-lab`;
      const components = [];
      const practical = lab.tasks.filter((t) => t.type === 'task');
      const intro = [
        `<h2>${xml(lab.title)}</h2>`,
        lab.description_html,
        labBaseUrl
          ? `<p><a href="${xml(`${labBaseUrl.replace(/\/+$/, '')}/#/labs/${lab.id}`)}" target="_blank" rel="noopener">Open the hands-on lab in CodeCloud ↗</a> — you get a private environment for ${lab.duration_minutes} minutes and every task is checked automatically.</p>`
          : `<p>Run the <code>${xml(lab.id)}</code> lab on your CodeCloud instance.</p>`,
        practical.length ? `<h3>Tasks you will complete</h3><ol>${practical.map((t) => `<li>${t.prompt_html}</li>`).join('')}</ol>` : '',
      ].join('\n');
      add(`html/${labId}.xml`, `<html filename="${labId}" display_name="Hands-on lab"/>\n`);
      add(`html/${labId}.html`, `${intro}\n`);
      components.push(`  <html url_name="${labId}"/>`);

      lab.tasks
        .filter((t) => t.type === 'quiz')
        .forEach((task, index) => {
          const problemId = `${labId}-q${index + 1}`;
          const choices = task.options
            .map((option, i) => `        <choice correct="${i === task.answer}">${inline(option)}</choice>`)
            .join('\n');
          const solution = task.explanation
            ? `  <solution>\n    <div class="detailed-solution"><p>${inline(task.explanation)}</p></div>\n  </solution>\n`
            : '';
          add(
            `problem/${problemId}.xml`,
            `<problem display_name="Check your understanding ${index + 1}" markdown="null" showanswer="attempted" weight="1">\n` +
              `  <multiplechoiceresponse>\n    <label>${inline(task.prompt)}</label>\n    <choicegroup type="MultipleChoice">\n${choices}\n    </choicegroup>\n  </multiplechoiceresponse>\n${solution}</problem>\n`,
          );
          components.push(`  <problem url_name="${problemId}"/>`);
        });

      add(`vertical/${labId}.xml`, `<vertical display_name="${xml(lab.title)}">\n${components.join('\n')}\n</vertical>\n`);
      add(`sequential/${labId}.xml`, `<sequential display_name="Hands-on lab" graded="true" format="Lab">\n  <vertical url_name="${labId}"/>\n</sequential>\n`);
      sequentials.push(labId);
    }

    add(
      `chapter/${lesson.id}.xml`,
      `<chapter display_name="${xml(lesson.title)}">\n${sequentials.map((s) => `  <sequential url_name="${s}"/>`).join('\n')}\n</chapter>\n`,
    );
    chapters.push(lesson.id);
  }

  add(
    `course/${RUN}.xml`,
    `<course display_name="${xml(course.title)}" language="en" self_paced="true" start="${start}">\n${chapters.map((c) => `  <chapter url_name="${c}"/>`).join('\n')}\n</course>\n`,
  );
  add(`policies/${RUN}/policy.json`, `${JSON.stringify({ [`course/${RUN}`]: { display_name: course.title, self_paced: true, start } }, null, 2)}\n`);
  add(
    `policies/${RUN}/grading_policy.json`,
    `${JSON.stringify({ GRADER: [{ type: 'Lab', short_label: 'Lab', min_count: 0, drop_count: 0, weight: 1.0 }], GRADE_CUTOFFS: { Pass: 0.5 } }, null, 2)}\n`,
  );
  add('policies/assets.json', '{}\n');
  return files;
}

/** Writes `<outDir>/<course-id>.tar.gz` (top-level folder `course/`, as Studio's importer expects). */
export async function writeOlxArchive(course, labs, outDir, options) {
  const staging = fs.mkdtempSync(path.join(outDir, `.${course.id}-`));
  try {
    for (const [file, body] of courseToOlx(course, labs, options)) {
      const target = path.join(staging, 'course', file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, body);
    }
    const archive = path.join(outDir, `${course.id}.tar.gz`);
    await tar.create({ gzip: true, file: archive, cwd: staging, portable: true }, ['course']);
    return archive;
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}
