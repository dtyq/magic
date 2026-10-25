# Skylearn

## Overview
Skylearn is a design system for kids' edtech platforms, K-8 learning apps, and family-friendly tutoring products. The aesthetic is warmly bright — a friendly sky blue anchors the brand, sun yellow signals achievements and rewards, and leaf green marks progress and correct answers. Surfaces are generous and white; corners are softly rounded; type is large and dyslexia-friendly. The system targets two simultaneous user groups: children (ages 5-14) who need large tap targets, clear visual rewards, and copy that doesn't condescend, and the parents or teachers behind the kids' shoulder who need to assess progress quickly and trust the platform. Skylearn rejects two failure modes common in kids' UI: the saccharine pastel-cartoon aesthetic that feels childish and the corporate-edtech sterility that feels like a test-prep workbook. Instead it aims for the warmth of a great public library children's room.

## Colors
- **Sky** (#3B82F6): Primary brand color — primary CTAs, navigation, active states
- **Sky Bright** (#60A5FA): Hover states, soft accents
- **Sky Deep** (#1D4ED8): Pressed states, focused-input borders
- **Sky Soft** (#DBEAFE): Background tints for active items, lesson selection
- **Sun** (#FBBF24): Achievement accent — stars, badges, rewards, streaks
- **Sun Bright** (#FCD34D): Achievement glow and celebration states
- **Sun Deep** (#D97706): Hover state on sun-yellow elements
- **Leaf** (#22C55E): Progress and correct-answer accent
- **Leaf Soft** (#DCFCE7): Background tint for correct-answer feedback
- **Leaf Deep** (#16A34A): Strong correct-answer indicator
- **Coral** (#F87171): Gentle error indicator — "not quite, try again" — never punitive red
- **Coral Soft** (#FEE2E2): Background tint for "let's try again" feedback
- **Berry** (#A855F7): Secondary accent — bonus content, "go further" prompts
- **Background** (#FFFFFF): Pure white page background
- **Surface** (#F8FAFC): Card and panel surface, very subtle cool tint
- **Surface Elevated** (#FFFFFF): Modals, focused content
- **Surface Sunken** (#F1F5F9): Inset wells, "drag here" zones
- **Ink** (#0F172A): Primary text — deep navy near-black, soft on the eyes
- **Ink Muted** (#475569): Secondary text, instructions
- **Ink Subtle** (#94A3B8): Metadata, timestamps
- **Ink Faint** (#CBD5E1): Disabled state, placeholder
- **Outline** (#E2E8F0): Card edges, dividers
- **Outline Strong** (#94A3B8): Focus rings, prominent separators

## Typography
- **Display**: Hubot Sans (fallback Nunito, Quicksand) — used for headlines and feature titles, with rounded terminals
- **Body Sans**: Atkinson Hyperlegible (fallback Nunito Sans, Inter) — used for instructions, body, UI; specifically chosen for dyslexia-friendly letterforms
- **Reading Serif**: Lexend Deca (fallback Source Serif) — optional alternative for reading-comprehension passages
- **Mono**: JetBrains Mono — used for math equations, timers, scores

The defining choice is using Atkinson Hyperlegible — a typeface explicitly designed for low-vision and dyslexia accessibility — for body and instruction copy. Its distinctive letterforms (open apertures, distinct b/d/p/q, weighted bottoms) reduce visual confusion for emerging readers. Headlines use Hubot Sans with rounded terminals for friendly warmth without becoming cartoonish. Letterforms are at least 16px throughout the entire system; instruction copy is 18px minimum. Letter-spacing on body is set slightly looser than default (0.01em) to reduce crowding for young readers.

Type scale: Hero 56/60 (display 700), H1 40/48 (display 700), H2 32/40 (display 700), H3 24/32 (display 600), H4 19/28 (body 600), Body Large 20/32 (body — for instructions to kids), Body 18/28 (body — for parent-facing copy), Small 16/24 (body), Caption 14/20 (body), Score Number 56/56 (display 700 tabular).

## Elevation
Skylearn uses soft, friendly elevation. Cards rest on the page with a 1px outline border (#E2E8F0) and lift on hover with a soft shadow (0 8px 24px rgba(15, 23, 42, 0.06)). Active lesson cards get a 3px sky border with a sky-soft tinted shadow (0 12px 32px rgba(59, 130, 246, 0.15)). Reward badges glow sun-bright (0 0 24px rgba(252, 211, 77, 0.4)) when first earned, fading after 2 seconds. Modals use a larger shadow (0 24px 48px rgba(15, 23, 42, 0.12)) and a backdrop wash with subtle blur.

Border radius is generous and friendly: 8px on inputs and small chips, 16px on buttons (pill-friendly), 20px on cards, 28px on modals and large panels, 999px on avatar circles, star badges, and "got it!" confirmation pills. Soft corners are part of the visual voice.

## Components
- **Lesson Card**: The central component on the dashboard. A surface card with a 20px radius, illustrated icon at top (64px), lesson title in display serif 22px, a single-line description, and a progress strip (8px tall, 999px radius, leaf fill on sky-soft track). Locked lessons show a sun-yellow lock icon and reduced opacity. Hover triggers a subtle 240ms lift.
- **Big Friendly Button**: Primary CTA optimized for small hands. 64px tall minimum, 16px radius, sky fill with white text, body 600 weight at 20px, 24x40px padding. Hover deepens to sky-deep with a 1px sky-bright bottom edge for a tactile "depressed" feel. Active scales to 0.97 with 120ms snap.
- **Answer Tile**: Used in multiple-choice questions. A large 96px-tall tile with 16px radius, surface background, outline border. Hover lifts with sky shadow. Correct: leaf border + leaf-soft fill + checkmark badge in the corner. Incorrect: gentle coral border + coral-soft fill, no harsh red, with a "let's try again" coral message. Always provides a "Show me why" link to the explanation.
- **Star Badge**: A 64px sun-filled circle with a star icon, used to mark earned achievements. Pulses sun-bright glow on first earn. Stacks of three (bronze, silver, gold) appear on completed lessons — gold for perfect runs.
- **Streak Counter**: A small flame icon (sun fill) with the streak number in display serif tabular. Lives in the top navigation, growing visually as the streak gets longer.
- **Progress Bar**: 8px tall, 999px radius, sky-soft track with leaf fill. Animated fill over 480ms ease-out when progress increments. Major milestone fills trigger a brief sun-bright sparkle particle effect.
- **Confetti Celebration**: On lesson completion, a 1.6-second burst of confetti in sky, sun, leaf, and berry colors falls from the top of the viewport. Used only for completion — never for routine correct answers.
- **Drag-and-Drop Zone**: A surface-sunken area with a 2px dashed outline-strong border and a center "drag answers here" prompt. Active drag state changes the border to sky and the background to sky-soft.
- **Reading Passage**: A reading-comprehension layout with 19px body in Atkinson Hyperlegible, generous 32px leading, an optional reading-ruler overlay (a translucent sky bar highlighting the current line), and a "Read to me" speaker button in sky fill.
- **Avatar / Character**: Kid avatars are circular at 56-96px sizes, with a 3px white inner ring and a 2px sky outer ring. Characters from the platform's mascot vocabulary may appear in lesson illustrations.
- **Parent View Switcher**: A subtle toggle in the corner switching between kid mode (large UI, illustrated) and parent/teacher mode (denser data, progress charts, time-spent breakdown). Parent mode uses tighter typography and includes mono data displays.
- **Quiz Score Card**: At the end of a lesson — a large 56px tabular score number in display, a star row showing performance (1-3 stars), a "What you got right" leaf section, and a "What we'll review next time" gentle coral section. Always ends with a leaf "Keep going!" CTA.
- **Help Bubble**: A speech-bubble-shaped popover with 20px radius and a small tail. Used when the platform's mascot offers a hint. Background sky-soft with sky text.
- **Tag Pills**: 999px pills with body caption text. Subject tags (Math, Reading, Science) use sky-soft fill with sky text. Difficulty tags (Easy, Medium, Hard) use sun-soft, sun, and berry-soft respectively.
- **Inputs**: 1px outline border, surface background, 12px radius, 16x20px padding, 18px body text. Focus border becomes sky with a 4px sky-soft ring. Error states use coral border with a friendly inline message, never blocking the input.

## Spacing
- Base unit: 4px
- Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128px
- Container max-width: 1280px with 24px horizontal padding (desktop)
- Mobile padding: 20px horizontal
- Tap target minimum: 56px square (smaller hands, less fine motor control)
- Card grid gap: 20px mobile, 32px desktop
- Section spacing: 48px between major sections — kids need clearer visual chunking

## Motion
Motion in Skylearn is playful and rewarding without being distracting. Standard duration is 240ms with cubic-bezier(0.34, 1.56, 0.64, 1) easing (gentle spring overshoot). Correct-answer feedback uses a 320ms leaf burst with a small confetti sparkle (3-4 particles, never more). Incorrect answers shake the tile briefly (4px horizontal, 240ms, two cycles) and never use harsh red flashes. Progress bars fill with ease-out over 480ms. Star badges scale-in from 0 to full size over 480ms with overshoot. Confetti completion celebrations are 1.6 seconds. The system respects prefers-reduced-motion: confetti reduces to a single static star burst, transitions shorten to 120ms.

## Iconography
A custom illustrated icon set at 2px stroke with rounded line caps and joins. The vocabulary is friendly-curious: book with open pages, pencil with sharpened tip, calculator, magnifying glass, light bulb, star, rocket, leaf, sun, raindrop, paint palette, alphabet block. Icons are 24px default in ink-muted, scaling to 32px in lesson cards and 48px in feature contexts. Active icons use sky. Achievement icons use sun. Icons should feel hand-drawn-adjacent — slightly imperfect, never sterile.

## Accessibility
Accessibility is a first-class concern in Skylearn, not an afterthought. Contrast ratios target WCAG-AAA (7:1) on body text, AA-large (4.5:1) on large display. Atkinson Hyperlegible is the body face specifically for dyslexia accessibility. Tap targets are 56px minimum. Color is never the sole signal — correct/incorrect states always pair color with icon (checkmark/x), pattern (border style), and copy. A "Read to me" button is available on every reading passage. A reading-ruler toggle highlights the current line. A high-contrast mode swaps surfaces to background-white with ink-black text and removes decorative illustration. A reduced-motion mode disables confetti and animation flourishes.

## Voice and Tone
- Friendly but not babyish. "Let's try again!" not "Oopsie wopsie!"
- Curious and encouraging. "What do you notice about this number?"
- Specific praise over generic. "You spelled 'because' right — that's a tricky one." Not "Great job!"
- Errors are framed as learning, never failure: "Not quite — try multiplying first," "Let's look again."
- Parent-facing copy is clear and direct, no jargon: "Maya spent 18 minutes on multiplication today. She got 14 of 16 correct on the quiz."
- Empty states are inviting: "Nothing here yet — pick a lesson to start!"

## Do's and Don'ts
- Do use Atkinson Hyperlegible for body — dyslexia-friendly is non-negotiable
- Do enforce 56px minimum tap targets for kid-facing controls
- Do pair every correct/incorrect state with an icon, not just color
- Do reserve confetti for completion, not routine correct answers
- Do use sun-yellow exclusively for achievements and rewards, never for primary actions
- Do support the "Read to me" voice option on every reading passage
- Don't use harsh red for errors — the gentle coral is intentional
- Don't condescend in copy — "Oopsie!" and "Yay!" feel insincere; specific feedback respects the learner
- Don't reduce text below 16px anywhere in the kid-facing UI
- Don't rely on color alone to convey meaning — accessibility first
- Don't use cartoonish gradients, "fun" stickers, or excessive emoji — Skylearn warms, not infantilizes
- Don't autoplay sound — every audio element requires intent
- Don't gate critical controls behind hover-only interactions — kids on touch devices need explicit affordances
