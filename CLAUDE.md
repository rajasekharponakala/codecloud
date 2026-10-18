# Working on CodeCloud

* Before writing any non-trivial new code, follow the FOSS Mind skill
  (https://gitlab.com/ranjithraj/foss-agent-skills/-/blob/main/foss-mind.md): look for a
  maintained open-source library first, use a thin documented wrapper for partial fits, and
  record the choice in `docs/foss-choices.md`.
* Plain ESM JavaScript on Node 22. No build step. The frontend is vanilla JS in `public/`.
* `npm test` must pass. Run `npm run test:docker` when touching `src/runtime/`.
* After changing or adding a lab, run `node src/cli.js test-lab <id> --solve`.
* Never send quiz answers, check scripts or solutions to the browser (`publicLab` in `src/content/loader.js`).
