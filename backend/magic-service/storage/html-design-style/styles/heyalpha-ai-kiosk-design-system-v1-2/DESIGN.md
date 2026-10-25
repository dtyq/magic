# HeyAlpha AI Kiosk Design System v1.2

## 0. System Intent

This design system is built for AI-driven, touchless, and conversational
food ordering interfaces, where UI dynamically adapts based on user
intent and context.

Primary use cases: - Voice-based food ordering\
- Kiosk interaction\
- Conversational UI systems

------------------------------------------------------------------------

## 1. Core Principles

-   Intent-driven UI → Interface adapts to user input\
-   Zero hesitation design → Reduce decision time\
-   Touchless-first interaction → Voice + minimal taps\
-   Instant feedback loops → Every action is visible\
-   Progressive disclosure → Show only relevant options

------------------------------------------------------------------------

## 2. Visual Foundations

### Colors

-   Primary: #8B5E3C (Brand)\
-   Interaction: #2BA8A2 (Active / Highlight)\
-   Accent: #FFD23F (CTA emphasis)\
-   Background: #F7F5F2 (Surface)

#### Semantic Colors

-   Success: #22C55E\
-   Error: #EF4444\
-   Warning: #F59E0B

------------------------------------------------------------------------

### Typography

#### Display (32--36px)

Order your favorite food instantly

#### Section (24px)

Choose your category

#### Body (16--18px)

Select items based on your preference

#### Caption (12--14px)

Quick, easy, and personalized ordering

------------------------------------------------------------------------

## 3. Interaction Primitives

### AI Trigger Button (Mic)

States: - Idle\
- Listening\
- Processing\
- Error

------------------------------------------------------------------------

### Dynamic Action Button

States: - Default\
- Loading\
- Disabled

------------------------------------------------------------------------

## 4. Adaptive Components

### AI Suggestion Card

-   Title\
-   Context tag\
-   Price\
-   CTA

------------------------------------------------------------------------

### Food Intelligence Card

Props: - id\
- name\
- image\
- price\
- tags\
- availability

------------------------------------------------------------------------

## 5. AI Interaction Patterns

User Input → AI → UI update

------------------------------------------------------------------------

## 6. Dynamic UI Rules

-   UI assembled from reusable components\
-   Based on intent and context

------------------------------------------------------------------------

## 7. Navigation Model

Discover → Select → Customize → Confirm

------------------------------------------------------------------------

## 8. Accessibility

-   Minimum 48px touch targets\
-   High contrast\
-   Voice-first

------------------------------------------------------------------------

## 9. Data Contracts

### FoodCard

-   id\
-   name\
-   price\
-   image\
-   tags\
-   availability

------------------------------------------------------------------------

## 10. System Philosophy

UI adapts to conversation, not fixed flows.
