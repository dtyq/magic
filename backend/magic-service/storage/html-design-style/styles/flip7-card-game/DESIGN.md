# Flip7 Design System

## Overview

Flip7 is a retro-playful, teal-coral-gold design system crafted for the Flip7 card game scoring mini-program. Inspired by the original Flip7 board game packaging, it blends vintage warmth with modern mobile UX. The visual language is bold, joyful, and tactile -- combining BounceBox's bubbly energy with QuizForge's competitive gamification patterns. Every element feels like a game piece you want to tap.

---

## Colors

- **Primary Teal** (#2BA8A2): Main UI, backgrounds, avatars, progress bars
- **Primary Light** (#3CC4BD): Hover states, lighter accents
- **Primary Dark** (#1E8C86): Deep backgrounds, text on light surfaces
- **Primary BG** (#E8F6F5): Subtle teal tint for backgrounds
- **Accent Gold** (#FFD23F): CTAs, highlights, first-player badges, celebrations
- **Accent Light** (#FFE47A): Soft gold tints, active states
- **Accent Dark** (#E6B800): Gold hover states, depth
- **Coral** (#EF6C4A): BOOM state, warnings, ranking #3, energy
- **Coral Light** (#FF8A6A): Soft coral tints
- **Coral Dark** (#D45233): Coral depth, hover
- **Cream** (#FFF8E7): Card backgrounds, input surfaces
- **Sky Blue** (#5DADE2): Flip7 bonus, info states
- **Surface Base** (#EFF8F7): Page background
- **Surface Card** (#FFFFFF): Card backgrounds
- **Success** (#27AE60): Positive states
- **Error** (#E74C3C): Error states

## Typography

- **Headline Style**: System font stack, extra-bold (800), generous letter-spacing (4-6rpx)
- **Body Font**: -apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei
- **Display**: 72rpx extra-bold
- **h1**: 48rpx extra-bold
- **h2**: 36rpx extra-bold
- **h3**: 32rpx bold
- **body**: 28rpx medium
- **sm**: 24rpx medium
- **xs**: 20rpx medium

---

## Spacing

Base unit: **8rpx**
- **xs**: 8rpx
- **sm**: 16rpx
- **md**: 24rpx
- **lg**: 32rpx
- **xl**: 48rpx

## Border Radius

- **sm** (8rpx): Small tags, inputs
- **md** (16rpx): Cards, buttons, inputs
- **lg** (24rpx): Feature cards, panels, scoring items
- **xl** (32rpx): Hero cards, modals, logo
- **round** (999rpx): Pill buttons, badges, rank badges

## Elevation -- Colored Glow System

- **shadow-sm**: 0 2rpx 8rpx black at 8%
- **shadow-md**: 0 4rpx 16rpx black at 12%
- **shadow-lg**: 0 8rpx 32rpx black at 16%
- **shadow-card**: 0 4rpx 20rpx teal at 10%
- **shadow-coral-glow**: 0 4rpx 20rpx coral at 35%
- **shadow-teal-glow**: 0 4rpx 20rpx teal at 30%
- **shadow-accent-glow**: 0 4rpx 20rpx gold at 40%
- **shadow-sky-glow**: 0 4rpx 16rpx sky-blue at 30%
- **shadow-focus**: 0 0 0 4rpx primary at 15%

## Components

### Logo (Setup Page Header)

Inspired by the original Flip7 board game packaging. Three layers:

#### Fan Cards Background
- 5 colored cards fanned out behind the text
- Rotation angles: -24deg, -12deg, 0deg, 12deg, 24deg

#### FLIP7 Text
- Entire text group rotated -3deg
- Wrapped in a cream-colored parallelogram background (skewX(-6deg) + dark border)
- "FLIP": 88rpx extra-bold, primary-dark, light text-shadow
- "7": 152rpx extra-bold, accent gold, rotated 4-6deg, multi-layer dark text-shadow stroke

#### Ribbon Banner
- Classic retro folded-ribbon style from the original packaging
- Main body: Cream background, 3rpx dark border
- Side tails: pseudo-elements extending behind (z-index: -1), offset top: 8rpx for 3D fold effect
- Tail color: slightly darker cream with matching border
- Text: primary-dark, extra-bold, letter-spacing 8rpx

### Buttons

Pill shape (999rpx radius), minimum 72rpx height, bounce transition curve.

#### Primary (Gold CTA)
- Gradient gold background, gloss overlay via ::before
- Shadow: shadow-accent-glow, Active: scale(0.95)

#### Counter Buttons (+/-)
- Rounded square (16rpx radius), 80rpx x 80rpx
- Minus: coral themed, Plus: teal themed

#### BOOM Button
- Active: coral fill, shadow-coral-glow, pulse animation

#### Flip7 Button
- Active: sky-blue fill, shadow-sky-glow

### Cards (Scoring Items)

White background, 24rpx radius, shadow-card, 6rpx colored left accent bar.
- Default: teal-light left border
- Highlighted: gold left border, golden gradient, shadow-accent-glow
- BOOM Active: coral left border, coral gradient, pulse animation

### Victory Rankings (2nd/3rd Place)

Tiered visual treatment for podium positions:
- Silver (2nd): 8rpx silver accent bar, silver gradient avatar (64rpx), medal emoji, enlarged score
- Bronze (3rd): 8rpx coral accent bar, coral gradient avatar (60rpx), medal emoji, coral score
- Others (4th+): Default styling, standard avatar (56rpx)

### Section Titles

- Emoji icon in view container (not text) for consistent alignment
- 3rpx dashed bottom border for playful feel

---

## Animations

### Confetti (Victory)
- 10 pieces, varied sizes/shapes/colors, 3.2-4.5s fall with rotation

### Crown Bounce
- 1.5s infinite, 4-step keyframe with rotation wobble

### Glow Pulse (Winner Card)
- 2s infinite, opacity 0.5-1.0, scale 1.0-1.03

### BOOM Pulse
- 2s infinite, border/shadow oscillation

---

## Do's and Don'ts

1. Do use colored glow shadows for interactive elements.
2. Do use pill-shaped buttons consistently.
3. Do use cream (#FFF8E7) for input surfaces.
4. Don't use plain black shadows on interactive elements.
5. Do celebrate game moments visually with matching brand colors.
6. Do use dashed borders for section dividers.
7. Don't make micro-interaction animations longer than 500ms.
8. Do use left-border color accents on cards for state communication.
9. Do ensure all touch targets are at least 72rpx.
10. Do use view (not text) for emoji containers in WeChat mini-programs.
11. Do use the retro folded-ribbon pattern for banner elements.
12. Don't rely on percentage heights in pseudo-elements inside flex children.
