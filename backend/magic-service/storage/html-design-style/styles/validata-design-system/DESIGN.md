# ValiData Design System

## Overview

ValiData is a precise operational design system for pharmacy expiration-date control. It supports mobile operators scanning products in-store and desktop managers monitoring PVPS cycles, risk bands, alerts, actions, teams, and audit history.

The visual language is clean, technical, and trustworthy: vivid blue actions, light neutral surfaces, white cards, clear dividers, strong status colors, and short operational copy. The UI should feel fast, auditable, and calm under pressure. It is not decorative, playful, or dashboard-heavy by default. Every element must help the user scan, verify, decide, resume, or review.

Mobile is the execution surface. Desktop is the management surface. Agents must adapt structure between them instead of stretching one layout into another.

---

## Colors

Use semantic tokens only. Do not hardcode raw hex values inside components when a token exists. Preserve both light and dark values. Keep `secondary` as the preferred spelling in new work; keep `secundary` aliases only for legacy compatibility.

### Light Theme

- **Primary** (`--primary`, #1B56FD): Main CTA fill, active navigation, scanner confirmation, high-priority links, strong brand interaction.
- **On Primary** (`--on-primary`, #FEFEFE): Text and icons placed on Primary.
- **Primary Container** (`--primary-container`, #E4E6F4): Soft selected states, calm brand cards, active list rows, low-emphasis CTA backgrounds.
- **On Primary Container** (`--on-primary-container`, #123BAF): Text and icons placed on Primary Container.

- **Secondary** (`--secondary`, #0118D8): Strong secondary brand emphasis, secondary navigation, supporting high-emphasis actions.
- **Secondary Container** (`--secondary-container`, #C0C5F0): Secondary selected states, supporting panels, secondary action backgrounds.
- **On Secondary Container** (`--on-secondary-container`, #08115C): Text and icons placed on Secondary Container.
- **Secundary Container Legacy Alias** (`--secundary-container`, #C0C5F0): Legacy alias for Secondary Container. Do not use in new naming unless required by existing code.
- **On Secundary Container Legacy Alias** (`--on-secundary-container`, #08115C): Legacy alias for On Secondary Container.

- **Tertiary** (`--tertiary`, #668EFF): Informational accent, secondary data emphasis, supporting visual highlight.
- **Tertiary Container** (`--tertiary-container`, #F4F5FB): Informational panels, neutral brand sections, calm helper backgrounds.
- **On Tertiary Container** (`--on-tertiary-container`, #5B7DDD): Text and icons placed on Tertiary Container.

- **Surface** (`--surface`, #F4F4F4): App background, page canvas, neutral outside area.
- **Surface Container** (`--surface-container`, #FEFEFE): Cards, sheets, inputs, dialogs, tables, panels, and elevated surfaces.
- **Surface Frosted** (`--surface-frosted`, #F4F4F480): Translucent headers, scanner overlays, temporary frosted layers.
- **On Surface** (`--on-surface`, #2B2B2B): Primary text, titles, high-priority labels, main content.
- **On Surface Variant** (`--on-surface-variant`, #5E5F6D): Secondary text, metadata, helper text, placeholders, low-emphasis labels.

- **Outline** (`--outline`, #D0D0D0): Standard borders, dividers, input strokes, table separators, disabled outlines.
- **Outline Variant** (`--outline-variant`, #A8A9B3): Stronger separators, emphasis borders, selected/hover border support.

- **Success** (`--success`, #58E482): Confirmed scan, resolved alert, completed PVPS task, accepted receiving, completed action.
- **On Success** (`--on-success`, #2B2B2B): Text and icons placed on Success.
- **Success Container** (`--success-container`, #DCF9E5): Soft success cards, resolved badges, completed state backgrounds.
- **On Success Container** (`--on-success-container`, #13743F): Text and icons placed on Success Container.

- **Error** (`--error`, #F02B2B): Expired product, destructive action, failed validation, blocked receiving, critical loss state.
- **Error Container** (`--error-container`, #FFF4F4): Soft critical background, error panels, destructive warning surfaces.
- **On Error Container** (`--on-error-container`, #6C1111): Text and icons placed on Error Container.

- **Caution** (`--caution`, #FFB009): Pending work, moderate attention, unresolved checks, review-needed state.
- **Caution Container** (`--caution-container`, #FFF5E4): Soft caution panels, pending badges, moderate-risk cards.
- **Caution On Surface** (`--caution-on-surface`, #9D833C): Caution text/icons on light surfaces.

- **Warning** (`--warning`, #FA5F0C): Urgent operational risk, approaching deadline, action required soon, transfer mismatch.
- **Warning Container** (`--warning-container`, #FFEADE): Soft warning panels, urgent cards, deadline warnings.
- **On Warning Container** (`--on-warning-container`, #AD4E1B): Text and icons placed on Warning Container.

- **Scrim** (`--scrim`, #2B2B2BCC): Overlay behind bottom sheets, dialogs, drawers, and camera decision layers.

### Dark Theme

- **Primary** (`--primary`, #C0C5F0): Main CTA fill, active navigation, scanner confirmation, high-priority links, strong brand interaction.
- **On Primary** (`--on-primary`, #2B2B2B): Text and icons placed on Primary.
- **Primary Container** (`--primary-container`, #282A32): Soft selected states, calm brand cards, active list rows, low-emphasis CTA backgrounds.
- **On Primary Container** (`--on-primary-container`, #D7DAF4): Text and icons placed on Primary Container.

- **Secondary** (`--secondary`, #668EFF): Strong secondary brand emphasis, secondary navigation, supporting high-emphasis actions.
- **Secondary Container** (`--secondary-container`, #495274): Secondary selected states, supporting panels, secondary action backgrounds.
- **On Secondary Container** (`--on-secondary-container`, #C0C5F0): Text and icons placed on Secondary Container.
- **Secundary Container Legacy Alias** (`--secundary-container`, #495274): Legacy alias for Secondary Container. Do not use in new naming unless required by existing code.
- **On Secundary Container Legacy Alias** (`--on-secundary-container`, #C0C5F0): Legacy alias for On Secondary Container.

- **Tertiary** (`--tertiary`, #D8DFFD): Informational accent, secondary data emphasis, supporting visual highlight.
- **Tertiary Container** (`--tertiary-container`, #1F2128): Informational panels, neutral brand sections, calm helper backgrounds.
- **On Tertiary Container** (`--on-tertiary-container`, #F4F5FB): Text and icons placed on Tertiary Container.

- **Surface** (`--surface`, #181818): App background, page canvas, neutral outside area.
- **Surface Container** (`--surface-container`, #2B2B2B): Cards, sheets, inputs, dialogs, tables, panels, and elevated surfaces.
- **Surface Frosted** (`--surface-frosted`, #5E5F6D80): Translucent headers, scanner overlays, temporary frosted layers.
- **On Surface** (`--on-surface`, #FEFEFE): Primary text, titles, high-priority labels, main content.
- **On Surface Variant** (`--on-surface-variant`, #F4F4F4): Secondary text, metadata, helper text, placeholders, low-emphasis labels.

- **Outline** (`--outline`, #5E5F6D): Standard borders, dividers, input strokes, table separators, disabled outlines.
- **Outline Variant** (`--outline-variant`, #43444B): Stronger separators, emphasis borders, selected/hover border support.

- **Success** (`--success`, #0AAC53): Confirmed scan, resolved alert, completed PVPS task, accepted receiving, completed action.
- **On Success** (`--on-success`, #FEFEFE): Text and icons placed on Success.
- **Success Container** (`--success-container`, #213728): Soft success cards, resolved badges, completed state backgrounds.
- **On Success Container** (`--on-success-container`, #DCF9E5): Text and icons placed on Success Container.

- **Error** (`--error`, #EE4343): Expired product, destructive action, failed validation, blocked receiving, critical loss state.
- **Error Container** (`--error-container`, #351111): Soft critical background, error panels, destructive warning surfaces.
- **On Error Container** (`--on-error-container`, #FFF4F4): Text and icons placed on Error Container.

- **Caution** (`--caution`, #F9C045): Pending work, moderate attention, unresolved checks, review-needed state.
- **Caution Container** (`--caution-container`, #9D833C): Soft caution panels, pending badges, moderate-risk cards.
- **Caution On Surface** (`--caution-on-surface`, #FFF5E4): Caution text/icons on dark surfaces.

- **Warning** (`--warning`, #FF8543): Urgent operational risk, approaching deadline, action required soon, transfer mismatch.
- **Warning Container** (`--warning-container`, #AD4E1B): Soft warning panels, urgent cards, deadline warnings.
- **On Warning Container** (`--on-warning-container`, #FFEADE): Text and icons placed on Warning Container.

- **Scrim** (`--scrim`, #F4F4F4CC): Overlay behind bottom sheets, dialogs, drawers, and camera decision layers.

### Color Rules

1. **Do** use Primary for the most important action in a section.
2. **Do** use Primary Container for selected or active states that should not feel aggressive.
3. **Do** use Success, Caution, Warning, and Error only when they carry operational meaning.
4. **Do** pair every status color with text, icon, count, or explanation.
5. **Don't** use red, warning, or caution as decorative accent colors.
6. **Don't** create gradients from the brand colors unless the source component already uses them.
7. **Don't** rely on color alone to show expiry risk, PVPS completion, or product status.
8. **Don't** change these tokens to improve a single screen; adjust layout or component hierarchy first.

---

## Typography

- **Display Font**: Space Grotesk.
- **Title Font**: Space Grotesk.
- **Body Font**: Manrope.
- **UI Font**: Manrope.
- **Fallback Font Stack**: system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif.

Use Space Grotesk for screen titles, major headings, onboarding hero copy, marketing moments, and high-level dashboard headings. Use Manrope for operational UI: body text, labels, inputs, lists, tables, buttons, chips, metadata, helper text, and form copy.

- **extraDisplay96dp**: Space Grotesk 96px, 700, 128px line height.
- **displayLarge57dp**: Space Grotesk 57px, 700, 64px line height.
- **displayMedium45dp**: Space Grotesk 45px, 700, 52px line height.
- **displaySmall36dp**: Space Grotesk 36px, 700, 44px line height.
- **headlineLarge32dp**: Space Grotesk 32px, 700, 40px line height.
- **headlineMedium28dp**: Space Grotesk 28px, 600, 36px line height.
- **headlineSmall24dp**: Space Grotesk 24px, 400, 32px line height.
- **titleLarge22dp**: Space Grotesk 22px, 700, 28px line height.
- **titleMedium16dp**: Space Grotesk 16px, 600, 24px line height.
- **titleSmall14dp**: Space Grotesk 14px, 600, 20px line height.
- **bodyLarge16dp**: Manrope 16px, 500, 24px line height.
- **bodyMedium14dp**: Manrope 14px, 400, 20px line height.
- **bodySmall12dp**: Manrope 12px, 400, 16px line height.
- **labelLarge14dp**: Manrope 14px, 600, 20px line height.
- **labelMedium12dp**: Manrope 12px, 600, 16px line height.
- **labelSmall11dp**: Manrope 11px, 600, 16px line height.

### Typography Rules

1. **Do** use Space Grotesk for hierarchy and brand presence.
2. **Do** use Manrope for all dense operational information.
3. **Do** keep field labels, table labels, nav labels, and button labels in label styles.
4. **Do** use body styles for instructions, explanations, descriptions, and helper copy.
5. **Don't** use display styles inside scanner flows unless it is an onboarding or empty state.
6. **Don't** shrink operational text below 12px.
7. **Don't** use light weights for warnings, errors, product names, dates, quantities, or destructive actions.
8. **Don't** use more than three type sizes inside a compact mobile section.

---

## Spacing

Base unit: 4px. All margin, padding, gap, inset, and layout spacing must snap to this grid. 24px is a common spacing value, not the base unit.

- **sp-1**: 4px.
- **sp-2**: 8px.
- **sp-3**: 12px.
- **sp-4**: 16px.
- **sp-5**: 20px.
- **sp-6**: 24px.
- **sp-8**: 32px.
- **sp-10**: 40px.
- **sp-12**: 48px.
- **sp-16**: 64px.
- **sp-20**: 80px.
- **sp-24**: 96px.

- **Mobile screen padding**: 16px compact, 20px large mobile.
- **Tablet screen padding**: 24px.
- **Desktop panel padding**: 24px to 32px.
- **Component padding**: small 8px/12px, medium 10px/16px, large 12px/24px.
- **Section spacing**: 24px mobile, 32px tablet, 48px desktop.
- **Card grid gap**: 12px compact lists, 16px standard mobile, 20px to 24px desktop.
- **Bottom sheet padding**: 24px top/horizontal and 32px bottom when the action area is fixed.
- **Scanner overlay spacing**: keep at least 16px between capture target, instructions, and actions.

### Spacing Rules

1. **Do** use 4px increments for every spacing decision.
2. **Do** give critical decisions more breathing room than passive content.
3. **Do** keep dense operational lists compact but tappable.
4. **Don't** use irregular spacing values such as 6px, 10px, 14px, 18px, 22px, 26px, 28px, 56px, or 128px unless matching an existing native height.
5. **Don't** create oversized whitespace in scanner or task flows.
6. **Don't** use desktop spacing on mobile cards.

---

## Border Radius

- **radius-xs** (4px): Tiny tags, progress segments, inline indicators.
- **radius-sm** (8px): Badges, compact chips, small controls.
- **radius-md** (12px): Buttons, inputs, selects, search fields, compact list cards.
- **radius-lg** (16px): Standard cards, panels, scanner instruction cards, empty-state blocks.
- **radius-xl** (20px): Bottom-sheet top corners, large cards, action panels.
- **radius-2xl** (24px): Onboarding cards, large modal shells, desktop summary panels.
- **radius-full** (999px): Pills, avatars, status dots, circular icon buttons, progress bars.

### Radius Rules

1. **Do** keep buttons and fields in the same radius family.
2. **Do** make cards softer than inputs.
3. **Do** use full pill radius for status chips and round icon buttons.
4. **Don't** mix many radius values inside the same component group.
5. **Don't** use sharp square corners for primary app surfaces.
6. **Don't** use exaggerated radius on dense desktop tables.

---

## Elevation

ValiData uses quiet elevation. Hierarchy comes from surface contrast, border, spacing, and state color before shadows.

- **shadow-none**: Most cards, lists, inputs, tables, and static surfaces.
- **shadow-card**: Very subtle card separation, `0 1px 2px rgba(43, 43, 43, 0.06)`.
- **shadow-hover**: Desktop hover only, `0 8px 24px rgba(43, 43, 43, 0.10)` with -2px lift.
- **shadow-sheet**: Bottom sheets and modal panels, `0 -12px 32px rgba(43, 43, 43, 0.16)`.
- **focus-ring**: Primary focus ring, `0 0 0 3px rgba(27, 86, 253, 0.18)`.

### Elevation Rules

1. **Do** use borders and spacing before shadows.
2. **Do** use scrim plus panel elevation for blocking decisions.
3. **Do** reserve hover lift for desktop interactive cards.
4. **Don't** use heavy shadows on static cards.
5. **Don't** blur scanner content in a way that harms camera readability.
6. **Don't** use shadow as the only focus indicator.

---

## Components

### Buttons

#### Primary
Primary uses `--primary` fill, `--on-primary` text, 12px radius, labelLarge text, 20px optional leading icon, and medium/semibold weight. It is used for the dominant action: Start PVPS, Scan product, Confirm date, Save action, Resume cycle. Hover on desktop: slightly darker/tinted primary or shadow-hover. Pressed: compact tint or slight scale. Focus: primary focus ring. Only one filled primary button may appear in the same decision area.

#### Secondary
Secondary uses `--secondary-container` fill with `--on-secondary-container` text or transparent fill with 1px `--outline` border. Same 12px radius as Primary. Use for supporting actions: Review, Add manually, View details, Change filter. Hover: border or background moves toward `--primary-container`. Focus: primary ring. Do not compete visually with Primary.

#### Ghost
Ghost uses transparent background, no border, `--primary` or `--on-surface` text, and 8px to 12px radius for hover target. Use for low-emphasis actions such as Cancel, Back, See all, Clear filter. Hover: `--primary-container` or subtle surface tint. Do not use Ghost for destructive or critical actions.

#### Destructive
Destructive uses `--error` fill with `--on-primary` or readable inverse text for irreversible actions. Lower-emphasis destructive actions may use transparent background, `--error` text, and 1px error border. Always name the object affected: product, batch, lot, store, or action. Hover: stronger error emphasis. Focus: error border plus visible ring. Do not label destructive buttons as generic Confirm.

#### Sizes
Small: 32px height, 8px/12px padding, labelMedium. Medium: 40px height, 10px/16px padding, labelLarge. Large: 48px height, 12px/24px padding, labelLarge. Critical scanner actions: 52px to 56px height, full width on mobile. Disabled: muted surface/container, readable disabled text, no shadow, disabled cursor, and helper reason when not obvious.

---

### Icon Buttons

#### Default
40px x 40px minimum, 44px x 44px preferred on mobile, circular or 12px rounded shape. Transparent fill by default, 20px to 24px icon, `--on-surface` icon color. Hover: `--primary-container`. Selected: `--primary-container` fill and `--on-primary-container` icon. Focus: primary ring.

#### Critical
Critical icon buttons use `--error-container` background and `--on-error-container` icon only when the icon represents a destructive action. Pair destructive icon buttons with visible copy or confirmation. Never use icon-only controls for irreversible actions without accessible name and confirmation.

---

### Cards

#### Default
`--surface-container` fill, 1px `--outline` border, 16px radius, no shadow by default, 16px padding on mobile and 20px to 24px on desktop. Use for tasks, products, summaries, form groups, OCR confirmation blocks, and compact status modules.

#### Interactive
Same as Default, with pointer cursor on desktop. Hover: lift -2px, `--shadow-hover`, and slightly stronger border. Pressed: return to flat and apply subtle surface tint. Mobile uses pressed/tap feedback only, not hover.

#### Status Card
Uses semantic container fill only when the full card represents one status. Success cards use `--success-container`; caution cards use `--caution-container`; warning cards use `--warning-container`; error cards use `--error-container`. Include icon, label, and explanation. Do not create colorful cards for decoration.

#### Desktop Panel Card
`--surface-container` fill, 1px outline, 20px to 24px radius, 24px padding. Use in dashboards, policy configuration, cycle overview, and audit summaries. Pair with filters, detail links, or table drill-down where possible.

---

### Action Cards

#### Default
Action cards transform risk into a next step. Use `--surface-container` fill, 1px outline border, 16px radius, 16px padding, status badge at top, product/batch detail in the middle, and one dominant CTA at the bottom or right side. Mobile layout is vertical; desktop layout may be horizontal.

#### Expiry Action
Use semantic emphasis based on urgency. Discount/offer uses caution or primary support. Transfer uses warning when urgent or tertiary when informational. Discard uses error. Vendor negotiation uses warning or caution depending on severity. Always show product name, expiry date, quantity, lot if available, previous action if any, and recommended action.

#### Resolved
Resolved action cards use success-container badge, lower visual weight, and a visible history link. They should not disappear from history, but they should leave active queues when fully resolved.

---

### Product Cards

#### Default
`--surface-container` fill, 1px outline border, 16px radius, 12px to 16px padding. Product image or placeholder at 56px to 64px on the left, product name as title, barcode/internal code as metadata, and expiry/status chip on the right or below. Use bodyMedium for metadata and titleSmall/titleMedium for product name.

#### Risk Product
Use a semantic chip and a short risk sentence. Error for expired, warning for urgent action, caution for pending review, success for resolved/verified. Do not color the entire card unless the product itself is in a critical state.

#### Placeholder
Image placeholder uses `--tertiary-container` or `--surface` fill, 12px to 16px radius, centered product icon, no gradient, and no fake photo styling. Placeholder must clearly look like missing media.

---

### Metric Cards

#### Default
`--surface-container` fill, 1px outline, 16px to 24px radius, 20px to 24px padding. Title uses titleSmall, value uses headlineMedium or headlineLarge, helper caption uses bodySmall/bodyMedium. Use for PVPS completion, unresolved alerts, loss at risk, resolved actions, operator productivity, and cycle deadlines.

#### Semantic
Blue/primary for neutral productivity and progress. Green for resolved/completed/avoided loss. Caution/warning for pending risk or upcoming deadline. Red for expired, rejected, or loss states. Metrics must link to filtered data when possible. Do not show vanity metrics without operational use.

---

### Inputs

#### Default
`--surface-container` fill, 1px `--outline` border, 12px radius, 48px minimum height, 12px/16px padding, bodyMedium text, visible label above, helper text below when needed. Placeholder uses `--on-surface-variant` and never replaces the label.

#### Focus
Border changes to `--primary` and receives `--focus-ring`. Keep the label visible and stable. Do not move labels in ways that hide field meaning.

#### Error
Border changes to `--error`; helper text uses `--error` or `--on-error-container` depending on background. Message must explain recovery: correct date, add missing lot, enter valid GTIN, choose reason, or retry upload.

#### Disabled
Muted surface fill, outline border, readable text, no pointer interaction. Explain why the input is disabled when the reason is not obvious.

---

### Search Fields

#### Default
48px height, 12px radius, `--surface-container` fill, 1px outline, left search icon, bodyMedium text, and optional clear button on the right. Desktop search can be wide and paired with filters. Mobile search must not hide the primary PVPS action.

#### With Filters
When search is paired with filters, chips sit below or beside the field. Selected filters use `--primary-container` and `--on-primary-container`. Filtered-empty state must say no results matched the current filters.

---

### Selects and Dropdowns

#### Select Field
Same visual treatment as Inputs: 48px height, 12px radius, surface-container fill, outline border, visible label, bodyMedium value, trailing chevron. Focus uses primary border and focus ring.

#### Menu
`--surface-container` fill, 12px radius, 1px outline, no heavy shadow, compact rows with 12px/16px padding. Selected option uses `--primary-container` and `--on-primary-container`. Long product/store lists require search; do not use plain dropdowns for large datasets.

---

### Chips and Badges

#### Filter Chip
Pill or 8px rounded shape, neutral surface fill, 1px outline, labelMedium text, 4px/12px padding. Active: `--primary-container` fill, `--on-primary-container` text, primary-tinted border. Hover: subtle background tint.

#### Status Badge
Pill shape, labelSmall or labelMedium, 2px/10px or 4px/12px padding. Success: success-container fill and on-success-container text. Caution: caution-container fill and caution-on-surface text. Warning: warning-container fill and on-warning-container text. Error: error-container fill and on-error-container text. Always include a word such as Expired, Pending, Transferred, Resolved, Discarded, or Review.

#### Count Badge
Circular or pill badge, primary or semantic container fill, labelSmall text. Use for task counts, alert counts, and pending quantities. Do not use count badges without nearby label context.

---

### Lists

#### Default
Stacked rows, transparent or surface-container background, 12px to 16px vertical padding, 16px horizontal padding, 1px divider or 8px to 12px row gap. Primary content left, status/count/action right. Minimum tap target 44px; prefer 48px.

#### Task List
Rows show product/task title, current status, deadline or last scan, and quick action. Pending and completed groups must be visually distinct. Do not hide unfinished tasks behind filters by default.

#### History List
Use concise rows with action count, action type, date, and actor when relevant. Avoid repeated long paragraphs. Example summaries: 12 discount alerts, 10 transfer alerts, 21 discard alerts, 22 vendor negotiation alerts.

---

### Tables

#### Desktop Table
Desktop/tablet only. Use sticky header, surface-container background, 1px dividers, 12px to 16px cell padding, bodyMedium cells, labelMedium headers, row hover, selected row state, and trailing row actions. Use for cycles, batches, alerts, stores, operators, policies, and audit history.

#### Filtered Table
Filters sit above the table, not hidden in row menus. Include search, status filter, date range, store/team filter, and clear filter action when relevant. Empty state must explain whether there is no data or no filtered result.

#### Mobile Alternative
Never force dense tables into compact mobile. Convert into cards, grouped lists, or drill-down sheets.

---

### Checkboxes, Radio Buttons, and Switches

#### Checkboxes
20px x 20px, 2px outline border, 4px radius, white/surface unchecked background, primary checked fill, readable checkmark. Label sits beside the control and is tappable. Use for multi-select, batch actions, and optional checklist steps.

#### Radio Buttons
20px x 20px circular control, outline border, primary selected dot. Use for one-of-many choices such as date precision, destination status, or policy scope.

#### Switches
Use primary/secondary state for on and surface/outline for off. Use switches for persistent preferences only. Do not use switches for one-time destructive decisions.

---

### Navigation

#### Bottom Navigation
Mobile only. 3 to 5 destinations, 56px to 64px height, 24px icon, labelSmall text, active state in primary/secondary. Use for main operator areas such as Home, Tasks, Scan, Actions, Profile. Do not include rare admin features.

#### Top App Bar
56px mobile height, 64px desktop height, surface or surface-frosted background, optional 1px bottom border, titleMedium/titleLarge, store context when useful, and up to two visible actions on mobile. Move secondary actions into filters or overflow menus.

#### Sidebar
Desktop management navigation. 240px to 280px width, surface-container background, icon + label rows, selected state with primary-container, clear grouping for dashboard, cycles, products, alerts, policies, team, and audit. Do not reuse mobile bottom nav on desktop.

---

### Scanner and Camera Flow

#### Scanner Screen
Full camera preview, centered capture guide, short instruction card, torch/help actions, manual entry fallback, and fixed bottom action area. Capture guide must stay clear of controls. Instructions use bodyMedium and must be short. Primary action is thumb-accessible.

#### Barcode Step
Show scan target, product context when known, and fallback button for manual code entry. If barcode fails, provide retry and manual entry without leaving the flow.

#### Expiration OCR Step
Show OCR capture target, detected date feedback, and confidence state. Low-confidence OCR opens confirmation/edit flow. Do not save uncertain OCR silently.

#### Camera Permission State
Use an empty/error state with title, explanation, and action to open settings or continue manually. Do not show a blank camera area.

---

### OCR Result Confirmation

#### Default
Mobile uses bottom sheet; desktop uses side panel or modal. Show detected date as the visual focus, confidence/uncertainty, evidence preview when useful, and two clear actions: Confirm date and Edit date.

#### Low Confidence
Use caution container, explain the uncertainty, and require user confirmation or edit. Do not restart the full scan when only one field needs correction.

#### Conflict
Use warning or error based on severity. Show previous value, new detected value, product/batch context, and action choices. Keep conflict resolution auditable.

---

### Manual Date Entry

#### Default
Use segmented precision choice: Month/Year and Day/Month/Year. Use masked inputs, visible format hint, helper text, and fixed save action. Form uses 48px fields and 12px radius.

#### Month/Year
When only month/year is entered, store the precision explicitly. Do not invent a day silently. UI copy must state how the system treats missing day information.

#### Validation
Invalid date shows field-level error. Future/past policy conflicts show warning or error depending on rule. Keep correction inside the same flow.

---

### Forms

#### Default
Visible labels, helper text, grouped sections, 16px to 24px section gaps, 48px inputs, and sticky action area on long mobile forms. Use masks for dates, quantities, GTIN, monetary values, and policy thresholds.

#### Manager Override
Use explicit reason field, affected product/batch, responsible user, timestamp, and confirmation action. Destructive/override forms must be auditable.

#### Policy Forms
Use clear threshold controls, previews, and warnings when the chosen policy creates operational risk. Do not let users save ambiguous action bands.

---

### Bottom Sheets

#### Default
Mobile contextual decision panel, `--surface-container` fill, scrim overlay, 20px top corner radius, 24px padding, titleLarge/titleMedium title, bodyMedium explanation, and fixed action area. Primary action resolves the situation. Secondary action goes back or edits.

#### Expired Product Sheet
Use error or warning emphasis. State that the product is expired, show product/batch/date, show previous warnings/actions when present, and offer safe next actions: discard or negotiate with vendor. Do not ask the user to confirm the expiration itself.

#### Transfer Mismatch Sheet
Use warning emphasis. Explain that the batch was marked for inter-store transfer and should not be in the current store. Provide actions: confirm still in store, mark transfer completed, or report mismatch.

---

### Dialogs

#### Default
Blocking decision panel, 24px radius, surface-container fill, concise title, consequence copy, and named actions. Use for destructive confirmations, manager overrides, role/permission issues, and irreversible changes.

#### Destructive
Must name the affected product, batch, lot, store, or policy. Use destructive button style. Do not use generic OK/Confirm labels.

---

### Toasts and Snackbars

#### Default
Short feedback only: scan saved, action completed, cycle resumed, label copied. 12px radius, bodyMedium text, optional undo or view action, short duration.

#### Not Allowed
Do not use toast/snackbar for expired-product warnings, required decisions, destructive confirmations, manager override, or long explanations.

---

### Empty States

#### Default
Centered or card-based block, simple icon/illustration, titleLarge/titleMedium title, one bodyMedium explanation, and one next action. Use for no pending PVPS tasks, no products at risk, no filtered results, no audit entries, or no imported invoice items.

#### Operational Empty
If the empty state means work is complete, use success language and optionally show next cycle info. If filters caused the empty state, offer Clear filters.

---

### Loading and Skeletons

#### Skeleton
Use skeleton cards/rows that preserve layout for lists, dashboards, tables, and product cards. Do not replace a whole screen with a spinner when only one region is loading.

#### Action Loading
Buttons keep width stable and replace icon/label area with spinner or inline progress. Use for OCR processing, saving scan, importing XML, syncing offline work, generating cycle, and submitting action.

---

### Tooltips and Helper Text

#### Helper Text
Persistent guidance below fields, bodySmall text, `--on-surface-variant` color. Use for date precision, policy threshold meaning, GTIN format, and reason fields.

#### Tooltip
Desktop secondary explanation only. Surface-container fill, 12px radius, 1px outline, bodySmall text, 260px max width. Tooltips must not contain critical instructions required to complete a task. On mobile, use inline helper text or bottom-sheet explanation.

---

### Icons

#### Standard
Use one consistent icon family. Standard UI icons are 20px to 24px. Metadata icons are 16px. Empty-state/action icons are 28px to 32px. Icons inherit text color unless communicating semantic status.

#### Critical
Icons reinforce meaning but never replace labels for critical actions. Destructive, warning, and scan-confirmation icons require accessible names and visible context.

---

## Product Patterns

### PVPS Task List
Pending and completed tasks must be separated clearly. Show cycle deadline, total expected products, completed count, pending count, and resume state. Each row/card shows product identity, status, last activity, and quick action. Do not hide unfinished work behind filters by default.

### PVPS Cycle Progress
Use linear progress with 8px height and full radius. Always show numeric context: completed, pending, total, and deadline. Success fill means complete/resolved. Warning/caution means deadline or risk. Do not imply completion before all required products are verified or explicitly skipped.

### Expiry Action Flow
Show recommended action, why the product reached that action, product name, lot, quantity, expiration date, previous history, and destination status. Keep unresolved alerts visible until the action is completed.

### Expired Product Found During Scan
State that the product is expired. Show whether it was warned before and whether an action was already registered. Offer discard or vendor negotiation. If it was marked as transferred but appears again, show transfer mismatch warning. Do not ask for meaningless confirmation.

### Action History
Use concise, count-first summaries. Examples: 12 discount alerts, 10 transfer alerts, 21 discard alerts, 22 vendor negotiation alerts. Keep detailed audit available behind Review details.

### Receiving and XML Invoice
Show expected products from the invoice. Let users scan barcode and expiration date. Flag products outside policy thresholds. Manager override requires explicit reason. Unknown products are marked as needing confirmation.

---

## Layout

### Mobile
Single-column. Bottom navigation. Cards and grouped lists. Bottom sheets for decisions. Primary actions near thumb. Scanner and OCR flows must remain interruption-safe. No dense dashboards or tables.

### Tablet
Two-column where useful. Task list and detail side by side. Side panels for product/action detail. Keep touch targets large. Do not simply scale mobile cards.

### Desktop
Sidebar or structured top navigation. Use dashboards, filters, tables, detail panels, batch actions, audit history, and constrained forms. Do not stretch mobile screens. Keep management density readable.

### Breakpoints
Compact below 600px. Medium from 600px to 904px. Expanded from 904px to 1240px. Large desktop above 1240px. Compact uses cards and bottom navigation. Expanded uses sidebar, panels, tables, and split views.

---

## States

### Default
Calm surface-container cards, readable text, restrained blue accents.

### Hover
Desktop only. Border tint, subtle background tint, or -2px lift with shadow-hover. Mobile must not depend on hover.

### Pressed
Immediate feedback through tint, opacity, or slight scale. Avoid exaggerated motion.

### Focus
Visible primary focus ring. Keyboard users must navigate all controls. Focus order follows visual order.

### Selected
Primary-container or secondary-container fill, clear label, icon, or state marker.

### Disabled
Lower emphasis but readable. Explain unavailable critical actions when the reason is not obvious.

### Loading
Skeletons for structure, spinners for actions, progress for import/sync/OCR. Avoid blank screens.

### Empty
Explain what is missing and provide the next action when possible.

### Error
Explain what failed, why it matters, and how to recover.

### Success
Confirm completion and help the user continue the workflow quickly.

### Warning
Show risk, deadline or mismatch, and recommended next step.

### Offline
Preserve captured work locally when possible and show sync status clearly.

---

## Motion

Default transitions: 150ms to 200ms. Bottom sheets: 200ms to 250ms. Scanner feedback: immediate. Progress changes: 200ms to 300ms. Respect reduced motion. Do not use long decorative animation in operational flows.

---

## Accessibility

Minimum touch target is 44px x 44px; prefer 48px x 48px on mobile. Text must meet contrast requirements against its background. Status must not rely on color alone. Inputs need visible labels. Error messages must be connected to the field. Icon buttons need accessible names. Bottom sheets and dialogs trap focus while open and restore focus on close. Tables need meaningful headers. Charts need labels, legends, and non-color interpretation.

---

## UX Writing

Tone is direct, calm, and operational. Use short sentences, verbs for actions, specific product/date information, clear consequences, and practical recovery instructions.

Preferred labels: Start PVPS, Resume cycle, Scan product, Confirm date, Edit date, Add lot, Mark as discounted, Mark as transferred, Mark as discarded, Negotiate with vendor, Review action, Report mismatch.

Do not use vague labels like OK, Confirm, Continue, or Done when the action is risky. Name the real action.

---

## Do's and Don'ts

1. **Do** use Primary blue for main actions, active states, and scanner confirmation.
2. **Do** use the 4px spacing grid for all padding, margin, gaps, and layout rhythm.
3. **Do** use Space Grotesk for headings and Manrope for dense interface text.
4. **Do** keep cards flat, bordered, and highly readable.
5. **Do** describe every status with text plus color and icon when useful.
6. **Do** keep scanner flows short, visible, recoverable, and thumb-accessible.
7. **Do** offer manual entry whenever OCR or barcode capture can fail.
8. **Do** separate verified data from estimated data.
9. **Do** preserve previous actions, audit events, and manager overrides.
10. **Do** use mobile cards and bottom sheets for execution flows.
11. **Do** use desktop tables, filters, panels, and batch actions for management flows.
12. **Do** make unresolved risk visible until it is resolved.
13. **Don't** change color tokens or typography tokens.
14. **Don't** hardcode raw hex values inside components.
15. **Don't** create decorative gradients, random illustrations, or heavy shadows.
16. **Don't** use tables for compact mobile task execution.
17. **Don't** use cards as the main structure for dense desktop datasets.
18. **Don't** hide required actions in overflow menus.
19. **Don't** show destructive actions without clear consequence copy.
20. **Don't** use generic labels for discard, transfer, override, or negotiation.
21. **Don't** silently overwrite PVPS data or OCR conflicts.
22. **Don't** delete audit history as a UI shortcut.
23. **Don't** rely on color alone for expired, pending, transferred, or resolved states.
24. **Don't** create a new component when an existing pattern already solves the job.
