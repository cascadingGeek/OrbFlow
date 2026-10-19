# OrbFlow: Social Media Content Plan

Prepared as social media manager for **@cascadingGeek** · Channels: X, Threads, Instagram, WhatsApp, Dev.to, daily.dev
Plan window: two weeks starting the week of 2026-10-13 · Posting cadence: 2 to 3 meaningful posts per week

> Anything in `[BRACKETS]` is a fact only you know. Fill it in before posting. Do not post with brackets left in.

---

## 1. What OrbFlow is (as read from the repo)

**One line:** a physics-based bubble (orb) chart library on canvas, with zero runtime dependencies.

| Fact | Source |
| --- | --- |
| Vanilla JS class `OrbChart` plus a React component at `orbflow/react` | `app/core/`, `app/react/` |
| Own physics engine: spatial-grid collision detection, damping, wall bounces, brownian drift, click repulsion | `app/core/physics.ts` |
| Canvas renderer: glassy orbs, images inside orbs, tooltips, hover and click callbacks | `app/renderer/CanvasRenderer.ts` |
| No D3, no Chart.js. Zero runtime `dependencies`; React is an optional peer (18 or 19) | `package.json` |
| Ships ESM, CJS, types, and a CDN build exposing `window.OrbFlow` | `tsdown.config.ts` |
| Size budgets enforced in CI: core 8 kB, react 9 kB, cdn 8 kB (gzip) | `.size-limit.json` |
| Package guarded by publint, attw, a dist verifier, and smoke tests in 3 consumer fixtures | `scripts/`, `test/consumers/` |
| Roadmap: Vue (1.1), Svelte (1.2), Angular (1.3), one per minor release | `docs/scope/scope.md` |

**Origin story (your Threads post, 01/03/26):** a crypto-market bubble visualization inspired by cryptobubbles.net, built from scratch with no chart libraries. Tagline: *"This is how users feel the market, not just read it."* That post got 1 like and no replies, so treat it as a quiet seed, not an announcement. The next post should be the first real introduction.

### Where the project honestly stands (do not oversell)

Per `docs/scope/scope.md`, as of 2026-10-13:

- **Done:** trim to vanilla + React, lint/format/test/CI tooling, package build and exports (tsdown), size budgets, consumer smoke tests, a tooltip and image-loading fix (PR #3).
- **Not done:** production-ready lifecycle (`destroy()` leaves listeners attached, `setData` reshuffles every orb, no touch support), production-ready React component, accessibility and reduced motion, performance and idle behavior, README rewrite, runnable examples, **live demo page**, release pipeline.
- **Not on npm yet.** Scope row 11 ("`orbflow@1.0.0` is on npm") is still planned. Do not tell anyone to `npm install orbflow` until it is true.
- **README drifts from the code.** README says `maxRadius` 200 and `damping` 0.995; code uses 80 and 0.95. Fix before sending anyone to the README.

This is a strength for social content: "building in public, here is what works and what is still broken" is exactly the angle that builds trust. The rules below keep it truthful.

---

## 2. What should you post first?

**Post the comeback story, with a demo clip attached.** That is plan item 01 and it is the right call for three reasons:

1. Your Threads post introduced the *idea* (crypto bubbles). Nobody has yet heard *why OrbFlow is now a library*, why it went quiet, or why it is back.
2. It gives every later post context, so the engineering posts land as chapters of one story instead of random drops.
3. It needs no unfinished feature. A screen recording of the bubbles moving is enough, and it is the one thing that already works.

**Do not** lead with "OrbFlow 1.0 is live" or an install command. Neither is true yet.

**The asset to make first (do this before any post):** a 10 to 15 second screen recording, dark background, 6 to 10 colorful orbs drifting, one hover tooltip, one click that pushes nearby orbs away. Export 1080x1350 (4:5) for Instagram and Threads, and a 16:9 crop for X and blogs. Everything below reuses this clip.

---

## 3. Voice and ground rules

- **Voice:** a developer talking to developers. First person, plain words, specific numbers, small honest admissions. No "game-changing", no "revolutionary", no "excited to announce".
- **Claim rule:** only claim what the repo proves. "Zero runtime dependencies", "8 kB gzip budget", "spatial grid collision" are provable. "Smooth at 1,000 orbs" is not, until you measure it (scope row 7).
- **Show, don't tell:** every post carries a clip, GIF, or code image.
- **One idea per post.** If it needs "also", it is two posts.
- **Reply within the first hour** of each post. That matters more than the post itself.
- **Hashtags:** 3 to 5 max on Threads/X; up to 10 on Instagram (in the first comment).
  Core set: `#javascript #typescript #frontend #opensource #buildinpublic #dataviz #reactjs #canvas`
- **Link policy:** repo link in the post body on X/Threads is fine now; add the npm link only after publish; add the demo link only after row 10 ships.

---

## 4. Two-week calendar

| # | Day | Post | Channels | Goal |
| --- | --- | --- | --- | --- |
| 01 | Week 1, Tue | The comeback story + demo clip | X, Threads, Instagram, WhatsApp status | Explain what and why |
| 02 | Week 1, Thu | Engineering breakdown: how a bubble moves and collides | X thread, Threads, Dev.to article, daily.dev | Show depth |
| 03 | Week 2, Tue | A problem solved: the tooltip/image bug, plus the collision blind spot I found | X, Threads, Instagram carousel | Show how you think |
| 04 | Week 2, Thu | Public progress update | X, Threads, WhatsApp, Dev.to short | Build trust |
| opt | Week 2, Sat | Low-effort bonus: "drag-free bubbles" loop clip, no text | Instagram Reel, Threads | Reach |

Week 1 Wed/Fri and Week 2 Wed/Fri are reply days. Do not fill them with extra posts.

---

## 5. Post 01: The comeback story (Week 1, Tue)

**Audience:** devs who may have seen your earlier Threads post, plus general frontend followers.
**Asset:** the demo clip, plus a second clip or screenshot of the original crypto-bubbles version if you still have it ("then vs now").

### X (single post, under 280 characters)

```
I built a bubble chart from scratch earlier this year. Then a full-time job ate my evenings and I paused it.

I'm back. It's now OrbFlow: physics-based orbs on canvas, zero dependencies, vanilla JS + React.

Building it in public. Demo below.
```

### X (follow-up reply in thread)

```
Why from scratch? I wanted markets to feel alive, not just be read.

No D3, no Chart.js. Just canvas, a small physics loop, and a lot of tuning until bubbles felt like bubbles.

Repo: [GITHUB LINK]
```

### Threads (can be longer and more personal)

```
Earlier this year I posted a crypto bubbles experiment. 1 like. I loved it anyway.

Then I started a full-time job and the project sat untouched for [N] months. [ONE HONEST SENTENCE: what actually made you stop, e.g. "No energy left after work."]

What changed: [ONE HONEST SENTENCE: why you came back].

So I rebuilt it as a real library. OrbFlow:
• physics-based orbs on canvas
• zero runtime dependencies
• vanilla JS and React (Vue, Svelte, Angular later)

It's not on npm yet and some parts are still rough. I'll share what works and what doesn't as I go.

Clip below 👇
#buildinpublic #javascript #frontend
```

### Instagram (caption for the Reel or 4:5 video)

```
Paused this project for months because of a full-time job. Back now.

OrbFlow: bubbles with real physics, drawn on canvas, zero dependencies. Built from scratch, no chart libraries.

Not shipped yet. I'm building it in public, one post at a time.

Follow along if you like seeing a thing get built.

(first comment)
#javascript #typescript #frontend #webdev #buildinpublic #opensource #dataviz #reactjs #canvas #devlife
```

### WhatsApp (status + message for dev groups/friends; short, no hashtags)

```
Hey, been quiet on OrbFlow (my bubble chart library) because of work. I'm back on it now and posting progress publicly. Here's a 12 second clip of where it is. If you have 30 seconds, tell me one thing you'd want a bubble chart to do. 🫧
```

> WhatsApp rule: only send to people and groups that opted in. A feedback question outperforms a link here.

---

## 6. Post 02: Engineering breakdown (Week 1, Thu)

**Goal:** show you can reason about performance and feel, not just make it pretty.
**Topic:** how one orb moves each frame, and one trade-off you made on purpose.
**Everything below comes from `app/core/physics.ts` and `OrbChart.ts`.**

### The material

Each frame, for each orb:

1. Nudge velocity with tiny random noise (±0.01) so bubbles never sit perfectly still: brownian-style drift.
2. Move by velocity; apply damping (0.95 default) only when it is above a minimum velocity.
3. Cap speed at 2 px/frame so one hard click can't launch an orb into chaos.
4. Bounce off walls with a bounce coefficient (0.6) *plus* a 0.5 push away from the wall, so orbs don't glue to edges.
5. Collisions: a **spatial grid** (100 px cells) so each orb only checks neighbors in the 3x3 cells around it instead of every other orb. That drops the pair check from all-pairs toward roughly linear for evenly spread orbs.
6. Resolve overlap by moving each orb half the overlap apart, then a *gentle* push of 0.3 instead of a full elastic collision.

**The trade-off to explain:** realistic elastic collisions vs a soft push. Full collision response made the orbs ping-pong and feel like billiard balls. A soft push plus capped speed makes them feel like floating bubbles. You gave up physical accuracy to get the *feel* the library is named for.

Radius sizing: value is normalized between the dataset's min and max, then mapped linearly into `minRadius..maxRadius`. Trade-off worth mentioning: radius is linear in value, not area. [DECIDE: say whether you consider this a known limitation. Area-proportional sizing is the more honest visual encoding.]

### X thread (5 posts)

```
1/ How does one bubble move in OrbFlow? No physics library. Here is the whole loop. 🧵
[CLIP]
```
```
2/ Every frame, each orb gets a tiny random nudge, so nothing ever sits perfectly still. Then it moves, and damping bleeds off speed.

Speed is capped at 2px/frame. Without the cap, one click could launch a bubble across the canvas.
```
```
3/ Collisions: checking every orb against every other orb gets slow fast.

So orbs go into a spatial grid (100px cells). Each one only checks the 3x3 cells around it.
[IMAGE: grid overlay diagram]
```
```
4/ The trade-off: I did NOT use real elastic collisions.

They made orbs ping-pong like billiard balls. Instead, overlaps are pushed apart by half each, plus a gentle 0.3 nudge.

Less accurate. Much more bubble-like.
```
```
5/ Lesson: "correct physics" and "feels right" are different goals. For a visualization, feel wins.

Next post: a real bug I found in my own collision code. Repo: [GITHUB LINK]
```

### Threads

Post the thread as one longer post using beats 2, 3, and 4, with the clip. End with: *"What would you have sacrificed first: accuracy or feel?"* (Questions drive replies on Threads.)

### Dev.to article (publish same day)

- **Title:** `Building a bubble chart with real physics and zero dependencies`
- **Tags:** `javascript, typescript, webdev, opensource` (Dev.to allows 4)
- **Cover:** the demo clip's first frame with a grid overlay.
- **Outline:**
  1. The goal: bubbles that feel alive (include the clip).
  2. The frame loop in ~20 lines of code (paste a trimmed `updatePosition`).
  3. Why a spatial grid (show the 3x3 neighbor lookup).
  4. Why soft collisions beat accurate ones.
  5. Sizing: min/max normalization into a radius range.
  6. What I'd change (see Post 03: be honest, link forward).
  7. Repo link and a question to readers.
- **Length:** 700 to 1,000 words. Canonical URL: your own blog if you have one, otherwise leave blank.

### daily.dev

Submit the Dev.to article by URL via the "Submit a link" flow on daily.dev, and share it to your squad if you have one. Do not rewrite content for daily.dev; it indexes the article. A strong cover image and a title under 70 characters improve pickup.

---

## 7. Post 03: A problem you solved (Week 2, Tue)

**Goal:** show how you debug and decide when things get difficult.
Pick **one** of the two stories below. Story A is already fixed and safe to claim. Story B is a real finding in the current code that you should confirm yourself before posting.

### Story A (safe): "The tooltip and the image that wasn't there"

Evidence: commit `8a3ec4d fix(renderer): skip unloaded images and render tooltip text safely`, merged as PR #3.

Orbs can show an image. If the draw call runs before the image finishes loading, canvas throws or draws garbage. Tooltips show user-supplied labels, so they must never be rendered as markup. The fix: skip images that haven't loaded and render tooltip text as plain text.

**X / Threads draft:**
```
Real bug from this week: OrbFlow draws images inside bubbles.

Problem: the render loop ran before some images had loaded. [WHAT ACTUALLY HAPPENED: error, flicker, blank orb?]

Fix: skip unloaded images until ready, and render tooltip labels as plain text so user data can never become markup.

Two small changes. Both would have bitten a real user.
```

### Story B (confirm first): "My collision grid has a blind spot"

Reading `physics.ts`: grid cells are 100 px and each orb checks the 3x3 neighborhood. But `maxRadius` defaults to 80, so two large orbs can touch while their centers are up to 160 px apart. That can be more than one cell away. Overlapping pairs might not be detected.

**Before posting this, reproduce it:** put two max-radius orbs 150 px apart and see if they overlap without resolving. If it reproduces, fix it (for example, set cell size to the largest diameter) and post the whole arc: found it, reproduced it, fixed it, added a test. That is the strongest "how I think" post available. If it does not reproduce, post Story A instead.

Other things you can mention in the same breath, since they are in the code: each pair is processed twice per frame (once from each orb's side), and the grid is filled before orbs move. Whether those matter is your call after measuring.

**Instagram carousel (7 slides, 4:5, dark theme):**

1. Hook: "I found a bug in my own physics code."
2. The setup: 100 px grid, 3x3 neighbors.
3. The catch: orbs up to 80 px radius.
4. Diagram: two big orbs overlapping across cells.
5. The fix: [YOUR FIX] with 3 lines of code.
6. The test that now guards it.
7. Takeaway: "Defaults interact. Check the numbers against each other." + follow CTA.

Caption: one short paragraph plus the hashtag set in the first comment.

---

## 8. Post 04: Public progress update (Week 2, Thu)

**Goal:** build trust through visible progress. Use this template and fill with what is *true on the day*.

```
OrbFlow progress, week [N]

✅ Working
• physics + canvas renderer
• React component (orbflow/react)
• builds as ESM, CJS, and a CDN file; size budgets enforced in CI
• [ANYTHING NEW THIS FORTNIGHT]

🚧 Not done yet
• touch support
• destroy() cleanup (listeners still attached)
• accessibility + reduced motion
• live demo page

📚 Learned
• [ONE THING FROM FEEDBACK OR FROM POSTS 01 TO 03]

🎯 Next milestone
• [ONE THING, e.g. "production-ready lifecycle: setData keeps orbs in place and animates size changes"]

Not on npm yet. I'll say so loudly when it is.
```

Platforms: X (as a single post with line breaks), Threads (same), WhatsApp (as a plain-text message to your list), Dev.to (optional short post under the `#showdev` or `#buildinpublic` tag).

Strong closer for every platform: *"What would you want a bubble chart library to do that most don't?"*

---

## 9. Reusable snippets

### Bio lines

- **X / Threads (≤160 chars):** `Building OrbFlow: physics-based bubble charts on canvas. Zero deps. JS + React. In public. 🫧`
- **Instagram:** `Dev building OrbFlow 🫧 physics bubble charts, zero deps | JS + React | build in public`

### Pinned post (X and Threads): use Post 01 until the npm release, then replace

### Standard reply templates

| Situation | Reply |
| --- | --- |
| "Is it on npm?" | `Not yet. It's finishing lifecycle and accessibility work first. I'll post when it's live.` |
| "Why not D3?" | `D3 is great. I wanted a tiny, dependency-free core where the physics and rendering are one small thing.` |
| "How does it perform with N orbs?" | `Haven't measured a stable number yet; it's on the list. I'll publish real numbers, not guesses.` |
| "Does it work on mobile?" | `Resize works; touch tap support is on the roadmap, not done yet.` |
| "Vue / Svelte / Angular?" | `Planned as minor releases after 1.0: Vue 1.1, Svelte 1.2, Angular 1.3.` |
| Feature request | `Great idea, can you share the use case? Opening an issue helps me track it: [LINK]` |

### Comment-bait questions (use one per post, not all)

- Accuracy or feel: which would you sacrifice?
- What's the weirdest dataset you'd put in a bubble chart?
- Radius by value, or by area? Which would you trust?

---

## 10. Release-readiness gate (use before any "launch" post)

Your checklist, mapped to what the repo shows today, so you know what you can claim:

| Requirement | Status in repo | What you can say |
| --- | --- | --- |
| Core rendering and physics work reliably | Works, but lifecycle gaps (`destroy`, `setData` reshuffle) | "Works, hardening in progress" |
| Resizing, touch, tooltips, collisions, large datasets | Resize and tooltips yes; touch no; collision blind spot suspected; large datasets unmeasured | Don't claim touch or scale |
| All advertised adapters build and render | Vanilla + React only; Vue/Svelte/Angular are roadmap | Say "roadmap" for the rest |
| Correct TS declarations, exports, bundler compatibility | Yes: attw, publint, TS consumer fixtures | **Safe to claim** |
| Live demo, screenshots, interactive example | None yet (rows 9 and 10) | Use clips, not "try it live" |
| Packed npm artifact tested, clean install | Yes via `npm run smoke` (before publish) | **Safe to claim** |
| Limitations, accessibility, known issues documented | Not yet (rows 6 and 8) | Share known issues in progress posts |

**Launch day posts only after:** row 10 (demo URL) and row 11 (npm publish) are done. Prepare these two in advance:

- **Launch announcement (X/Threads):** `OrbFlow 1.0 is on npm. Physics-based bubble charts, zero deps, vanilla JS + React. Live demo: [URL] npm i orbflow`
- **Launch article (Dev.to → daily.dev):** `I built a physics bubble chart library with zero dependencies. Here's what it took.` Use the four posts above as its spine.

---

## 11. Metrics to watch (keep it small)

Per post, after 48 hours: replies (not likes), saves (Instagram), reposts, link clicks to the repo, new GitHub stars. Weekly: stars, followers gained, and the number of *conversations* started. If a post type gets replies, do more of it; if a post gets views but no replies, add a question next time.

## 12. Do / don't summary

- **Do** show the clip in every post, admit what's unfinished, reply fast, ask one question.
- **Don't** claim npm availability, mobile touch support, scale numbers, or a live demo before they exist. Don't post daily; two to three good posts a week is the plan.
