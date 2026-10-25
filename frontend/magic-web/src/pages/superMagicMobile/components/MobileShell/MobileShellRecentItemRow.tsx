import { useRef, type TouchEvent } from "react"
import { useLongPress, useMemoizedFn } from "ahooks"
import { Ellipsis, Loader } from "lucide-react"
import { cn } from "@/utils/cn"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { isCollaborationProject, isWorkspaceShortcutProject } from "@/pages/superMagic/constants"
import ProjectTypeTag, {
	RECENT_PROJECT_LINE_MARK_CLASS_NAME,
	RECENT_PROJECT_MARK_CLASS_NAME,
	RECENT_PROJECT_MARK_SIZE,
} from "@/pages/superMagic/components/ProjectTypeTag"
import PinnedTag from "@/pages/superMagic/components/EmptyWorkspacePanel/components/ProjectItem/components/PinnedTag"
import CollaborationProjectTag from "@/pages/superMagic/components/CollaborationProjectTag"
import type { MobileShellMenuRecentItem } from "./MobileShellMenuContext"
import { getRecentItemActionAnchor } from "./utils/recentItemActionAnchor"

/**
 * Same marks after the name as the web sidebar's recent rows (CollapsedWorkspaceProjectRow):
 * project type (lobster, agent, micro-app, AI canvas…), pinned, then collaboration or shortcut,
 * as plain 14px icons without chip backgrounds.
 */
function RecentProjectTags({ project }: { project: ProjectListItem }) {
	const showCollaborationTag =
		isWorkspaceShortcutProject(project) || isCollaborationProject(project)
	return (
		<div className="flex shrink-0 items-center gap-1">
			{/* No hover on touch: tooltips stay off. */}
			<ProjectTypeTag
				projectMode={project.project_mode}
				tooltipDisabled
				size={RECENT_PROJECT_MARK_SIZE}
				uniformStroke
			/>
			{project.is_pinned ? <PinnedTag className={RECENT_PROJECT_MARK_CLASS_NAME} /> : null}
			{showCollaborationTag ? (
				<CollaborationProjectTag
					project={project}
					showText={false}
					className={RECENT_PROJECT_LINE_MARK_CLASS_NAME}
				/>
			) : null}
		</div>
	)
}

export type RecentItemActionSource = "more" | "longPress"

/** Max finger movement (px) still treated as a tap; scrolling beyond this suppresses navigation. */
const RECENT_ITEM_TAP_MOVE_THRESHOLD = 10

// Shared recent-row selectors stay stable across routes and API-provided project ids.
const MOBILE_SHELL_RECENT_ITEM_TEST_ID_PREFIX = "mobile-super-shell-recent"

/** Clears browser text selection so long-press context menus do not leave highlighted copy. */
function clearTextSelection() {
	if (typeof window === "undefined") return

	const selection = window.getSelection()
	if (!selection || selection.isCollapsed) return

	selection.removeAllRanges()
}

export interface MobileShellRecentItemRowProps {
	item: MobileShellMenuRecentItem
	/** Kept for caller compatibility; shared sidebar selectors are intentionally route-agnostic. */
	testIdPrefix: string
	moreAriaLabel: string
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
	moreAriaLabel,
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
		// Prevent iOS from starting a text-selection range before long-press menu opens.
		clearTextSelection()
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

			clearTextSelection()
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
			className="grid h-9 w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center rounded-lg"
			data-testid={`${MOBILE_SHELL_RECENT_ITEM_TEST_ID_PREFIX}-item`}
		>
			<button
				ref={titleRef}
				type="button"
				data-testid={`${MOBILE_SHELL_RECENT_ITEM_TEST_ID_PREFIX}-title-button`}
				onContextMenu={(event) => event.preventDefault()}
				onTouchStart={handleTitleTouchStart}
				onTouchMove={handleTitleTouchMove}
				onTouchCancel={handleTitleTouchCancel}
				className="flex h-9 min-w-0 touch-pan-y select-none items-center gap-2 overflow-hidden rounded-lg px-2 text-left text-sm text-foreground [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] [&_*]:select-none"
			>
				{item.inProgress && (
					<Loader className="size-4 shrink-0 animate-spin text-foreground" />
				)}
				<div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
					<span className="min-w-0 truncate leading-5">{item.title}</span>
					{item.project ? <RecentProjectTags project={item.project} /> : null}
				</div>
			</button>
			<button
				type="button"
				disabled={!item.project}
				onClick={handleOpenActionsFromMore}
				data-testid={`${MOBILE_SHELL_RECENT_ITEM_TEST_ID_PREFIX}-actions-button`}
				className={cn(
					"flex size-9 shrink-0 items-center justify-center self-center rounded-lg text-foreground [-webkit-tap-highlight-color:transparent]",
					!item.project && "opacity-40",
				)}
				aria-label={moreAriaLabel}
			>
				<Ellipsis className="size-4 shrink-0" />
			</button>
		</div>
	)
}
