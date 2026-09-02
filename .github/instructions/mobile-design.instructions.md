---
applyTo: "apps/mobile/**"
---

# Mobile visual/motion guardrails — read before touching any screen

`.github/copilot-instructions.md` already defines the token system (colors, typography,
spacing, motion) and the general creative direction. This file is narrower: it exists because
the first two real screens — `app/(auth)/index.tsx` and `app/(app)/index.tsx` — independently
drifted into the same three generic "AI app" tells, even with the token system in place. Tokens
alone don't prevent this; they just supply the ingredients. This file constrains *how* those
tokens get used so the same three tells don't reappear on every screen after this one.

Treat all three rules below as review gates: before finishing a screen, check it against each
one specifically, not just "did I use the theme tokens."

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

**What happened:** `theme/motion.ts` defines duration/easing/spring tokens but nothing in the
app imports them yet, and `react-native-reanimated`/`moti` aren't even installed. The fix for
that is not "add an entrance animation to every card, badge, and button" — that trades zero
motion for motion-as-wallpaper, which is the other generic default (fade-and-slide-up on every
section, a hover/press animation on every element, because it's the first thing that comes to
mind once an animation library is available).

**The rule:** a *flow* — sign-in, the pending/first-run gate, arriving at the home dashboard,
completing onboarding — gets exactly **one** deliberate motion moment that belongs to it. Not
one per screen element. Pick the single transition that actually matters to the person doing
that flow, give it real craft (correct easing/duration from `motion.ts`, not a default), and
leave everything else on that screen static.

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
- A list of items (course list, notification feed, once these screens exist) is allowed a
  staggered entrance **if that reveal is itself the flow's one signature moment** — meaning
  nothing else on that screen also animates. Never combine a staggered list entrance with card
  press effects, header fade-ins, etc. on the same screen.
- Use `theme/motion.ts` tokens for the moment you do build. If a moment needs a duration or
  easing that isn't already in `motion.ts`, that's a signal to reconsider the moment, not to
  invent a one-off value inline.
- `react-native-reanimated` (already the documented standard in `.github/copilot-instructions.md`)
  needs to actually be installed and used for that one moment — a token file that nothing
  imports is the current state and is itself a problem, but the fix is one wired-up moment per
  flow, not wiring it into everything at once.

## 3. Vary container treatment — stop reaching for the same bordered card

**What happened:** every content block on both screens is the identical shape: `surface`
background, `1px border`, `radius 12–16`, padding. `(app)/index.tsx`'s pending and onboarding
states even nest one of these inside another (an outer card containing a smaller "Signed in as"
card in the same style) — a smaller copy of the same recipe rather than a different treatment.
This is the SaaS-card-kit default: everything chopped into identical rounded, bordered
containers regardless of what the content actually is.

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

---

## Quick self-check before marking a screen done

1. Is there a label sitting above a heading? If yes, what information does it carry that the
   heading doesn't? If none, remove it.
2. Can you name the one motion moment that belongs to this flow? Is anything else on the
   screen also animating beyond the shared press-state feedback? If yes, cut it back to one.
3. Look at every bounded box on the screen. Are two or more of them the same
   border+radius+surface recipe just at different sizes? If yes, change at least one to a
   different treatment from the list above.
