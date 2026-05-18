# Crew Market Mobile UI Redesign

**Date:** 2026-05-18
**Scope:** `EmployeeCardMobile.tsx`, `index.mobile.tsx` (CrewMarket page), `CrewMarketMobileSkeleton`
**Goal:** Pixel-level alignment with the prototype (`CrewMarketScreen.tsx`) — single-column card list, inline avatar layout, bottom search bar, simplified header.

---

## 1. Overview

The current mobile employee market uses a 2-column grid with a floating avatar above each card. The prototype redesigns this as a single-column list where the avatar sits inline (left-aligned, 48 px) beside the agent name, role badge, and publisher info. A persistent bottom search bar replaces the Sheet-based search drawer. The header is simplified to back button + centered title only.

Data layer (MobX store, API calls, hire/dismiss logic) is unchanged. Only the UI layer is modified.

---

## 2. Architecture

No new files. Three existing locations are modified in place:

| File | Change |
|------|--------|
| `employee-market/components/EmployeeCardMobile.tsx` | Full rewrite to new card layout |
| `index.mobile.tsx` | Layout restructure: header, list, bottom search bar |
| (inline in `index.mobile.tsx`) | `CrewMarketMobileSkeleton` updated to match new card |

Reused component:
- `@/pages/superMagicMobile/components/MobileBottomSearchBar` — bottom search bar (controlled, with clear button)

---

## 3. EmployeeCardMobile Component

### Layout

```
┌──────────────────────────────────────────────────┐
│  [Avatar 48px]  Name (16px semibold)  [Role tag] │
│                 🏢 by Publisher                   │
│                                                   │
│  Description text (2-line clamp, 13px muted)      │
│                                                   │
│  [chip chip chip →]   ← only when playbooks exist │
│                                                   │
│  [         Chat / Hire / Dismiss (full-width)  ]  │
└──────────────────────────────────────────────────┘
```

### Details

- **Card container**: `bg-card rounded-2xl p-4 flex flex-col gap-3`, light shadow (`0px 2px 12px rgba(0,0,0,0.07)`)
- **Info area** (avatar row + description): wrapped in a `<button>` that calls `onOpenMarketDetail`
- **Avatar**: 48 px rounded-full, border-2 border-background, shadow. Falls back to `CrewFallbackAvatar` when no icon URL.
- **Name**: `text-[16px] font-semibold leading-tight truncate flex-1`
- **Role badge**: inline pill, `border border-primary/30 text-muted-foreground/80 text-[10px]`, right of name
- **Publisher row**: `Building2` icon (12px) + `text-[12px] text-muted-foreground`; official publishers show `ShieldCheck` icon instead of `Building2`
- **Description**: `text-[13px] leading-[1.55] text-muted-foreground line-clamp-2`
- **Capabilities row** (`playbooks` field): horizontal scrolling chip row with left/right fade masks. Hidden when `playbooks` is empty. Each chip: colored background at 10% opacity, colored text, icon from playbook metadata if available.
- **Action button**: full-width, `h-10 rounded-xl text-[14px] font-semibold`
  - Not hired → `bg-primary text-white` + `UserPlus` icon + hire label
  - Hired, `allowDelete: true` → destructive soft style + dismiss label
  - Hired, `allowDelete: false` → `border border-border bg-card text-primary` + `MessageCircle` icon + chat label
- Button clicks call `stopPropagation` to avoid triggering the card's detail open

### Props (unchanged interface)

```ts
interface EmployeeCardMobileProps {
  employee: StoreAgentView
  onHire?: (id: string) => void
  onDismiss?: (id: string) => void
  onDetails?: (id: string) => void        // used for chat navigation on hired agents
  onOpenMarketDetail?: (id: string) => void
}
```

Button mapping:
- `onHire` → hire button (not added)
- `onDismiss` → dismiss button (added + allowDelete)
- `onDetails` → chat button (added + !allowDelete). Also triggers via card info area click when agent is added.
- `onOpenMarketDetail` → card info area click when agent is not added

---

## 4. Page Layout (`index.mobile.tsx`)

### Header

```
[← ChevronLeft rounded-full bg-card shadow]   Crew Market   [spacer same width]
```

- Left: back button navigating to `RouteName.MyCrew` (replaces Menu button)
- Center: `h1` title, `font-poppins text-[18px] font-medium`
- Right: same-width invisible spacer for visual symmetry
- Removes: Menu (hamburger) button, My Crew nav button, search icon button
- Header does NOT use `SuperMobileShellRouteLayout` sidebar — since we now have a back button, the sidebar entry point is removed from this page

### Category Tabs

`CategoryFilter` component reused as-is, no changes.

### Card List

- Layout changes from `grid grid-cols-2 gap-3` → `flex flex-col gap-3`
- `ScrollArea` bottom padding increased to `pb-24` to avoid content hiding behind the bottom search bar
- Load More / no-more-data footer preserved as-is

### Bottom Search Bar

```tsx
<MobileBottomSearchBar
  value={searchKeyword}
  placeholder={t("aiSearchPlaceholder")}
  clearAriaLabel={t("mobile.clearSearch")}
  onValueChange={handleSearchChange}
  testIdPrefix="crew-market-mobile-search"
/>
```

- Positioned as `shrink-0` at the bottom of the page flex column (not fixed/absolute — the page root is already `h-full flex flex-col`)
- `searchKeyword` is local state; changes are debounced 400 ms before calling `store.fetchAgents({ keyword, page: 1 })`
- Replaces: Sheet-based search drawer, search icon button in header

### Removed from page

- `Sheet` / `SheetContent` search drawer and all related state (`searchOpen`, `queryDraft`, `handleSearchOpenChange`, `handleApplySearch`)
- `UserRoundCog` my-crew navigation button
- `Menu` hamburger button + `openSidebar` from shell outlet
- `SuperMobileShellRouteLayout` wrapper (page is now standalone with its own back navigation)

---

## 5. Skeleton (`CrewMarketMobileSkeleton`)

Updated to match single-column new card layout:

```
┌──────────────────────────────────────────┐
│  [circle 48px]  [rect w-1/3]  [rect w-1/4]│
│                 [rect w-2/5]              │
│  [rect w-full h-3]                        │
│  [rect w-5/6 h-3]                         │
│  [rect w-full h-10 rounded-xl]            │
└──────────────────────────────────────────┘
```

- 6 skeleton cards, single column
- Category filter skeleton row kept (5 pill shapes, scrolling row)

---

## 6. API Limitations

- `playbooks` field in API response is currently always `[]`. Capabilities chip row is conditionally rendered — it renders only when `playbooks.length > 0`, so no placeholder state needed.
- Any future limitations discovered during implementation will be recorded in `docs/API_LIMITATIONS.md` (not committed).

---

## 7. Error Handling

No changes to error handling. Existing store handles fetch errors and exposes `store.isEmpty` for empty state rendering.

---

## 8. Testing

- No new tests added; existing `employee-card-shared.test.ts` tests utility functions which are unchanged.
- Visually verified against prototype screenshot.
- `data-testid` attributes preserved on all interactive elements for existing E2E test compatibility.
