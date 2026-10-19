# /brag plan — CodeCloud launch video

Made with the [/brag](https://github.com/latent-spaces/brag) workflow (`/brag-slim` variant):
inspect → plan → build, check, render → deliver. The video is built entirely from the running
product. `video/capture.mjs` records real sessions against a live CodeCloud server with real lab
containers, and `video/compose/` animates those recordings frame by frame.

## Inspect: the rubric

| Question | Answer |
|---|---|
| What is it? | An open-source, self-hosted platform for learning DevOps by doing: courses with labs that run on real, disposable machines in the browser and grade themselves. |
| Who is it for? | Learners preparing for DevOps / Kubernetes work, and the teams and educators who want KodeKloud-style labs on their own infrastructure. |
| What does it do for them? | Opens a private Linux box, Docker engine or Kubernetes cluster in one click. *Check* inspects the machine's real state, so learners know when they got it right. |
| What sets it apart? | Real machines, not simulators. Fully open source (AGPL), with content as code: YAML labs and Markdown lessons. edX courses come in, Open edX exports go out. CI smoke-tests every lab nightly. |
| Most impressive claim | 20 courses, 21 auto-graded labs, 3 playgrounds and 4 learning paths. Every lab is booted and solved by CI every night. |
| Visual hook | A real terminal: `kubectl get nodes` → `Ready`, then the task card turns green. |
| Real UI to show | Catalog → learning path → lesson → *Start lab* → terminal + task panel → *Check* → Docker and Kubernetes labs → playgrounds → edX → GitHub workflows → self-host. |
| Tone | `app-store` crossed with `polished`: clean feature cards, confident, no jokes forced. |
| Share caption | See `share-copy.txt`. |

No personal data appears. The demo account is a throwaway `learner`, and the lab containers are
created during capture and destroyed afterwards.

## Angle

**"Learn DevOps on real machines — and own the whole platform."** Open on the payoff (a real
cluster answering and a task turning green), then show that everything around it is real and
open: the catalog, the labs, the grading, and the automation that keeps it working.

## Visual identity (from `public/styles.css`)

* Background `#f6f7f9`, surface `#ffffff`, text `#1c2330`, muted `#5d6879`
* Accent `#2563eb`, success `#15803d`, terminal black `#000000`
* Type: Inter (UI), JetBrains Mono (terminal and code). Both are OFL, from `@fontsource`.
* Product footage sits in a browser-window frame with the real route in the address bar.

## Duration

**About 70 seconds.** /brag normally aims for 15–25 s. The brief for this video was to show the
project's *whole* functionality, so every scene stays short (3–7 s) with one idea each.

## Storyboard

| # | Scene | Source | ~Dur | On screen |
|---|---|---|---|---|
| 1 | Hook | `lab-k8s` capture | 4.5s | Terminal runs `kubectl get nodes` → **Ready**. Caption: "A real Kubernetes cluster. In your browser." |
| 2 | Reveal | data | 4s | Wordmark **CodeCloud**, "Open-source, hands-on DevOps labs", counters 20 courses · 21 labs · 3 playgrounds · 4 paths |
| 3 | Catalog | `catalog` capture | 6.5s | Catalog with learning paths, topic filter → Kubernetes, search "helm". Caption: "A full catalog, from Linux to Kubernetes" |
| 4 | Paths & lessons | `learn` capture | 5.5s | Kubernetes Administrator path → course → lesson. Caption: "Learning paths and short lessons" |
| 5 | Start a lab | `lab-linux` capture, sped up | 4s | *Preparing your lab environment…* fast-forwarded with a "12× — booting a real container" badge, then the split view |
| 6 | Do the work | `lab-linux` | 7s | Typing in the terminal (`mkdir`, `echo`, `cat`). Caption: "Your own root shell" |
| 7 | Auto-grading | `lab-linux` | 6s | *Check* turns tasks green, a quiz is answered, hint and solution revealed. Caption: "Checked against the machine's real state" |
| 8 | Docker | `lab-docker` | 5s | `docker run … nginx:alpine`, *Check* passes. Caption: "Real Docker" |
| 9 | Kubernetes | `lab-k8s` | 5s | `kubectl create deployment …`, *Check* passes. Caption: "Real Kubernetes (k3s)" |
| 10 | Playgrounds | `explore` capture | 4s | Playgrounds and labs grids. Caption: "Playgrounds for free-form practice" |
| 11 | Breadth | data | 4.5s | Every course title cascades in a grid by category |
| 12 | edX | data + `explore` | 5s | edX courses beside CodeCloud ones (from the weekly sync), plus "Export to Open edX": the real OLX file tree |
| 13 | Automation | data | 6s | Real workflow cards with their crons, and real `test-lab --solve` ✓ lines. Caption: "CI boots and solves every lab, every night" |
| 14 | Outro | data | 4.5s | `docker compose up -d`, repository URL, "Open source · AGPL-3.0" |

Transitions dip through the background (old out, then new in), so busy layouts never
cross-fade into each other.

## Sound

The soundtrack is synthesized for this video (`video/music.mjs`), not taken from a library. It
is a 112 BPM progression in C major (C–G–Am–F) with a soft pad, a plucked bass and a light beat.
Scene changes get soft pentatonic chimes in the same key, mixed under the music, and the whole
mix is normalized to −16 LUFS.

## Poster

The poster is a settled frame of scene 7, with tasks green next to the terminal. It is baked in
as frame 0 of the MP4.
