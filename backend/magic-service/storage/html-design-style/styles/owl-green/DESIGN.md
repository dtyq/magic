# Owl Green

## Overview
Owl Green is a playful, gamified design system bursting with energy and color. Inspired by language learning platforms, it uses bold greens, warm yellows, and rounded shapes to create a friendly, encouraging experience. Every interaction feels rewarding, with chunky buttons, bouncy animations, and a personality-rich interface that makes learning feel like play.

## Colors
- **Primary** (#58CC02): Primary actions, correct answers, progress, streaks — Duo Green
- **Primary Hover** (#4CAD02): Hovered primary buttons, pressed states
- **Secondary** (#1CB0F6): Secondary actions, informational elements, skill icons — Sky Blue
- **Neutral** (#777777): Muted text, inactive states, disabled elements
- **Background** (#F7F7F7): Page background, lesson screens
- **Surface** (#FFFFFF): Cards, question tiles, modals
- **Text Primary** (#3C3C3C): Headings, body copy, question text
- **Text Secondary** (#777777): Descriptions, hints, secondary labels
- **Border** (#E5E5E5): Card borders, section dividers
- **Success** (#58CC02): Correct answers, completed lessons, streaks — same as primary
- **Warning** (#FFC800): XP, gems, bonus streaks, attention — Duo Gold
- **Error** (#FF4B4B): Incorrect answers, hearts lost, error states — Duo Red

## Typography
- **Display Font**: Nunito — loaded from Google Fonts
- **Body Font**: Nunito — loaded from Google Fonts
- **Code Font**: JetBrains Mono — loaded from Google Fonts

Nunito's rounded terminals and friendly weight give the interface a warm, approachable feel. Use weights 400 (body), 600 (labels, secondary headings), 700 (headings), and 800 (extra bold for XP, streaks, big numbers). Letter-spacing 0em throughout. Line height 1.5 for body, 1.3 for headings. Capitalize headings in lessons.

Type scale:
- Display: 36px / 800
- H1: 28px / 700
- H2: 22px / 700
- H3: 18px / 700
- Body: 16px / 400
- Body Small: 14px / 400
- Caption: 12px / 600
- XP/Streak: 24px / 800
- Button: 15px / 700, uppercase, letter-spacing 0.04em

## Elevation
Elevation uses colored bottom borders rather than traditional box-shadows to create a chunky, playful depth effect. Level 0 (flat) for inline content. Level 1: 4px solid bottom border in a darker shade of the element's color (e.g., green button gets #3C8C00 bottom border). Level 2: cards with `0 2px 6px rgba(60,60,60,0.1)` plus a 3px bottom border. Level 3: `0 4px 12px rgba(60,60,60,0.15)` for modals. Active/pressed states reduce bottom border to 2px and translate down 2px.

## Components
- **Buttons**: 50px height, 24px horizontal padding, 16px border-radius, Nunito 700 at 15px uppercase. Primary: #58CC02 bg, white text, 4px #3C8C00 bottom border. Secondary: white bg, #1CB0F6 text, 2px #E5E5E5 border, 4px #CECECE bottom border. Danger: #FF4B4B bg, white text, 4px #CC3C3C bottom border. Pressed: translate-y 2px, bottom border shrinks to 2px.
- **Cards**: White background, 2px #E5E5E5 border, 16px border-radius, 20px padding, 4px #E5E5E5 bottom border for depth. Lesson cards: 80px height, flag icon left, lesson name center, progress ring right.
- **Inputs**: 48px height, 16px horizontal padding, 12px border-radius, 2px #E5E5E5 border. Focus: 2px #1CB0F6 border. Correct: 2px #58CC02 border with checkmark icon. Incorrect: 2px #FF4B4B border with shake animation.
- **Chips**: 32px height, 14px horizontal padding, 9999px border-radius. Skill: #58CC02 bg, white text. XP: #FFC800 bg, #3C3C3C text. Streak: #FF9600 bg, white text. Locked: #E5E5E5 bg, #777777 text.
- **Lists**: Skill tree vertical layout. Nodes 64px circles, connected by 4px lines. Complete: #58CC02 bg, crown icon. Current: #1CB0F6 bg, pulsing ring. Locked: #E5E5E5 bg, lock icon.
- **Checkboxes**: 24px square, 8px border-radius, 2px #E5E5E5 border, 3px bottom border #CECECE. Checked: #58CC02 bg, white checkmark, 3px #3C8C00 bottom border. Bouncy scale animation on check.
- **Tooltips**: White bg, #3C3C3C text at 14px, 12px border-radius, 12px 16px padding, 2px #E5E5E5 border. Speech-bubble style with triangle pointer. Used for hints and tips.
- **Navigation**: Bottom tab bar 60px height, white bg, top 2px #E5E5E5 border. 5 icons: Home (green house), Skills (dumbbell), Leagues (shield), Shop (gem), Profile (avatar). Active: #1CB0F6 fill, label shown.
- **Search**: 48px height, 16px padding, 12px border-radius, #F7F7F7 bg, magnifying glass icon. Focus: white bg, 2px #1CB0F6 border. Results show flag icon, language name, and level badge.

## Spacing
- Base unit: 4px
- Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80
- Component padding: Buttons 12px 24px, Cards 20px, Inputs 12px 16px
- Section spacing: 40px between major sections, 20px between related elements
- Container max width: 600px (lesson view), 1024px (dashboard)
- Card grid gap: 16px (lesson grid), 24px (skill nodes vertical)

## Border Radius
- 8px: Small inline elements, input fields
- 12px: Inputs, smaller chips, tags
- 16px: Buttons, cards, panels
- 24px: Hero cards, onboarding panels, large containers
- 9999px: Avatars, skill tree nodes, XP badges, pill chips

## Do's and Don'ts
- Do use the chunky bottom-border elevation style for buttons and interactive cards
- Do provide immediate visual feedback for every interaction (color change, animation, sound cue)
- Don't use thin, subtle elements; everything should feel bold and touchable
- Do use the gold (#FFC800) for reward-related elements (XP, gems, streaks) only
- Don't mix more than three accent colors in a single view
- Do use rounded shapes everywhere; sharp corners feel wrong in this system
- Don't forget the pressed state: translate down + reduced border for tactile feel
- Do celebrate success loudly: green flash, confetti, large checkmarks
- Don't use small text; minimum body size is 14px for accessibility and readability
- Do maintain the playful personality; even error states should feel encouraging, not punishing
