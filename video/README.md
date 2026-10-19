# Launch video

`docs/assets/codecloud-demo.mp4` is built with the [/brag](https://github.com/latent-spaces/brag)
workflow, here the `/brag-slim` variant, which builds the video with the tools already on the
machine instead of Hyperframes:

| /brag step | Here |
|---|---|
| 1. Inspect | `capture.mjs` drives a **running CodeCloud server** with Playwright and records every flow as timestamped Chrome screencast frames. That covers the catalog, learning paths, lessons and real Linux, Docker and Kubernetes lab sessions, with typing, *Check*, quizzes, hints, solutions, extend and end. `collect-data.mjs` reads the counts, course titles, workflows, a real `test-lab` run and a real Open edX export from the repository. |
| 2. Plan | [`brag-plan.md`](brag-plan.md): rubric, angle, storyboard, sound and poster |
| 3. Build, check, render | `compose/` draws each frame as a pure function of time. `render.mjs` saves review stills of every scene and transition, then renders 1920×1080 at 30 fps through FFmpeg. `music.mjs` synthesizes the soundtrack in the video's key, and FFmpeg normalizes it to −16 LUFS. |
| 4. Deliver | the poster is baked in as frame 0; `brag.mp4`, `brag.jpg` and `share-copy.txt` land in `brag-output/` |

Nothing on screen is mocked. Footage comes from real sessions, and every number, title and log
line comes from the repository. Fast-forwarded footage, such as a cluster booting, carries a
visible speed badge.

```bash
npm start &                                   # CodeCloud with Docker available
BASE_URL=http://localhost:8080 npm run video  # → brag-output/brag.mp4
npm run video -- --publish                    # also update docs/assets/ for the README
```

In CI, run the **Launch video** workflow (`.github/workflows/video.yml`). It does all of the
above on a GitHub runner and opens a pull request with the new video.

The video is about 75 seconds long. /brag normally aims for 15–25 s, but this one was asked to
cover the project's whole functionality, so each scene stays short and shows one idea.
