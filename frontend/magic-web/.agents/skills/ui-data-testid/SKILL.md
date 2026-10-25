---
name: ui-data-testid
description: Add stable `data-testid` attributes when a new or refactored UI flow needs reliable unit or E2E selectors. Use for interactive React/TSX views, menus, or test-driven UI work; do not add selectors to static markup without a test or automation need.
---

# UI Data-testid

## Overview

Add predictable `data-testid` attributes to UI code as part of implementation, not as a later patch.
Keep selectors stable across i18n text changes and visual refactors.
Follow project testing rules in `.cursor/rules`:
- preserve existing `data-testid` during refactor/migration
- use `data-testid-first` query strategy in project tests

## Workflow

1. Determine the scope prefix from feature/module context (for example: `user-menus`, `organization-switch`, `settings-profile`).
2. Add `data-testid` to the component root container.
3. Add `data-testid` to all primary interactive nodes:
   - button/link triggers
   - input/select/checkbox/radio controls
   - tabs/menu items/submenu triggers
   - modal/drawer open and confirm actions
4. For config-driven UI (for example `menu.items`), add `"data-testid"` in config and forward it to the real clickable DOM node in renderer/wrapper components.
5. For repeated list rows/items, put the stable `data-testid` on the row/item container first. Do not add separate unique ids to every child element by default.
6. Inside a list row/item, reuse the row scope in tests: locate the row by shared row id plus text/business data, then query child controls with `within(row)` or role/label selectors.
7. Add child-level `data-testid` inside repeated rows only when the child cannot be reliably selected from the row scope; if needed, keep the child id shared across rows instead of appending row ids.
8. Keep existing ids unchanged unless user explicitly asks to rename; never remove existing ids in migration tasks.
9. For interaction changes, add or update Vitest/RTL tests in colocated `__tests__` where feasible.

## Naming Rules

- Use lowercase kebab-case only.
- Use semantic format: `<scope>-<entity>-<action>`.
- Keep IDs text-agnostic (do not depend on i18n labels).
- Avoid dynamic/random values (`Date.now`, UUID, translated text).
- Do not embed secrets, emails, phone numbers, or tokens.
- Use stable suffixes when applicable: `trigger`, `content`, `button`, `input`, `option`, `item`, `row`, `loading`, `empty`, `error`.

## Minimum Coverage Checklist

For every newly created UI component, include at least:

- one root container test id
- one primary CTA test id
- test ids for each secondary action button
- test ids for each form field group/control
- test ids for menu item triggers when menus are present
- for repeated lists/tables, one list container id and one row/item container id; avoid per-cell/per-action dynamic ids unless row-scoped selectors are insufficient
- preserved historical `data-testid` in touched files
- loading/empty/error test ids for async UIs

## Query Priority

When writing or updating tests:

- prefer `getByTestId` for stable selectors in this project
- use `getByRole`, `getByLabelText`, `getByText` as complementary assertions
- avoid `container.querySelector(...)` selectors for user-facing behavior tests

This keeps alignment with `.cursor/rules/testing-guide.mdc`.

## Scenario Playbook

Apply these patterns for stable and accurate element targeting:

1. Forms
   - add ids for form container, inputs, submit/cancel buttons, and validation errors
2. Lists and tables
   - add list container id and row container id
   - prefer a shared row id, then select the intended row by text/business data
   - use stable business key for row id suffix only when there is a concrete need for direct row lookup
   - do not add separate dynamic ids to every field/action inside the row; query child actions with `within(row)` scope
   - if a child action needs a `data-testid`, use one shared id such as `collaborator-remove-button` and resolve it from the row scope
3. Menus and dropdowns
   - add ids for trigger, popup content, and each actionable menu item
   - if menu is config-driven, forward item-level `data-testid` to rendered node
4. Modal and drawer
   - add ids for open trigger, modal content, primary action, and close/cancel action
5. Async states
   - add ids for loading, empty, and error states

## Stability Rules

- Never generate ids from array index if order may change.
- Never generate ids from random values or timestamps.
- Keep singleton ids unique on a page.
- For repeated components, keep shared child ids and scope with `within(...)`.
- Prefer row-level uniqueness over child-level uniqueness in repeated rows; child ids should not encode row ids unless there is no row container to scope from.

## Patterns

### Component markup

```tsx
<div data-testid="user-menus-organization-info">
  <button type="button" data-testid="user-menus-upgrade-button" />
  <button type="button" data-testid="user-menus-recharge-button" />
</div>
```

### Repeated list row

```tsx
<div data-testid="collaborator-list-content">
  {collaborators.map((collaborator) => (
    <div
      key={collaborator.id}
      data-testid="collaborator-item"
      data-collaborator-id={collaborator.id}
    >
      <span>{collaborator.name}</span>
      <button type="button" data-testid="collaborator-remove-button" />
    </div>
  ))}
</div>

const row = page
  .getByTestId("collaborator-list-content")
  .locator('[data-testid="collaborator-item"]')
  .filter({ hasText: receiverName })

await row.getByTestId("collaborator-remove-button").click()
```

### Config + renderer forwarding

```tsx
const items = [
  { key: "logout", label: t("logout"), "data-testid": "user-menus-logout" },
]

<ItemComponent data-testid={menuItem["data-testid"]}>{menuItem.label}</ItemComponent>
```

## Done Criteria

Complete only when all new singleton interactive nodes in touched UI files have stable `data-testid` values and repeated list/table rows have row-level selectors that allow child controls to be found from the row scope.
Confirm no existing `data-testid` was removed unintentionally in migration/refactor diffs.
