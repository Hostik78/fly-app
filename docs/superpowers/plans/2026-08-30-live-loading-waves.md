# Live Loading Waves Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed loading video with a theme-aware, continuously animated WebGL wave splash that fades over ready app content.

**Architecture:** A focused `liveWaves` module owns deterministic theme and cover calculations. `LoadingScreen` owns WebGL setup, texture lifecycle, animation, reduced-motion fallback, and the exit transition. `App` keeps the splash mounted over ready content long enough to finish its fade.

**Tech Stack:** React 19, TypeScript 6, WebGL 1, CSS transitions, Vitest

## Global Constraints

- Use the supplied 1717×916 light and dark PNG images.
- Show no text or logo.
- Motion must be slow, seamless, and theme-aware.
- Respect `prefers-reduced-motion` and provide a static fallback.
- Keep canvas device pixel ratio at or below 2.

---

### Task 1: Theme and cover helpers

**Files:**
- Create: `src/lib/liveWaves.ts`
- Test: `src/lib/liveWaves.test.ts`

**Interfaces:**
- Produces: `resolveVisualTheme(explicitTheme, systemIsDark)` and `getCoverUvScale(viewport, image)`.

- [ ] Write tests asserting explicit light/dark override the system, system mode follows the system, and portrait cover crops the wide image equally at both horizontal edges.
- [ ] Run `npm test -- src/lib/liveWaves.test.ts` and confirm it fails because the module is missing.
- [ ] Implement the two pure helpers with typed inputs and explanatory Russian comments.
- [ ] Run the focused test and confirm it passes.

### Task 2: Theme assets and live canvas

**Files:**
- Create: `src/assets/loading-waves-dark.png`
- Create: `src/assets/loading-waves-light.png`
- Modify: `src/components/LoadingScreen.tsx`

**Interfaces:**
- Consumes: helpers from Task 1 and `{ leaving: boolean; onFinished(): void }` props.
- Produces: a full-screen splash with WebGL animation and static fallback.

- [ ] Import the two supplied image assets without recompression.
- [ ] Replace the video with a canvas over a matching static image fallback.
- [ ] Compile a full-screen quad shader; cover-crop the texture; combine low-amplitude sine displacement at different speeds; cap pixel ratio at 2.
- [ ] Observe theme and reduced-motion changes, resize the canvas, and release animation/frame/texture/listener resources on cleanup.
- [ ] Fade the wrapper when `leaving` becomes true and call `onFinished` after 650 ms.

### Task 3: Crossfade into ready content

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: the new `LoadingScreen` props.
- Produces: ready application content mounted below the exiting splash.

- [ ] Keep the existing minimum splash timing and real loading condition.
- [ ] Mount ready content as soon as its data is available, while keeping the splash in an absolute overlay through its exit.
- [ ] Remove the obsolete video preload and update PWA cache comments/patterns for the PNG assets.

### Task 4: Verification

**Files:** none

- [ ] Run `npm test` and confirm all tests pass.
- [ ] Run `npm run lint` and confirm no lint errors.
- [ ] Run `npm run build` and confirm the production build succeeds.
- [ ] Launch the app and manually inspect light theme, dark theme, portrait crop, transition, and reduced-motion fallback.
