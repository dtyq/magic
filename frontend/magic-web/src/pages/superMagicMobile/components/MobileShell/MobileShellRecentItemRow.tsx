import { useRef, type TouchEvent } from "react"
import { useLongPress, useMemoizedFn } from "ahooks"
import { Ellipsis, Loader } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MobileShellMenuRecentItem } from "./MobileShellMenuContext"
import { getRecentItemActionAnchor } from "./utils/recentItemActionAnchor"

/** Linked workspace badge (12×12, two overlapping squares). */
function LinkedBadgeIcon() {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden
		>
			<path
				d="M9.5 4.134C9.65202 4.22177 9.77825 4.348 9.86602 4.50001C9.95379 4.65203 10 4.82447 10 5V9C10 9.26522 9.89464 9.51957 9.70711 9.70711C9.51957 9.89464 9.26522 10 9 10H5C4.73478 10 4.48043 9.89464 4.29289 9.70711C4.10536 9.51957 4 9.26522 4 9V5C4 4.73478 4.10536 4.48043 4.29289 4.29289C4.48043 4.10536 4.73478 4 5 4H6.5M2.5 7.867C2.34784 7.77915 2.22151 7.65276 2.13373 7.50055C2.04595 7.34835 1.99983 7.1757 2 7V3C2 2.73478 2.10536 2.48043 2.29289 2.29289C2.48043 2.10536 2.73478 2 3 2H7C7.26522 2 7.51957 2.10536 7.70711 2.29289C7.89464 2.48043 8 2.73478 8 3V7C8 7.26522 7.89464 7.51957 7.70711 7.70711C7.51957 7.89464 7.26522 8 7 8H5.5"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

/** Collaboration shared badge (12×12, user share icon). */
function SharedBadgeIcon() {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden
		>
			<path
				d="M2.5 3.5C2.5 4.03043 2.71071 4.53914 3.08579 4.91421C3.46086 5.28929 3.96957 5.5 4.5 5.5C5.03043 5.5 5.53914 5.28929 5.91421 4.91421C6.28929 4.53914 6.5 4.03043 6.5 3.5C6.5 2.96957 6.28929 2.46086 5.91421 2.08579C5.53914 1.71071 5.03043 1.5 4.5 1.5C3.96957 1.5 3.46086 1.71071 3.08579 2.08579C2.71071 2.46086 2.5 2.96957 2.5 3.5Z"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M1.5 10.5V9.5C1.5 8.96957 1.71071 8.46086 2.08579 8.08579C2.46086 7.71071 2.96957 7.5 3.5 7.5H5.5C6.03043 7.5 6.53914 7.71071 6.91421 8.08579C7.28929 8.46086 7.5 8.96957 7.5 9.5V10.5"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M8 1.565C8.43021 1.67515 8.81152 1.92535 9.08382 2.27616C9.35612 2.62696 9.50392 3.05841 9.50392 3.5025C9.50392 3.94659 9.35612 4.37804 9.08382 4.72884C8.81152 5.07965 8.43021 5.32985 8 5.44"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M10.5 10.5V9.5C10.4975 9.05858 10.349 8.6304 10.0776 8.2822C9.80631 7.934 9.42741 7.68535 9 7.575"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

export type RecentItemActionSource = "more" | "longPress"

/** Max finger movement (px) still treated as a tap; scrolling beyond this suppresses navigation. */
const RECENT_ITEM_TAP_MOVE_THRESHOLD = 10

export interface MobileShellRecentItemRowProps {
	item: MobileShellMenuRecentItem
	testIdPrefix: string
	moreAriaLabel: string
	isContextMenuOpen?: boolean
	onRecentNavigate: (item: MobileShellMenuRecentItem) => void
	onOpenActions: (
		item: MobileShellMenuRecentItem,
		source: RecentItemActionSource,
		anchor?: { clientX: number; clientY: number },
	) => void
}

/** Single row in the shell sidebar "Recently used" list with tap-to-navigate and long-press menu. */
export function MobileShellRecentItemRow({
	item,
	testIdPrefix,
	moreAriaLabel,
	isContextMenuOpen = false,
	onRecentNavigate,
	onOpenActions,
}: MobileShellRecentItemRowProps) {
	const titleRef = useRef<HTMLButtonElement>(null)
	// Tracks whether the current touch gesture moved enough to count as scroll (not a tap).
	const hasGestureMovedRef = useRef(false)
	const touchStartPositionRef = useRef<{ x: number; y: number } | null>(null)

	const handleNavigate = useMemoizedFn(() => {
		onRecentNavigate(item)
	})

	const handleOpenActionsFromMore = useMemoizedFn(() => {
		if (!item.project) return

		onOpenActions(item, "more")
	})

	/** Reads the first active touch point for movement threshold checks. */
	const getTouchClientPosition = useMemoizedFn((event: TouchEvent) => {
		const touch = event.touches[0] ?? event.changedTouches[0]
		if (!touch) return null

		return { x: touch.clientX, y: touch.clientY }
	})

	/** Marks the gesture as scroll when finger displacement exceeds the tap threshold. */
	const markGestureMovedIfNeeded = useMemoizedFn((clientX: number, clientY: number) => {
		const start = touchStartPositionRef.current
		if (!start) return

		const deltaX = Math.abs(clientX - start.x)
		const deltaY = Math.abs(clientY - start.y)
		if (deltaX > RECENT_ITEM_TAP_MOVE_THRESHOLD || deltaY > RECENT_ITEM_TAP_MOVE_THRESHOLD) {
			hasGestureMovedRef.current = true
		}
	})

	const handleTitleTouchStart = useMemoizedFn((event: TouchEvent) => {
		hasGestureMovedRef.current = false
		const position = getTouchClientPosition(event)
		touchStartPositionRef.current = position
	})

	const handleTitleTouchMove = useMemoizedFn((event: TouchEvent) => {
		const position = getTouchClientPosition(event)
		if (!position) return

		markGestureMovedIfNeeded(position.x, position.y)
	})

	const handleTitleTouchCancel = useMemoizedFn((event: TouchEvent) => {
		const position = getTouchClientPosition(event)
		if (position) {
			markGestureMovedIfNeeded(position.x, position.y)
		}
		hasGestureMovedRef.current = true
		touchStartPositionRef.current = null
	})

	// useLongPress owns short tap vs long press; native onClick is intentionally omitted on the title button.
	useLongPress(
		(event) => {
			if (!item.project) return

			onOpenActions(item, "longPress", getRecentItemActionAnchor(event))
		},
		titleRef,
		{
			delay: 500,
			moveThreshold: { x: 20, y: 20 },
			onClick: () => {
				// ahooks still fires onClick after scroll; skip navigation when the finger moved.
				if (hasGestureMovedRef.current) return

				handleNavigate()
			},
		},
	)

	return (
		// Single grid row: title column shrinks; more button stays right-aligned and vertically centered.
		<div
			className={cn(
				"grid h-9 w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center rounded-lg",
				isContextMenuOpen &&
					"dark:ring-white/12 bg-background shadow-sm dark:bg-zinc-950 dark:shadow-md dark:ring-1",
			)}
		>
			<button
				ref={titleRef}
				type="button"
				data-testid={`${testIdPrefix}-recent-${item.id}`}
				onContextMenu={(event) => event.preventDefault()}
				onTouchStart={handleTitleTouchStart}
				onTouchMove={handleTitleTouchMove}
				onTouchCancel={handleTitleTouchCancel}
				className="flex h-9 min-w-0 touch-pan-y items-center gap-2 overflow-hidden rounded-lg px-2 text-left text-sm text-foreground transition-colors active:bg-black/5 dark:active:bg-white/10"
			>
				{item.inProgress && (
					<Loader className="size-4 shrink-0 animate-spin text-foreground" />
				)}
				<div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
					<span className="min-w-0 truncate leading-5">{item.title}</span>
					{(item.isLinked || item.isShared) && (
						<div className="flex shrink-0 items-center gap-1">
							{item.isLinked && (
								<span className="flex items-center rounded-[6px] border border-border bg-muted p-[2px] text-muted-foreground">
									<LinkedBadgeIcon />
								</span>
							)}
							{item.isShared && (
								<span className="flex items-center rounded-[6px] border border-info/30 bg-info/10 p-[2px] text-info">
									<SharedBadgeIcon />
								</span>
							)}
						</div>
					)}
				</div>
			</button>
			<button
				type="button"
				disabled={!item.project}
				onClick={handleOpenActionsFromMore}
				data-testid={`${testIdPrefix}-recent-actions-${item.id}`}
				className={cn(
					"flex size-9 shrink-0 items-center justify-center self-center rounded-lg text-foreground transition-colors active:bg-black/5 dark:active:bg-white/10",
					!item.project && "opacity-40",
				)}
				aria-label={moreAriaLabel}
			>
				<Ellipsis className="size-4 shrink-0" />
			</button>
		</div>
	)
}
