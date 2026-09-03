# NEU Companion — Project Context for Copilot

This file is auto-loaded into every Copilot Chat/agent session in this repo.
Do not ask the user to re-explain stack, structure, docs, or visual identity — read the
files and rules below first.

## What this project is
NEU Companion is a university companion platform: course enrollment, timetable, announcements,
identity/RBAC, and admin controls. Monorepo, Node.js/TypeScript, npm workspaces (`apps/*`).

## Current phase — read this before doing anything
- **Backend (`apps/api`) has scaffolding across all 9 domains, but is mid-remediation.** A
  full code audit (`docs/backend-audit-report.md`) found real bugs, stubs, and security holes
  behind that scaffolding — two authentication bypasses, no CSRF protection, an Excel import
  parser that never parses anything, no reminder-dispatch pipeline, and more. `docs/api-design/
  domain-XX-*.md` contracts are still final for **shape** (never invent fields or endpoints),
  but do **not** assume an endpoint's actual behavior matches its contract just because the
  route exists — check the audit and the plan below first.
- **Do not trust `docs/milestones.md` checkbox state at face value.** It currently marks things
  complete that the audit shows are stubbed or broken. `docs/remediation-and-frontend-plan.md`
  is the corrected, ordered list of what's actually left — treat it as authoritative over
  `milestones.md` until the two are reconciled.
- **Frontend has 2 screens** (`app/(auth)/index.tsx`, `app/(app)/index.tsx`). The plan is
  `docs/frontend-milestones.md` for milestone ordering, and `docs/remediation-and-frontend-plan.md`
  §2 for the concrete screen-by-screen inventory, including which screens are blocked on a
  backend fix and which one.
- If you are working through a known backend issue from the audit, **don't start from this
  file** — start from `.github/prompts/fix-known-issues.prompt.md`, which walks the list in
  order. Use `.github/prompts/start-task.prompt.md` only for backend work that isn't already
  covered by the remediation plan (i.e. genuinely new feature work).

## Source of truth (check before answering or coding)
- **What's broken and in what order to fix it:** `docs/remediation-and-frontend-plan.md`
- **The original line-by-line audit findings:** `docs/backend-audit-report.md`
- **Database-design-level findings (separate angle, same root causes):**
  `docs/database-design-audit.md`
- Frontend plan / current milestone: `docs/frontend-milestones.md`
- Backend plan / current milestone: `docs/milestones.md` (status marks are unreliable — see above)
- Requirements: `docs/requirements.md`
- Database design: `docs/database-design.md`
- API domain map: `docs/api-design/api-domains.md`
- Per-domain API contracts: `docs/api-design/domain-XX-*.md`
- Backend tech detail: `docs/TECH_STACK.md`

Never invent requirements, endpoints, schema, or screens. If something needed isn't covered in
these docs, say so explicitly instead of guessing.

## Frontend tech stack (working defaults — treat as decided unless a milestone doc says otherwise)
- **React Native + Expo**, TypeScript (strict)
- **Navigation:** Expo Router (file-based; also gives clean deep-link handling for the Google
  OAuth → cookie-session redirect flow that Milestone 2 needs)
- **Animation:** `react-native-reanimated` v3 + `react-native-gesture-handler` — see Part 2, non-negotiable
- **Server/session state:** TanStack Query — gives the loading/error/retry states Milestones 2–3
  explicitly require, on top of a typed API client layer
- **Images:** `expo-image` (not core `Image`)
- **Haptics:** `expo-haptics` — see Part 2, tied to the same interaction moments as the press-state animation
- **Icons:** `lucide-react-native`
- **Fonts:** `@expo-google-fonts/space-grotesk`, `@expo-google-fonts/inter`, `@expo-google-fonts/jetbrains-mono`
- **Auth note:** the API uses cookie-based sessions, not JWTs. React Native doesn't get browser
  cookie jars for free — the HTTP client and the OAuth web→app handoff need explicit cookie
  handling. This is also currently blocking Milestone 2's sign-in screen — check
  `docs/frontend-milestones.md` before assuming it's resolved.

---

# Part 1 — Creative Blueprint (mandatory visual identity)

Do not fall back to default Expo/React Native look and feel: no default system-blue tint
(`#007AFF`), no default Material ripple, no generic sans-serif everywhere, no emoji-as-icons,
no purple-to-blue "AI" gradients. Every screen must read as intentionally designed, not scaffolded.

**Direction:** dark-first premium academic identity. Both themes are fully supported and
system-driven at runtime, but design and QA new screens in dark mode first — the crimson brand
red against near-black is the more distinctive, premium expression of this palette. Use the
brand red as an **accent, not wallpaper**: CTAs, active states, selected indicators, links, the
brand mark. Never as a large fill or full-screen background — restraint is what makes it read
premium instead of loud.

## Color tokens
Never hardcode hex values in a component. These live in one theme module and are consumed via
a `useTheme()` hook (or equivalent), keyed by the active color scheme.

```ts
// theme/colors.ts
export const colors = {
  light: {
    primary: '#BB1B3A',
    primaryPressed: '#972037',
    onPrimary: '#FFFFFF',
    bg: '#FAFAFA',
    surface: '#FFFFFF',
    border: '#E5E5E5',
    textPrimary: '#1A1A1A',
    textSecondary: '#6B6B6B',
    textMuted: '#9B9B9B',
    success: '#15803D',
    warning: '#B45309',
    info: '#1D4ED8',
    danger: '#DC2626',
  },
  dark: {
    primary: '#BB1B3A',
    primaryPressed: '#D41137', // note: lifts brighter on press in dark mode, not darker
    onPrimary: '#FFFFFF',
    bg: '#121212',
    surface: '#1E1E1E',
    border: '#2E2E2E',
    textPrimary: '#F5F5F5',
    textSecondary: '#B0B0B0',
    textMuted: '#7A7A7A',
    success: '#4ADE80',
    warning: '#FBBF24',
    info: '#60A5FA',
    danger: '#F87171',
  },
} as const;
```

Usage rules:
- `textPrimary` — headings, values, anything the user is reading for content
- `textSecondary` — supporting text, field labels
- `textMuted` — timestamps, placeholders, disabled state, helper text
- Semantic colors map to real states only: `success` = enrollment/import confirmed, `warning` =
  needs attention (pending review, soft conflict), `info` = neutral system notices, `danger` =
  security alerts, destructive actions, validation errors. Never use them decoratively.
- `primaryPressed` is the **pressed/active** state color for interactive elements (there's no
  hover on touch), not a secondary brand color.

## Typography
Two-family system, loaded via `expo-font` — never ship on the OS default font.

| Role | Family | Weight | Size / Line height |
|---|---|---|---|
| Display | Space Grotesk | 700 | 32 / 40 |
| H1 | Space Grotesk | 600 | 28 / 34 |
| H2 | Space Grotesk | 600 | 22 / 28 |
| H3 | Space Grotesk | 600 | 18 / 24 |
| Body Large | Inter | 400 | 16 / 24 |
| Body | Inter | 400 | 14 / 20 |
| Caption | Inter | 500 | 12 / 16 |
| Overline/label | Inter | 600, uppercase, +0.6 tracking | 11 / 14 |
| Code / course codes / times | JetBrains Mono | 500 | matches surrounding body size |

Space Grotesk carries the brand's confident, geometric personality on anything a user scans
(headings, empty states, onboarding). Inter carries density and legibility everywhere information
is actually read (lists, forms, body copy). JetBrains Mono is used narrowly — course codes,
timetable slot times, IDs — as a deliberate technical accent, not a general-purpose font.

## Spacing & radius
4px base spacing scale: `xs 4 · sm 8 · md 12 · lg 16 · xl 20 · 2xl 24 · 3xl 32 · 4xl 40 · 5xl 48 · 6xl 64`

Radius scale: `sm 8` (chips, small inputs) · `md 12` (buttons, inputs) · `lg 16` (cards, sheets) ·
`xl 24` (modals, hero surfaces) · `pill 999` (tags, avatars, segmented controls).

## Elevation — two levels only
Flat, hairline-bordered surfaces over heavy shadow/skeuomorphism.
1. **Resting** — `border` token only, no shadow. Default for cards, list rows, inputs.
2. **Raised** — used only for modals, bottom sheets, and the FAB: subtle shadow
   (`opacity 0.06–0.08`, `radius 12–16`, `y-offset 2–4`), never a hard drop shadow.

## Iconography
`lucide-react-native` exclusively — stroke width **1.75**, sizes **16 / 20 / 24** only, colored
via the current text/icon token (never a hardcoded hex). Do not mix icon libraries or fall back
to emoji for status/navigation.

## Component conventions
- Primary button: filled, `radius md`, `primary` bg / `onPrimary` text, `primaryPressed` on press.
- Secondary/tertiary buttons: hairline `border`, transparent bg, `textPrimary` label.
- Cards: `surface` bg, `border` hairline, `radius lg`, `lg` internal padding.
- Status badges (enrollment state, import result, security alert): `pill` radius, semantic color
  at ~15% opacity as background with the full-strength semantic color as text/icon — never a
  solid semantic fill behind white text except for `danger` alerts that need to interrupt.
- Tab bar / active nav state: `primary` for the active icon+label, `textMuted` for inactive —
  no background pill behind the active tab, keep it minimal.

---

# Part 2 — Animation & Performance Guardrails (non-negotiable)

This is a mobile app; janky animation is immediately felt and immediately looks cheap. These
rules exist because AI-generated animation code habitually animates the wrong properties.

## Engine
`react-native-reanimated` v3 + `react-native-gesture-handler` for **all** interactive and
gesture-driven animation. Never use the core `Animated` API for anything beyond a one-off fade
already using `useNativeDriver`. Never use `LayoutAnimation` for anything the user triggers
directly (list reorder on swipe, sheet open) — it's unmeasurable and uncontrollable; use
Reanimated's `entering`/`exiting`/`layout` transitions instead.

## The one hard rule
**Only animate `transform` (translateX/Y, scale, rotate) and `opacity`.** These run as worklets
on the UI thread and never trigger a layout pass. Never animate `width`, `height`, `top`, `left`,
`right`, `bottom`, `margin`, `padding`, or `flexBasis` frame-by-frame — each of these forces a
layout recalculation of the node and its siblings on every frame and is the single most common
cause of dropped frames in RN apps.

Translate every "I want to animate size/position" instinct into a transform:
- Growing/shrinking a surface → `scale`, not `width`/`height`
- Sliding a panel in/out → `translateX`/`translateY`, not `left`/`top`/`margin`
- Expanding a card → animate a `scaleY` wrapper, or use Reanimated's measured `Layout` transition
  API (which itself only writes to transform under the hood) — never manually tween `height`.
- Color transitions (e.g. status change) → `interpolateColor` inside a worklet is fine; it's
  still a UI-thread operation, not a layout one.

## Motion tokens
One shared set, no per-component invented durations.

```ts
// theme/motion.ts
export const duration = { instant: 100, fast: 150, base: 250, slow: 350, deliberate: 500 };
export const easing = {
  standard: Easing.bezier(0.22, 1, 0.36, 1), // controlled ease-out, the "premium" curve
  entrance: Easing.out(Easing.cubic),
  exit: Easing.in(Easing.cubic),
};
export const spring = { damping: 18, stiffness: 180, mass: 0.9 }; // snappy, low bounce — not cartoonish
```

## Rules by category
- **Press states** (buttons, cards, list rows): `scale` to `0.97` + slight `opacity` drop, `fast`
  (150ms), `standard` easing. This is the app's core tactile feedback — keep it consistent everywhere.
- **Screen transitions:** use Expo Router / native-stack defaults; only reach for a custom
  shared-element transition where it earns its cost (e.g. course card → course detail), `base`
  (250ms) duration.
- **Tab transitions:** switching bottom tabs is instant — no slide, no crossfade between tab
  roots, no re-mounting animation. The only thing that animates is the active icon/label color
  (`interpolateColor`, `fast`, 150ms) per the tab bar convention in Part 1. This matches native
  tab-bar behavior on both platforms and keeps navigation feeling immediate rather than
  decorative; do not add a custom tab transition. Each tab preserves its own navigation stack/
  scroll position when switching away and back (Expo Router default) — don't reset it.
- **List item entrance:** stagger only on short, above-the-fold lists (<10 visible items) using
  Reanimated's `FadeIn`/`SlideIn` layout animations, capped at `fast` (150–200ms) per item. Never
  stagger a long feed — it reads as slow, not premium.
- **Loading states:** shimmer via `opacity` interpolation on a worklet loop, never via a
  `backgroundColor` JS-thread interval.
- **Swipe-to-dismiss / pull-to-refresh:** `react-native-gesture-handler` driving shared values,
  never `PanResponder`.

## Haptics
`expo-haptics`, fired from the same handler as the press-state animation — never on its own timer
or decoupled from a user gesture.
- **Light impact** — default for any pressable: buttons, cards, list rows, tab switches.
- **Medium impact** — confirming a committed action: enrollment submitted, RSVP, destructive
  confirm (delete, drop course).
- **Success / warning / error notification haptic** — reserved for async results the user is
  waiting on (enrollment confirmed, import failed, conflict detected) — not for routine
  navigation or every button press.
- Respect the system haptics setting; gate decorative-only haptic flourishes (none currently
  planned) behind the same reduced-motion check used for animation.

## Reduced motion
Check `AccessibilityInfo.isReduceMotionEnabled()` (via a shared hook) and gate every **decorative**
animation behind it — entrance stagger, shimmer, parallax. Functional feedback (a button
registering a press) can stay, minimized to an opacity change only.

## List & render performance
- Any list over ~20 items uses `FlashList` (or `FlatList` with `getItemLayout` if row height is
  fixed) — never a `ScrollView.map()`.
- `renderItem` components are `React.memo`'d; callbacks passed to list rows are `useCallback`'d.
  No inline arrow functions or inline style objects inside a list row — both defeat memoization
  and reallocate every render.
- Stable `keyExtractor` using real IDs, never array index.
- All remote images go through `expo-image` with a `cachePolicy` and a placeholder — never core
  `Image` for course/avatar/announcement imagery.
- No nested `ScrollView`/`FlatList` combinations.
- Expensive derived values (filtering/sorting a course list, computing timetable conflicts) are
  `useMemo`'d, not recomputed on every render.

## Explicit anti-patterns — never introduce these
- `setInterval`/`setState` driving a frame-by-frame animation loop
- Animating `width`/`height`/`margin`/`top`/`left` for any transition
- `LayoutAnimation.configureNext` for user-triggered UI (fine only for rare, non-interactive,
  low-frequency changes)
- Inline anonymous functions or style objects inside list `renderItem`
- A new spring/timing config invented per component instead of using the shared `motion.ts` tokens
- Decorative animation with no reduced-motion gate
- Haptic feedback fired independent of a user gesture, or overused on every micro-interaction

**Screen-type-specific rules** (dashboards, list rows, empty states, forms, loading skeletons)
live in `.github/instructions/mobile-design.instructions.md`, scoped to `apps/mobile/**` — read
that file before building any screen, not just this one.

---

## Working conventions
1. Screens map to the 9 API domains, not ad hoc groupings — check `docs/api-design/api-domains.md`
   and the screen inventory in `docs/remediation-and-frontend-plan.md` §2 before naming a new
   screen/route. That inventory also tells you if the screen is blocked on a backend fix.
2. One theme module (`colors.ts`, `typography.ts`, `spacing.ts`, `motion.ts`), consumed everywhere
   via hooks — no component reaches for a raw hex value or a magic number for spacing/duration.
3. Match API request/response shapes from `docs/api-design/domain-XX-*.md` exactly — but verify
   against `docs/backend-audit-report.md` that the endpoint actually behaves as documented before
   building UI that assumes it does.
4. Any deviation from this visual system or these animation rules is flagged explicitly, not
   made silently — same standard the backend docs already hold for schema/requirement changes.

## Finishing a task
1. Once a task is done, `git add` / `git commit` / `git push` — don't leave finished work
   uncommitted or unpushed for the user to handle manually.
2. If the task needs manual testing (a real device/simulator check, an OAuth flow, anything that
   can't be verified from code alone), say so and wait to be told it passed before marking the
   milestone item as complete in `docs/frontend-milestones.md`. Don't mark a milestone item done
   on the strength of code review alone when it needed manual verification.

## When starting a new session
Don't wait to be told the stack, docs, or design system — it's all above. Then pick the right
entry point:
- Fixing a known backend issue from the audit → `.github/prompts/fix-known-issues.prompt.md`
- New backend feature work not covered by the remediation plan → `.github/prompts/start-task.prompt.md`
- Mobile frontend work → `.github/prompts/start-frontend-task.prompt.md`
