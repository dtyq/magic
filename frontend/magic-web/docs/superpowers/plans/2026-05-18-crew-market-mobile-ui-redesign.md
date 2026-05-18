# Crew Market Mobile UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pixel-level rewrite of the mobile employee market UI to match the prototype — single-column cards, inline 48 px avatar, bottom search bar, simplified back-button header.

**Architecture:** Modify two existing files in place (`EmployeeCardMobile.tsx` and `index.mobile.tsx`) plus the inline skeleton component. No new files. Data layer (MobX store, API) is untouched. Reuse `MobileBottomSearchBar` from `@/pages/superMagicMobile/components/MobileBottomSearchBar`.

**Tech Stack:** React, TypeScript, Tailwind CSS, MobX, `ahooks` (`useDebounce`), lucide-react

---

## File Map

| File | Action |
|------|--------|
| `src/pages/superMagic/pages/CrewMarket/employee-market/components/EmployeeCardMobile.tsx` | Rewrite (UI only, props interface unchanged) |
| `src/pages/superMagic/pages/CrewMarket/index.mobile.tsx` | Rewrite page layout + skeleton + bottom search |

---

## Task 1: Rewrite `EmployeeCardMobile.tsx`

**Files:**
- Modify: `src/pages/superMagic/pages/CrewMarket/employee-market/components/EmployeeCardMobile.tsx`

Replace the entire component with the new single-card layout. The props interface (`EmployeeCardMobileProps`) is **unchanged** — only the JSX and internal logic change.

- [ ] **Step 1: Replace EmployeeCardMobile.tsx with new implementation**

Replace the entire file content with:

```tsx
import { memo, useCallback, type MouseEvent } from "react"
import { Building2, MessageCircle, ShieldCheck, UserPlus } from "lucide-react"
import { useTranslation } from "react-i18next"
import CrewFallbackAvatar from "@/pages/superMagic/components/CrewFallbackAvatar"
import type { StoreAgentView } from "@/services/crew/CrewService"
import { cn } from "@/lib/utils"
import {
	isEmployeeMarketPrimaryActionDisabled,
	isOfficialPublisherType,
	resolveEmployeeMarketPrimaryActionLabel,
	resolvePublisherLabel,
} from "./employee-card-shared"

interface EmployeeCardMobileProps {
	employee: StoreAgentView
	onHire?: (id: string) => void
	onDismiss?: (id: string) => void
	onDetails?: (id: string) => void
	onOpenMarketDetail?: (id: string) => void
}

const CARD_BG = "var(--color-card)"
const FADE_W = 20

function CapChip({ name, themeColor }: { name: string; themeColor: string | null }) {
	const color = themeColor ?? "#6366f1"
	return (
		<span
			className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[12px] font-medium leading-none shrink-0"
			style={{ color, backgroundColor: `${color}1a` }}
		>
			{name}
		</span>
	)
}

function CapabilitiesRow({ playbooks }: { playbooks: StoreAgentView["playbooks"] }) {
	import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
	const scrollRef = useRef<HTMLDivElement>(null)
	const [showLeft, setShowLeft] = useState(false)
	const [showRight, setShowRight] = useState(false)

	const updateMasks = useCallback(() => {
		const el = scrollRef.current
		if (!el) return
		setShowLeft(el.scrollLeft > 2)
		setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
	}, [])

	useLayoutEffect(() => { updateMasks() }, [updateMasks, playbooks.length])

	useEffect(() => {
		const el = scrollRef.current
		if (!el) return
		const ro = new ResizeObserver(updateMasks)
		ro.observe(el)
		return () => ro.disconnect()
	}, [updateMasks])

	return (
		<div className="relative -mx-4">
			<div
				ref={scrollRef}
				onScroll={updateMasks}
				className="flex flex-row gap-1.5 overflow-x-auto overflow-y-visible no-scrollbar w-full px-4 touch-pan-x [-webkit-overflow-scrolling:touch]"
			>
				{playbooks.map((p) => (
					<CapChip key={p.name} name={p.name} themeColor={p.themeColor} />
				))}
			</div>
			<div
				className="pointer-events-none absolute inset-y-0 left-0 z-[1] transition-opacity duration-200"
				style={{
					width: FADE_W,
					background: `linear-gradient(to right, ${CARD_BG} 0%, transparent 100%)`,
					opacity: showLeft ? 1 : 0,
				}}
			/>
			<div
				className="pointer-events-none absolute inset-y-0 right-0 z-[1] transition-opacity duration-200"
				style={{
					width: FADE_W,
					background: `linear-gradient(to left, ${CARD_BG} 0%, transparent 100%)`,
					opacity: showRight ? 1 : 0,
				}}
			/>
		</div>
	)
}

function EmployeeCardMobile({
	employee,
	onHire,
	onDismiss,
	onDetails,
	onOpenMarketDetail,
}: EmployeeCardMobileProps) {
	const { t } = useTranslation("crew/market")
	const { t: tCrewCreate } = useTranslation("crew/create")

	const displayName = employee.name?.trim() || tCrewCreate("untitledCrew")
	const displayDescription = employee.description?.trim() || t("interface:appList.noDescription")
	const roleLine = employee.role?.trim() ?? ""
	const avatarSrc = employee.icon ?? ""
	const isOfficial = isOfficialPublisherType(employee.publisherType)
	const publisherLabel = resolvePublisherLabel(employee.publisherType, employee.publisherName, t)
	const actionLabel = resolveEmployeeMarketPrimaryActionLabel(employee, t)
	const actionDisabled = isEmployeeMarketPrimaryActionDisabled(employee)

	const stopProp = useCallback((e: MouseEvent) => { e.stopPropagation() }, [])

	function handleInfoClick() {
		if (employee.isAdded) {
			onDetails?.(employee.id)
		} else {
			onOpenMarketDetail?.(employee.id)
		}
	}

	function handleActionClick(e: MouseEvent<HTMLButtonElement>) {
		stopProp(e)
		if (!employee.isAdded) {
			onHire?.(employee.id)
		} else if (employee.allowDelete) {
			onDismiss?.(employee.id)
		} else {
			onDetails?.(employee.id)
		}
	}

	const actionIsDestructive = employee.isAdded && employee.allowDelete
	const actionIsChat = employee.isAdded && !employee.allowDelete

	return (
		<div
			className="bg-card rounded-2xl p-4 flex flex-col gap-3"
			style={{ boxShadow: "0px 2px 12px 0px rgba(0,0,0,0.07)" }}
			data-testid="employee-card-mobile"
		>
			{/* Info area — click opens detail */}
			<button
				type="button"
				onClick={handleInfoClick}
				className="flex flex-col gap-3 text-left active:opacity-75 transition-opacity"
				data-testid="employee-card-mobile-info-area"
			>
				{/* Avatar row */}
				<div className="flex gap-3 items-start w-full">
					<div
						className="size-12 rounded-full overflow-hidden border-2 border-background shrink-0"
						style={{ boxShadow: "0px 4px 12px 0px rgba(0,0,0,0.12)" }}
						data-testid="employee-card-mobile-avatar-wrap"
					>
						{avatarSrc ? (
							<img src={avatarSrc} alt={displayName} className="size-full object-cover" />
						) : (
							<div className="flex size-full items-center justify-center rounded-full bg-muted text-foreground">
								<CrewFallbackAvatar />
							</div>
						)}
					</div>

					<div className="flex flex-col flex-1 min-w-0 gap-1">
						<div className="flex items-center gap-2 min-w-0">
							<p
								className="flex-1 min-w-0 text-[16px] font-semibold leading-tight text-foreground truncate"
								data-testid="employee-card-mobile-name"
							>
								{displayName}
							</p>
							{roleLine ? (
								<span
									className="ml-auto inline-flex items-center h-[18px] px-1.5 rounded-full border border-primary/30 text-muted-foreground/80 text-[10px] font-medium leading-none shrink-0"
									data-testid="employee-card-mobile-role-badge"
								>
									{roleLine}
								</span>
							) : null}
						</div>

						<div className="flex items-center gap-1 min-w-0 text-muted-foreground">
							{isOfficial ? (
								<ShieldCheck className="size-3 shrink-0" strokeWidth={2} />
							) : (
								<Building2 className="size-3 shrink-0" strokeWidth={2} />
							)}
							<p
								className="text-[12px] leading-4 truncate"
								data-testid="employee-card-mobile-publisher"
							>
								{publisherLabel}
							</p>
						</div>
					</div>
				</div>

				{/* Description */}
				<p
					className="text-[13px] leading-[1.55] text-muted-foreground line-clamp-2"
					data-testid="employee-card-mobile-description"
				>
					{displayDescription}
				</p>
			</button>

			{/* Capabilities chip row — only when playbooks exist */}
			{employee.playbooks.length > 0 ? (
				<CapabilitiesRow playbooks={employee.playbooks} />
			) : null}

			{/* Action button */}
			<button
				type="button"
				onClick={handleActionClick}
				disabled={actionDisabled}
				className={cn(
					"w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-xl text-[14px] font-semibold leading-none active:opacity-75 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed",
					actionIsDestructive
						? "bg-destructive/10 text-destructive border border-destructive/20"
						: actionIsChat
							? "border border-border bg-card text-primary"
							: "bg-primary text-primary-foreground",
				)}
				data-testid={
					actionIsDestructive
						? "employee-card-mobile-dismiss-button"
						: actionIsChat
							? "employee-card-mobile-details-button"
							: "employee-card-mobile-hire-button"
				}
			>
				{actionIsChat ? (
					<MessageCircle className="size-4 shrink-0" aria-hidden />
				) : !employee.isAdded ? (
					<UserPlus className="size-4 shrink-0" aria-hidden />
				) : null}
				<span className="truncate">{actionLabel}</span>
			</button>
		</div>
	)
}

export default memo(EmployeeCardMobile)
```

- [ ] **Step 2: Fix CapabilitiesRow — move hooks to top level**

The `CapabilitiesRow` function above has hooks imports inside a nested function, which is invalid. The actual file should import at the top. The full correct file content is below — this is the production version to write:

```tsx
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react"
import { Building2, MessageCircle, ShieldCheck, UserPlus } from "lucide-react"
import { useTranslation } from "react-i18next"
import CrewFallbackAvatar from "@/pages/superMagic/components/CrewFallbackAvatar"
import type { StoreAgentView } from "@/services/crew/CrewService"
import { cn } from "@/lib/utils"
import {
	isEmployeeMarketPrimaryActionDisabled,
	isOfficialPublisherType,
	resolveEmployeeMarketPrimaryActionLabel,
	resolvePublisherLabel,
} from "./employee-card-shared"

interface EmployeeCardMobileProps {
	employee: StoreAgentView
	onHire?: (id: string) => void
	onDismiss?: (id: string) => void
	onDetails?: (id: string) => void
	onOpenMarketDetail?: (id: string) => void
}

const CARD_BG = "var(--color-card)"
const FADE_W = 20

function CapChip({ name, themeColor }: { name: string; themeColor: string | null }) {
	const color = themeColor ?? "#6366f1"
	return (
		<span
			className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[12px] font-medium leading-none shrink-0"
			style={{ color, backgroundColor: `${color}1a` }}
		>
			{name}
		</span>
	)
}

function CapabilitiesRow({ playbooks }: { playbooks: StoreAgentView["playbooks"] }) {
	const scrollRef = useRef<HTMLDivElement>(null)
	const [showLeft, setShowLeft] = useState(false)
	const [showRight, setShowRight] = useState(false)

	const updateMasks = useCallback(() => {
		const el = scrollRef.current
		if (!el) return
		setShowLeft(el.scrollLeft > 2)
		setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
	}, [])

	useLayoutEffect(() => { updateMasks() }, [updateMasks, playbooks.length])

	useEffect(() => {
		const el = scrollRef.current
		if (!el) return
		const ro = new ResizeObserver(updateMasks)
		ro.observe(el)
		return () => ro.disconnect()
	}, [updateMasks])

	return (
		<div className="relative -mx-4">
			<div
				ref={scrollRef}
				onScroll={updateMasks}
				className="flex flex-row gap-1.5 overflow-x-auto overflow-y-visible no-scrollbar w-full px-4 touch-pan-x [-webkit-overflow-scrolling:touch]"
			>
				{playbooks.map((p) => (
					<CapChip key={p.name} name={p.name} themeColor={p.themeColor} />
				))}
			</div>
			<div
				className="pointer-events-none absolute inset-y-0 left-0 z-[1] transition-opacity duration-200"
				style={{
					width: FADE_W,
					background: `linear-gradient(to right, ${CARD_BG} 0%, transparent 100%)`,
					opacity: showLeft ? 1 : 0,
				}}
			/>
			<div
				className="pointer-events-none absolute inset-y-0 right-0 z-[1] transition-opacity duration-200"
				style={{
					width: FADE_W,
					background: `linear-gradient(to left, ${CARD_BG} 0%, transparent 100%)`,
					opacity: showRight ? 1 : 0,
				}}
			/>
		</div>
	)
}

function EmployeeCardMobile({
	employee,
	onHire,
	onDismiss,
	onDetails,
	onOpenMarketDetail,
}: EmployeeCardMobileProps) {
	const { t } = useTranslation("crew/market")
	const { t: tCrewCreate } = useTranslation("crew/create")

	const displayName = employee.name?.trim() || tCrewCreate("untitledCrew")
	const displayDescription = employee.description?.trim() || t("interface:appList.noDescription")
	const roleLine = employee.role?.trim() ?? ""
	const avatarSrc = employee.icon ?? ""
	const isOfficial = isOfficialPublisherType(employee.publisherType)
	const publisherLabel = resolvePublisherLabel(employee.publisherType, employee.publisherName, t)
	const actionLabel = resolveEmployeeMarketPrimaryActionLabel(employee, t)
	const actionDisabled = isEmployeeMarketPrimaryActionDisabled(employee)

	const stopProp = useCallback((e: MouseEvent) => { e.stopPropagation() }, [])

	function handleInfoClick() {
		if (employee.isAdded) {
			onDetails?.(employee.id)
		} else {
			onOpenMarketDetail?.(employee.id)
		}
	}

	function handleActionClick(e: MouseEvent<HTMLButtonElement>) {
		stopProp(e)
		if (!employee.isAdded) {
			onHire?.(employee.id)
		} else if (employee.allowDelete) {
			onDismiss?.(employee.id)
		} else {
			onDetails?.(employee.id)
		}
	}

	const actionIsDestructive = employee.isAdded && employee.allowDelete
	const actionIsChat = employee.isAdded && !employee.allowDelete

	return (
		<div
			className="bg-card rounded-2xl p-4 flex flex-col gap-3"
			style={{ boxShadow: "0px 2px 12px 0px rgba(0,0,0,0.07)" }}
			data-testid="employee-card-mobile"
		>
			<button
				type="button"
				onClick={handleInfoClick}
				className="flex flex-col gap-3 text-left active:opacity-75 transition-opacity"
				data-testid="employee-card-mobile-info-area"
			>
				<div className="flex gap-3 items-start w-full">
					<div
						className="size-12 rounded-full overflow-hidden border-2 border-background shrink-0"
						style={{ boxShadow: "0px 4px 12px 0px rgba(0,0,0,0.12)" }}
						data-testid="employee-card-mobile-avatar-wrap"
					>
						{avatarSrc ? (
							<img src={avatarSrc} alt={displayName} className="size-full object-cover" />
						) : (
							<div className="flex size-full items-center justify-center rounded-full bg-muted text-foreground">
								<CrewFallbackAvatar />
							</div>
						)}
					</div>

					<div className="flex flex-col flex-1 min-w-0 gap-1">
						<div className="flex items-center gap-2 min-w-0">
							<p
								className="flex-1 min-w-0 text-[16px] font-semibold leading-tight text-foreground truncate"
								data-testid="employee-card-mobile-name"
							>
								{displayName}
							</p>
							{roleLine ? (
								<span
									className="ml-auto inline-flex items-center h-[18px] px-1.5 rounded-full border border-primary/30 text-muted-foreground/80 text-[10px] font-medium leading-none shrink-0"
									data-testid="employee-card-mobile-role-badge"
								>
									{roleLine}
								</span>
							) : null}
						</div>

						<div className="flex items-center gap-1 min-w-0 text-muted-foreground">
							{isOfficial ? (
								<ShieldCheck className="size-3 shrink-0" strokeWidth={2} />
							) : (
								<Building2 className="size-3 shrink-0" strokeWidth={2} />
							)}
							<p
								className="text-[12px] leading-4 truncate"
								data-testid="employee-card-mobile-publisher"
							>
								{publisherLabel}
							</p>
						</div>
					</div>
				</div>

				<p
					className="text-[13px] leading-[1.55] text-muted-foreground line-clamp-2"
					data-testid="employee-card-mobile-description"
				>
					{displayDescription}
				</p>
			</button>

			{employee.playbooks.length > 0 ? (
				<CapabilitiesRow playbooks={employee.playbooks} />
			) : null}

			<button
				type="button"
				onClick={handleActionClick}
				disabled={actionDisabled}
				className={cn(
					"w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-xl text-[14px] font-semibold leading-none active:opacity-75 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed",
					actionIsDestructive
						? "bg-destructive/10 text-destructive border border-destructive/20"
						: actionIsChat
							? "border border-border bg-card text-primary"
							: "bg-primary text-primary-foreground",
				)}
				data-testid={
					actionIsDestructive
						? "employee-card-mobile-dismiss-button"
						: actionIsChat
							? "employee-card-mobile-details-button"
							: "employee-card-mobile-hire-button"
				}
			>
				{actionIsChat ? (
					<MessageCircle className="size-4 shrink-0" aria-hidden />
				) : !employee.isAdded ? (
					<UserPlus className="size-4 shrink-0" aria-hidden />
				) : null}
				<span className="truncate">{actionLabel}</span>
			</button>
		</div>
	)
}

export default memo(EmployeeCardMobile)
```

- [ ] **Step 3: TypeCheck the file**

```bash
cd frontend/magic-web && npx tsc --noEmit --project tsconfig.json 2>&1 | grep "EmployeeCardMobile"
```

Expected: no errors on that file.

- [ ] **Step 4: Commit**

```bash
git add src/pages/superMagic/pages/CrewMarket/employee-market/components/EmployeeCardMobile.tsx
git commit -m "💄 style(EmployeeCardMobile): rewrite to prototype single-column card layout"
```

---

## Task 2: Rewrite `index.mobile.tsx` — page layout, skeleton, bottom search

**Files:**
- Modify: `src/pages/superMagic/pages/CrewMarket/index.mobile.tsx`

Replace the full file with the new page that has:
1. Simplified header (back button + title only)
2. Single-column card list
3. `MobileBottomSearchBar` at bottom with 400 ms debounce
4. Updated `CrewMarketMobileSkeleton`

- [ ] **Step 1: Replace index.mobile.tsx with new implementation**

Replace the entire file content with:

```tsx
import { useCallback, useEffect, useRef, useState } from "react"
import { useDebounce } from "ahooks"
import { reaction } from "mobx"
import { configStore } from "@/models/config"
import { Check, ChevronLeft, Loader2 } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useConfirmDialog } from "@/components/shadcn-composed/confirm-dialog"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { userStore } from "@/models/user"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { CrewDetailDialog } from "@/pages/superMagic/components/CrewDetailDialog"
import MobileBottomSearchBar from "@/pages/superMagicMobile/components/MobileBottomSearchBar"
import {
	UserWorkspaceMapCache,
	WorkspaceStateCache,
} from "@/pages/superMagic/utils/superMagicCache"
import {
	isEmployeeMarketPrimaryActionDisabled,
	resolveEmployeeMarketPrimaryActionLabel,
} from "./employee-market/components/employee-card-shared"
import CategoryFilter from "./employee-market/components/CategoryFilter"
import EmployeeCardMobile from "./employee-market/components/EmployeeCardMobile"
import { StoreCrewStore } from "./employee-market/stores/store-crew"
import { crewService, type StoreAgentView } from "@/services/crew/CrewService"

const SKELETON_CARD_COUNT = 6
const HEADER_SHADOW = "0px 8px 25px 0px rgba(0,0,0,0.10)"

function CrewMarketMobileSkeleton() {
	return (
		<div className="flex flex-col gap-4" data-testid="crew-market-mobile-skeleton">
			{/* Category filter skeleton */}
			<div className="flex gap-2 overflow-hidden py-0.5">
				{Array.from({ length: 5 }).map((_, i) => (
					<Skeleton key={i} className="h-9 w-[88px] shrink-0 rounded-full" />
				))}
			</div>
			{/* Single-column card skeletons */}
			<div className="flex flex-col gap-3">
				{Array.from({ length: SKELETON_CARD_COUNT }).map((_, i) => (
					<div
						key={i}
						className="flex flex-col gap-3 rounded-2xl bg-card p-4"
						style={{ boxShadow: "0px 2px 12px 0px rgba(0,0,0,0.07)" }}
					>
						{/* Avatar row */}
						<div className="flex gap-3 items-start">
							<Skeleton className="size-12 shrink-0 rounded-full" />
							<div className="flex flex-col flex-1 gap-1.5">
								<div className="flex items-center gap-2">
									<Skeleton className="h-5 w-1/3" />
									<Skeleton className="ml-auto h-[18px] w-1/5 rounded-full" />
								</div>
								<Skeleton className="h-3 w-2/5" />
							</div>
						</div>
						{/* Description */}
						<div className="flex flex-col gap-1.5">
							<Skeleton className="h-3 w-full" />
							<Skeleton className="h-3 w-5/6" />
						</div>
						{/* Action button */}
						<Skeleton className="h-10 w-full rounded-xl" />
					</div>
				))}
			</div>
		</div>
	)
}

function CrewMarketMobilePanelBase() {
	const { t } = useTranslation("crew/market")
	const navigate = useNavigate()
	const storeRef = useRef(new StoreCrewStore())
	const store = storeRef.current
	const { confirm, dialog } = useConfirmDialog()

	const [searchKeyword, setSearchKeyword] = useState("")
	const debouncedKeyword = useDebounce(searchKeyword, { wait: 400 })
	const [selectedAgent, setSelectedAgent] = useState<StoreAgentView | null>(null)

	useEffect(() => {
		store.fetchCategories()
		void store.fetchAgents()
		return () => store.reset()
	}, [store])

	useEffect(() => {
		return reaction(
			() => configStore.i18n.displayLanguage,
			() => { store.refreshAfterLanguageChange() },
		)
	}, [store])

	// Trigger search whenever debounced keyword changes
	useEffect(() => {
		void store.fetchAgents({ keyword: debouncedKeyword.trim() || undefined, page: 1 })
	}, [debouncedKeyword, store])

	const handleHire = useCallback((id: string) => { store.hireAgent(id) }, [store])

	const handleDismiss = useCallback(
		(id: string) => {
			const target = store.list.find((item) => item.id === id)
			if (!target?.allowDelete) return
			const displayName =
				target.name?.trim() || t("crew/create:untitledCrew") || target.agentCode
			confirm({
				title: t("myCrewPage.dismissConfirm.title", { name: displayName }),
				description: t("myCrewPage.dismissConfirm.description"),
				confirmText: t("myCrewPage.dismissConfirm.confirm"),
				variant: "destructive",
				destructivePresentation: "soft",
				dialogSize: "sm",
				onConfirm: () => {
					if (selectedAgent?.id === id) setSelectedAgent(null)
					store.dismissAgent(id)
				},
			})
		},
		[confirm, selectedAgent?.id, store, t],
	)

	function resolveFallbackWorkspaceId() {
		const userInfo = userStore.user.userInfo
		const cachedWorkspaceState = WorkspaceStateCache.get(userInfo)
		return cachedWorkspaceState.workspaceId || UserWorkspaceMapCache.get(userInfo)
	}

	const handleOpenConversation = useCallback(
		async (agentCode: string) => {
			await crewService.pinFeaturedFrequentForConversation(agentCode)
			const fallbackWorkspaceId = resolveFallbackWorkspaceId()
			navigate({
				name: fallbackWorkspaceId ? RouteName.SuperWorkspaceState : RouteName.Super,
				params: fallbackWorkspaceId ? { workspaceId: fallbackWorkspaceId } : undefined,
				query: { agentCode },
			})
		},
		[navigate],
	)

	const handleOpenMarketDetail = useCallback(
		(id: string) => {
			const target = store.list.find((item) => item.id === id)
			if (!target) return
			setSelectedAgent(target)
		},
		[store],
	)

	const handleDetails = useCallback(
		(id: string) => {
			const target = store.list.find((item) => item.id === id)
			if (!target) return
			if (target.isAdded) {
				handleOpenConversation(target.agentCode)
				return
			}
			setSelectedAgent(target)
		},
		[handleOpenConversation, store],
	)

	const activeCategoryId = store.categoryId ?? "all"

	const handleCategoryChange = useCallback(
		(categoryId: string) => {
			if (categoryId === activeCategoryId) return
			store.fetchAgents({
				category_id: categoryId === "all" ? undefined : categoryId,
				page: 1,
			})
		},
		[activeCategoryId, store],
	)

	return (
		<>
			<CrewDetailDialog
				open={selectedAgent != null}
				onOpenChange={(open) => { if (!open) setSelectedAgent(null) }}
				agentCode={selectedAgent?.agentCode ?? null}
				detailSource="market"
				versionCode={selectedAgent?.latestVersionCode}
				avatarUrl={selectedAgent?.icon}
				primaryAction={
					selectedAgent
						? {
								label: resolveEmployeeMarketPrimaryActionLabel(selectedAgent, t),
								variant: selectedAgent.allowDelete ? "destructive" : "default",
								disabled: isEmployeeMarketPrimaryActionDisabled(selectedAgent),
								testId: "crew-market-mobile-detail-action-button",
								onClick: () =>
									selectedAgent.allowDelete
										? handleDismiss(selectedAgent.id)
										: store.hireAgent(selectedAgent.id),
							}
						: undefined
				}
			/>
			{dialog}

			<div
				className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background"
				data-testid="crew-market-page-mobile"
			>
				{/* Header */}
				<header
					className="relative z-10 flex shrink-0 items-center h-14 px-[10px] gap-2"
					data-testid="crew-market-mobile-header"
				>
					<button
						type="button"
						onClick={() => navigate({ name: RouteName.MyCrew })}
						className="shrink-0 size-11 bg-card rounded-full flex items-center justify-center transition-transform active:scale-95"
						style={{ boxShadow: HEADER_SHADOW }}
						aria-label={t("back")}
						data-testid="crew-market-mobile-back-button"
					>
						<ChevronLeft className="size-[22px] text-foreground" strokeWidth={2} />
					</button>

					<div className="min-w-0 flex-1 px-2 text-center" data-testid="crew-market-mobile-title">
						<h1 className="truncate font-poppins text-[18px] font-medium text-foreground">
							{t("title")}
						</h1>
					</div>

					{/* Spacer — same width as back button for symmetry */}
					<div className="size-11 shrink-0" aria-hidden />
				</header>

				{/* Content */}
				<ScrollArea className="min-h-0 flex-1 [&_[data-slot='scroll-area-viewport']>div]:!block">
					<div className="flex w-full min-w-0 flex-col gap-4 px-3 pb-24 pt-3">
						{!store.loading ? (
							<CategoryFilter
								categories={store.categories}
								activeCategoryId={activeCategoryId}
								onCategoryChange={handleCategoryChange}
							/>
						) : null}

						{store.loading ? <CrewMarketMobileSkeleton /> : null}

						{store.isEmpty ? (
							<div
								className="flex flex-col items-center justify-center py-12 text-center"
								data-testid="crew-market-empty"
							>
								<p className="text-sm text-muted-foreground">
									{store.keyword ? t("noResults") : t("noMoreData")}
								</p>
							</div>
						) : null}

						{!store.loading && store.list.length > 0 ? (
							<div
								className="flex flex-col gap-3"
								data-testid="employee-card-list"
							>
								{store.list.map((employee) => (
									<EmployeeCardMobile
										key={employee.id}
										employee={employee}
										onHire={handleHire}
										onDismiss={handleDismiss}
										onDetails={handleDetails}
										onOpenMarketDetail={handleOpenMarketDetail}
									/>
								))}
							</div>
						) : null}

						{!store.loading && store.list.length > 0 ? (
							<div className="flex items-center justify-center py-2">
								{store.hasMore ? (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => store.loadMore()}
										disabled={store.loadingMore}
										data-testid="crew-market-load-more"
									>
										{store.loadingMore ? (
											<Loader2 className="mr-2 size-4 animate-spin" />
										) : null}
										{store.loadingMore ? t("loadingMore") : t("loadMore")}
									</Button>
								) : (
									<div
										className="flex items-center justify-center gap-1 opacity-30"
										data-testid="crew-market-no-more"
									>
										<Check className="size-4" />
										<span className="text-xs">{t("noMoreData")}</span>
									</div>
								)}
							</div>
						) : null}
					</div>
				</ScrollArea>

				{/* Bottom search bar */}
				<MobileBottomSearchBar
					value={searchKeyword}
					placeholder={t("aiSearchPlaceholder")}
					clearAriaLabel={t("mobile.clearSearch")}
					onValueChange={setSearchKeyword}
					testIdPrefix="crew-market-mobile-search"
				/>
			</div>
		</>
	)
}

const CrewMarketMobilePanel = observer(CrewMarketMobilePanelBase)

export default function CrewMarketMobilePage() {
	return <CrewMarketMobilePanel />
}
```

- [ ] **Step 2: Check that `t("back")` and `t("mobile.clearSearch")` i18n keys exist**

```bash
grep -r '"back"' src/pages/superMagic/pages/CrewMarket/ --include="*.json" -l 2>/dev/null || \
grep -r "\"back\"" src/locales --include="*.json" -r | grep "crew/market" | head -5
```

If the keys don't exist in the locale file, check the actual locale file path:

```bash
find src/locales -name "*.json" | xargs grep -l "crew" | head -5
```

Then open the relevant `crew/market` locale file and add missing keys if absent:
- `"back"` → `"返回"` (zh-CN) / `"Back"` (en-US)
- `"mobile.clearSearch"` → `"清除搜索"` (zh-CN) / `"Clear search"` (en-US)

- [ ] **Step 3: TypeCheck the file**

```bash
cd frontend/magic-web && npx tsc --noEmit --project tsconfig.json 2>&1 | grep "index.mobile"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/superMagic/pages/CrewMarket/index.mobile.tsx
git commit -m "💄 style(CrewMarket): rewrite mobile page layout — back header, single-column list, bottom search"
```

---

## Task 3: Add missing i18n keys (if needed)

**Files:**
- Modify: locale JSON files for `crew/market` namespace (zh-CN and en-US)

> Skip this task if Step 2 of Task 2 confirms the keys already exist.

- [ ] **Step 1: Locate locale files**

```bash
find src/locales -name "*.json" | xargs grep -l "aiSearchPlaceholder" 2>/dev/null
```

- [ ] **Step 2: Add missing keys**

Open each locale file found. Add under the `mobile` object (create if missing):

For **zh-CN**:
```json
{
  "back": "返回",
  "mobile": {
    "clearSearch": "清除搜索"
  }
}
```

For **en-US**:
```json
{
  "back": "Back",
  "mobile": {
    "clearSearch": "Clear search"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/locales/
git commit -m "📝 i18n(crew/market): add back and mobile.clearSearch keys"
```

---

## Self-Review

**Spec coverage:**
- ✅ EmployeeCardMobile — inline avatar, name/role/publisher row, description, chip row, action button
- ✅ playbooks chip row — conditionally rendered, scroll + fade masks
- ✅ Page header — back button (ChevronLeft) + centered title + symmetric spacer
- ✅ Category filter — reused as-is
- ✅ Single-column card list
- ✅ Bottom search bar — MobileBottomSearchBar, debounced 400 ms
- ✅ Skeleton updated to single-column
- ✅ SuperMobileShellRouteLayout removed
- ✅ Sheet search drawer removed
- ✅ My Crew nav button removed
- ✅ data-testid attributes preserved

**Placeholder scan:** No TBD/TODO found.

**Type consistency:**
- `EmployeeCardMobileProps` — same in both tasks (props unchanged)
- `StoreAgentView` — imported from `@/services/crew/CrewService`, used consistently
- `MobileBottomSearchBarProps.clearAriaLabel` — string ✅ (matches component types.ts)
- `useDebounce` from `ahooks` — `{ wait: 400 }` matches usage pattern in ChatsPage
