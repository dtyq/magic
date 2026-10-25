# Mise

## Overview
Mise is a design system for recipe apps, cooking platforms, and food storytelling. The aesthetic borrows from contemporary cookbook publishing: cream paper surfaces, paprika and olive accents, large photography, and an ingredient-list typography rhythm that mimics a well-set kitchen mise en place. The system serves two reading modes equally — leisurely browsing of a recipe magazine on a tablet, and hands-on cooking on a phone propped against a backsplash where step-by-step instructions need to read large and timers must hold attention. Mise leans editorial in browse contexts (serif headlines, generous gutters, big food photography) and shifts to functional in cook mode (single-step focus, large numerals, hold-screen-awake). Designed for cooks who follow recipes, not just admire them.

## Colors
- **Background** (#FDF6EC): Cream paper — the warm dominant page surface
- **Surface** (#F8EFE0): Card and panel surface, slightly more saturated
- **Surface Elevated** (#FFFFFF): Pure white for the active recipe canvas in cook mode
- **Surface Sunken** (#F0E5D2): Inset wells, ingredient lists, nutrition panels
- **Paprika** (#C2410C): Primary brand color — primary CTAs, active states, timer accents
- **Paprika Deep** (#9A3412): Hover and pressed states
- **Paprika Soft** (#FBE5D3): Background tint for ingredient highlights, selection
- **Olive** (#65A30D): Secondary accent — fresh ingredients, herbs, "added to basket"
- **Olive Deep** (#4D7C0F): Hover state on olive
- **Ink** (#1C1410): Primary text — a warm near-black with a touch of brown
- **Ink Muted** (#5C4E45): Secondary text, descriptions, recipe yield
- **Ink Subtle** (#8E8276): Metadata, cook time, source attribution
- **Ink Faint** (#BEB3A5): Disabled, placeholder, checked-off ingredients
- **Outline** (#E5D9C3): Card edges, divider lines
- **Outline Strong** (#C9B89A): Focused inputs, prominent separators
- **Success** (#65A30D): Completed step, fresh ingredient (same as olive)
- **Warning** (#D97706): Out of stock, expiring soon
- **Danger** (#B91C1C): Allergen alert, burn/overcook warning
- **Heat 1** (#FBBF24): Mild spice indicator — golden
- **Heat 2** (#F97316): Medium spice — orange
- **Heat 3** (#DC2626): Hot spice — red

## Typography
- **Display Serif**: GT Sectra (fallback Tiempos Headline, Source Serif) — used for recipe titles, feature headlines, chapter heads
- **Body Serif**: Source Serif 4 (fallback Charter, Georgia) — used for recipe descriptions, story copy, headnotes
- **Sans**: Inter (fallback Söhne) — used for UI, navigation, ingredient lists, instruction steps
- **Mono**: JetBrains Mono — used for timers, temperatures, and quantity columns where alignment matters

The typographic signature is the alternation between editorial serif (in browse and headnote contexts) and clean sans (in functional cooking contexts). Ingredient lists use sans with tabular figures on the quantity column so amounts align in a clean left column. Instructions use sans body at 17px in browse and scale to 22px in cook mode. Headnotes — the personal story above a recipe — use body serif italic to signal voice. Recipe titles use display serif at sizes up to 64px on hero feature pages.

Type scale: Display 64/68 (display serif, -0.02em), H1 44/52 (display serif), H2 28/36 (display serif), H3 20/28 (sans 600), Recipe Title 36/40 (display serif), Section Label 12/16 (sans caption uppercase 0.12em tracking), Body Serif 18/30 (body serif), Body Sans 16/26 (sans), Instruction Body 17/28 browse, 22/34 cook mode (sans), Ingredient 16/24 (sans tabular for quantity), Cook Timer 72/72 (mono 700 tabular), Temperature 28/32 (mono 600 tabular).

## Elevation
Mise treats surface like layered paper. Cards rest flat with a 1px outline border (#E5D9C3) and gain a warm shadow on hover (0 4px 16px rgba(28, 20, 16, 0.06)). Recipe hero photography sits flush with no border or shadow — the photo carries its own presence. The cook-mode active step gets an elevated white surface with a soft paprika shadow (0 8px 32px rgba(194, 65, 12, 0.08)) signaling focus. Timer popovers use a deeper shadow (0 16px 40px rgba(28, 20, 16, 0.18)) to read clearly over the recipe.

Border radius: 0 on full-bleed hero photography (editorial crops), 4px on small chips, 8px on buttons and inputs, 12px on cards and recipe modules, 20px on modals, 999px on tag pills and the cook timer's circular display.

## Components
- **Recipe Card**: The hero browse component. A 3:2 food photograph occupies the top with sharp corners and no border. Below: section label in caption uppercase paprika, recipe title in display serif 24-28px, a single-line description in body serif italic, and a meta row in sans small with cook time (mono), serving count, and a small olive heart icon for save. Hover lifts with a warm shadow.
- **Recipe Hero**: Full-width feature header on recipe detail pages. A 16:9 photograph at top, recipe title in 56-64px display serif over a cream gradient wash below the image, and a personal headnote in body serif italic at 19px below the title. A horizontal meta strip shows prep time, cook time, total time, serves, and difficulty — each separated by a paprika dot.
- **Ingredient List**: A two-column layout with quantity on the left (mono tabular) and ingredient name on the right (sans). Each ingredient is a tappable row with a small empty checkbox; tapping fills the checkbox with olive and strikes through the ingredient with ink-faint. Optional substitutions appear as italic ghost text below the primary ingredient.
- **Instruction Step**: A numbered step card in the recipe flow. Step number in display serif 28px on the left in a paprika-soft circle; instruction text in sans body to the right at 17px (browse) or 22px (cook mode). Inline timer chips (e.g., "8 min") embed within instructions — tapping starts the timer.
- **Cook Mode Single-Step**: A focused fullscreen view showing only the current step at 22px sans, an oversized timer if applicable, large "Previous" and "Next" buttons at the bottom edge, and a faint step counter "Step 4 of 9" at the top. The screen stays awake. Swipe gestures advance steps.
- **Timer**: The circular timer is the system's signature interactive element. A 240px circle with a paprika progress ring (8px stroke, sweeping counter-clockwise), the remaining time in mono 72px at the center, and "MINUTES" in caption below. Pause and reset controls sit beneath. Multiple timers can run concurrently in a stacked sidebar.
- **Spice Heat Indicator**: A row of small chili icons indicating spice level (1-3). Heat-1 mild golden, heat-2 medium orange, heat-3 hot red. Used on recipe cards and detail pages.
- **Dietary Tag**: 999px pill with sans caption uppercase 0.08em tracking. Variants: vegetarian (olive fill, white text), vegan (olive-deep), gluten-free (paprika-soft fill, paprika-deep text), dairy-free, nut-free. Allergen warnings use danger fill.
- **Saved/Heart Button**: A small heart icon, outline by default, filling with olive on tap. Toggles save-to-cookbook state with a soft 200ms fill animation.
- **Add to Shopping List**: A primary button with paprika fill that morphs to an olive "Added" state with a check icon for 1.2 seconds after tap before reverting.
- **Nutrition Panel**: A surface-sunken panel showing per-serving macros in a 2x4 grid. Each cell has the value in mono 18px and label in caption uppercase ink-subtle.
- **Print View Toggle**: A small icon button that switches the recipe detail into a print-optimized stylesheet — denser layout, black text on white, no photography, ingredient and instructions side-by-side.
- **Search & Filter Bar**: Sticky bar at the top of browse pages with a search input, dietary-filter pills, cook-time range, and a sort dropdown. Background uses surface with a 1px outline bottom border.

## Spacing
- Base unit: 4px
- Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128px
- Container max-width: 1280px with 32px horizontal padding (desktop)
- Recipe reading column: 680px for instruction body
- Card grid gap: 24px horizontal, 32px vertical
- Cook-mode tap-target minimum: 56px (greasy fingers, propped phones)
- Section spacing: 64px between major sections in browse, 48px in detail

## Motion
Motion in Mise is warm and unhurried. Standard duration is 240ms with cubic-bezier(0.4, 0, 0.2, 1) easing. Cards lift on hover over 240ms. The timer ring sweeps continuously at the rate of remaining seconds — never lurching. Ingredient checkboxes fill with olive over 200ms with a soft scale (0.95 → 1.0) bounce. Adding to the shopping list triggers a 280ms olive flash on the button before reverting. Step transitions in cook mode use a horizontal slide of 280ms. No motion during the cook process aside from active timers — visual stillness reduces distraction.

## Iconography
Custom outlined icon set at 1.5px stroke. The vocabulary is culinary: chef's knife, whisk, wooden spoon, mixing bowl, sauté pan, dutch oven, oven mitt, mortar and pestle, sprig of rosemary, citrus wedge, salt shaker, scale. Avoid generic "fork and knife" symbology. Icons are 20px default in ink-muted; paprika on active states; olive on completed states.

## Photography Guidance
Photography is the dominant visual element in browse contexts. Hero shots use overhead or 3/4 angles at golden-hour-equivalent warm light. Cookbook-style props (linen napkins, ceramic plates, raw ingredients in frame) are encouraged. Crops: 16:9 hero, 3:2 card thumbnail, 1:1 step photography in cook mode (optional). Never use stock food photography with flash, garnish-heavy plating, or restaurant-pass aesthetics. Mise photography reads as a home kitchen, not a studio.

## Voice and Tone
- Personal and specific. Headnotes read like a friend explaining why this recipe is worth your time.
- Use cookbook idiom: "Heat the oil until it shimmers," "Salt to taste," "Let it rest, uncovered, for ten minutes."
- Avoid generic food-blog filler ("This recipe is sure to be a hit!" — no).
- Cook-mode instructions are imperative and short. "Add the garlic. Stir for thirty seconds."
- Substitutions are encouraged: "No buttermilk? Use whole milk with a teaspoon of lemon juice."
- Empty states use kitchen idiom: "Your shopping list is empty," "Nothing on the stove right now."

## Do's and Don'ts
- Do let food photography dominate browse pages — large, warm, editorial
- Do use mono tabular figures for ingredient quantities so columns align cleanly
- Do scale instruction text up in cook mode — minimum 22px sans body
- Do treat paprika as the action color and olive as the success color — never swap them
- Do use serif italic for headnotes to mark personal voice
- Do support print stylesheet — paper cookbooks are still relevant
- Don't add gradients or glassmorphism — Mise is paper, not glass
- Don't use blue or cool gray accents — the entire palette is warm
- Don't crowd ingredients into wrapping prose paragraphs — always a two-column list
- Don't use food-blog tropes: countdown banners, "before you scroll past!" CTAs, autoplay video walls
- Don't put step navigation behind small icon buttons — cook-mode buttons are 56px minimum
- Don't allow the screen to dim or sleep during active cook mode
