---
applyTo: "apps/mobile/**"
---

# Mobile visual/motion guardrails — read before touching any screen

`.github/copilot-instructions.md` already defines the token system (colors, typography,
spacing, motion) and the general creative direction. This file is narrower: it exists because
real screens independently drifted into generic "AI app" tells even with the token system in
place. Tokens alone don't prevent this; they just supply the ingredients. This file constrains
*how* those tokens get used so the same tells don't reappear on every new screen.

Rules 1–3 came from auditing the first two real screens (`app/(auth)/index.tsx`,
`app/(app)/index.tsx`). Rules 4–8 were added ahead of Milestone 3–4 screens (dashboards, lists,
forms, empty states) before those tells had a chance to show up in this codebase — they're
written from the same generic-app failure patterns seen elsewhere, not from an audit of this
repo's own code yet. Treat all eight as review gates: before finishing a screen, check it
against each one specifically, not just "did I use the theme tokens."

---

## 1. Overline/eyebrow labels are the exception, not the default

**What happened:** every screen state so far pairs a heading with a small uppercase
letter-spaced label sitting above it — `"Account review"`, `"First run"`, `"Authenticated
shell"` — usually inside a pill badge. That's the tracked-out ALL-CAPS eyebrow pattern: template
chrome that shows up whatever the actual content is, because it's the path of least resistance
once `typography.overline` exists as an importable style.

**The rule:** a heading does not need a label above it to look finished. Before adding an
overline/pill above any `h1`/`h2`, ask what specific piece of information it's encoding that
the heading and body text don't already say. If the answer is "it signals what kind of screen
this is" — that's decoration, not information, and it should be cut.

- Default to **no label above a heading**. `"Access pending"` as an `h1` already says what the
  screen is; it doesn't also need an `"Account review"` pill above it to prove it.
- If a status genuinely needs a visible tag (e.g. a list of items each carrying a different
  state — enrolled / waitlisted / dropped), that's a real, content-driven use of a badge, and it
  should sit inline with or next to the thing it describes, not centered above a page heading as
  a page-level decoration.
- `typography.overline` itself is fine to keep and use for what an overline is actually for:
  a label grouping several items underneath it (e.g. a section header inside a long list,
  `"COURSES"` above a group of course rows). It is not a per-screen hero accessory.
- Never let a screen's state (pending, first-run, authenticated, error, empty) be communicated
  primarily through a colored pill + uppercase word. Say it in the heading and body copy, which
  is what a person actually reads.
- If you're reaching for `typography.overline` and can't point to a grouping it's labeling,
  don't add it — write the heading and move on.

## 2. One signature motion moment per flow, not motion-per-element

**What happened:** `theme/motion.ts` defines duration/easing/spring tokens but the temptation
once an animation library is available is "add an entrance animation to every card, badge, and
button" — that trades zero motion for motion-as-wallpaper, which is the other generic default
(fade-and-slide-up on every section, a hover/press animation on every element, because it's the
first thing that comes to mind).

**The rule:** a *flow* — sign-in, the pending/first-run gate, arriving at the home dashboard,
completing onboarding, submitting an enrollment — gets exactly **one** deliberate motion moment
that belongs to it. Not one per screen element. Pick the single transition that actually matters
to the person doing that flow, give it real craft (correct easing/duration from `motion.ts`, not
a default), and leave everything else on that screen static.

- Before writing any animation, name the one moment in this flow that deserves it, in a
  comment or PR description if useful: e.g. "the signature moment for sign-in is the brand mark
  settling into place as the Google redirect resolves," or "the signature moment for onboarding
  completion is the pending-card handing off to the dashboard." If you can't name one moment,
  don't add motion to that flow yet.
- Baseline press feedback (a `Pressable` dimming/scaling slightly on touch) is ambient utility
  feedback, not a "moment" — keep it, keep it identical everywhere via one shared press-state
  helper using `motion.duration.fast` + `motion.easing.standard`, and don't count it toward the
  one-moment budget. But don't add anything beyond that (no per-button custom springs, no
  per-card entrance).
- A list of items (course list, notification feed) is allowed a staggered entrance **if that
  reveal is itself the flow's one signature moment** — meaning nothing else on that screen also
  animates. Never combine a staggered list entrance with card press effects, header fade-ins,
  etc. on the same screen.
- Use `theme/motion.ts` tokens for the moment you do build. If a moment needs a duration or
  easing that isn't already in `motion.ts`, that's a signal to reconsider the moment, not to
  invent a one-off value inline.
- `react-native-reanimated` (the documented standard in `.github/copilot-instructions.md`) needs
  to actually be installed and used for that one moment — a token file that nothing imports is a
  problem on its own, but the fix is one wired-up moment per flow, not wiring it into everything
  at once.

## 3. Vary container treatment — stop reaching for the same bordered card

**What happened:** every content block on the first two screens is the identical shape:
`surface` background, `1px border`, `radius 12–16`, padding — `(app)/index.tsx`'s pending and
onboarding states even nest one of these inside another (an outer card containing a smaller
"Signed in as" card in the same style). This is the SaaS-card-kit default: everything chopped
into identical rounded, bordered containers regardless of what the content actually is.

**The rule:** reserve the bordered `surface` card for content that genuinely needs visual
separation as a distinct, self-contained unit — and use something else for everything else.
Before wrapping something in a card, pick from treatments that fit what the content actually
is, not the one you reached for last time:

- **Flat on background** — primary screen content (the heading, the main body copy, the
  primary CTA) usually doesn't need to sit inside a card at all when it's already the only thing
  on the screen. Let it sit directly on `colors.bg` with spacing doing the separation. A full-
  screen state like "Access pending" doesn't need an inner card that just re-describes the
  screen's own edges.
- **Tinted inset panel** — a `bg`-mixed tint with no border, for a block that's informational
  but secondary (e.g. "Signed in as {email}"). Different from a bordered card, and doesn't
  imply the same level of separation.
- **Accent-bar / left-rule callout** — a single colored left border (2–3px) with no
  surrounding box, for a single callout or notice that needs to draw the eye without being
  boxed in on all sides.
- **Hairline-divided sections** — a single top or bottom `border` hairline between stacked
  sections instead of a box around each one, for sequential content (e.g. "Signed in as" /
  "Required next steps" stacked under one heading) — this replaces the nested-card pattern
  directly.
- **Bordered `surface` card** — keep this one, but only for content that is actually a
  distinct, extractable unit: something that could plausibly be its own row in a list, get
  tapped into its own detail view, or be one of several repeated items (a course card, a
  notification). A full-screen singleton state is not this.
- Never nest a bordered card inside another bordered card using the same radius/border
  recipe just smaller. If an inner block needs separation from an outer card, change the
  treatment (tint, divider, accent bar) rather than repeating the shape.
- A screen is allowed to use more than one of these treatments together (e.g. flat heading +
  hairline-divided list below it) — that's the point. A screen using the same treatment for
  every block on it, including nested ones, is the failure mode.

## 4. Dashboards and stat summaries — don't grid-ify every metric identically

The generic-admin-template tell is a row of identical cards, each with an icon in a tinted
rounded square, a big number, and a label underneath — repeated for every metric regardless of
whether that metric is the most important thing on the screen or a footnote. This will come up
first on the admin dashboard (Milestone 4) and any summary view.

- Before building a dashboard or summary screen, pick the one or two numbers that actually
  matter for that screen and give them real visual weight (larger type per the Display/H1
  scale, more surrounding space). Render secondary figures inline or in a compact list instead
  of promoting them to their own identical card.
- Not every number on a dashboard deserves the same box. If two stat blocks end up with
  identical visual weight, ask whether they're actually equally important — usually they aren't.

## 5. List rows — icons must carry information, not decoration

Don't prefix every row in a list with a leading icon, and don't add a trailing chevron by
default. A chevron implies "tapping this goes somewhere deeper" — only add one where that's
literally true.

- A leading icon/avatar should identify *which* item this is (a course color swatch, a
  person's avatar, an announcement's course badge), not just mark "this is a list item."
- If every row in a list has the same generic icon (e.g. a bullet-point icon repeated down a
  settings list), remove it — well-set typography hierarchy and row layout already communicate
  "this is a list" without it.
- This applies to course lists, notification feeds, FAQ lists, audit log rows, and settings
  screens alike.

## 6. Empty states — specific to the screen, not a reusable template

No centered illustration + "Nothing here yet" boilerplate copy-pasted across every empty list
(courses, notifications, FAQ, audit log, admin queues).

- Each empty state says what's actually missing and what the person can do about it in this
  specific context — "You're not enrolled in any courses yet" with a link to browse, vs. "No
  announcements from your courses" with no action needed, are different states and should read
  differently.
- Skip the illustration unless it's carrying real information; a well-set heading and one line
  of body text (Part 1's typography scale) is usually enough. If you do use an illustration,
  it shouldn't be the same one reused across unrelated empty states.

## 7. Forms — group with spacing, not a bordered card per field

Related fields (e.g. name + student ID + department in onboarding, or event title + date + time
+ location when adding a personal event) sit in one visually grouped section using spacing and
an optional section label — not each wrapped in its own bordered `surface` card.

- Validation errors render inline under the specific field in `danger` text, not collected into
  a boxed banner listing every error at the top of the form.
- A multi-section form (e.g. event details + recurrence settings) can use a hairline divider
  between sections per Rule 3, rather than a card per section.

## 8. Loading states — skeletons mirror the real content shape

A skeleton for a course list row looks like a course list row (title-width bar, subtitle-width
bar, a swatch-sized block) — not a generic stack of same-width gray rectangles reused for every
loading screen in the app.

- Build the skeleton from the same layout component as the real row where practical, swapping
  content for shimmer blocks (per the Part 2 shimmer rule: `opacity` interpolation on a
  worklet loop), so loading and loaded states don't visually jump.
- Different content types get different skeleton shapes — a notification skeleton and a course
  card skeleton shouldn't be interchangeable.

---

## Quick self-check before marking a screen done

1. Is there a label sitting above a heading? If yes, what information does it carry that the
   heading doesn't? If none, remove it. *(Rule 1)*
2. Can you name the one motion moment that belongs to this flow? Is anything else on the
   screen also animating beyond the shared press-state feedback? If yes, cut it back to one.
   *(Rule 2)*
3. Look at every bounded box on the screen. Are two or more of them the same
   border+radius+surface recipe just at different sizes? If yes, change at least one to a
   different treatment from the list above. *(Rule 3)*
4. If this is a dashboard/summary screen: do all the stat blocks look identical regardless of
   importance? If yes, promote the one or two that matter and simplify the rest. *(Rule 4)*
5. If this screen has a list: does every row have the same icon or chevron regardless of
   whether it means anything? If yes, remove it or make it content-specific. *(Rule 5)*
6. If this screen has an empty state: would the copy work unchanged on a totally different
   empty screen in this app? If yes, make it specific. *(Rule 6)*
7. If this screen has a form: is each field or small group wrapped in its own card? If yes,
   switch to spacing/divider grouping. *(Rule 7)*
8. If this screen has a loading state: does the skeleton's shape match the content it's
   replacing? If it's generic gray bars, rebuild it from the real row's layout. *(Rule 8)*
