import { createPortal } from "react-dom"
import { useMemo } from "react"
import type { MagicClawItem } from "@/apis"
import type { MagiClawContextMenuAnchorRect } from "./useMagiClawMobilePage"
import { getMagiClawRowId } from "./useMagiClawMobilePage"
import { resolveMagiClawActionAvailability } from "./resolveMagiClawActionAvailability"

interface MagiClawMobileContextMenuProps {
	claw: MagicClawItem
	anchorRect: MagiClawContextMenuAnchorRect
	displayStatus?: string | null
	isActionLoading?: boolean
	editLabel: string
	restartLabel: string
	startLabel: string
	stopLabel: string
	deleteLabel: string
	onClose: () => void
	onEdit: () => void
	onRestart: () => void
	onStart: () => void
	onStop: () => void
	onDelete: () => void
}

const MENU_WIDTH = 208
const MENU_ITEM_HEIGHT = 48
const MENU_VIEWPORT_GAP = 8
const MENU_TRIGGER_GAP = 6

interface MagiClawContextMenuPosition {
	top: number
	left: number
}

/**
 * Computes anchored menu coordinates, preferring to align the menu's right edge with the trigger.
 */
function resolveContextMenuPosition(anchorRect: MagiClawContextMenuAnchorRect, itemCount: number) {
	const estimatedMenuHeight = itemCount * MENU_ITEM_HEIGHT + Math.max(itemCount - 1, 0)
	const viewportWidth = window.innerWidth
	const viewportHeight = window.innerHeight
	const preferredLeft = anchorRect.right - MENU_WIDTH
	const left = Math.min(preferredLeft, viewportWidth - MENU_WIDTH - MENU_VIEWPORT_GAP)
	const spaceBelow = viewportHeight - anchorRect.bottom - MENU_VIEWPORT_GAP
	const top =
		spaceBelow > estimatedMenuHeight
			? anchorRect.bottom + MENU_TRIGGER_GAP
			: anchorRect.top - estimatedMenuHeight - MENU_TRIGGER_GAP

	return {
		top: Math.max(MENU_VIEWPORT_GAP, top),
		left: Math.max(MENU_VIEWPORT_GAP, left),
	} satisfies MagiClawContextMenuPosition
}

/**
 * MagiClawMobileContextMenu mirrors the desktop dropdown rules via resolveMagiClawActionAvailability.
 */
export function MagiClawMobileContextMenu({
	claw,
	anchorRect,
	displayStatus,
	isActionLoading = false,
	editLabel,
	restartLabel,
	startLabel,
	stopLabel,
	deleteLabel,
	onClose,
	onEdit,
	onRestart,
	onStart,
	onStop,
	onDelete,
}: MagiClawMobileContextMenuProps) {
	const rowId = getMagiClawRowId(claw)

	const actions = useMemo(() => {
		// Compute availability inside memo so primitive deps (displayStatus, isActionLoading)
		// control recomputation instead of a freshly-allocated object on every render.
		const actionAvailability = resolveMagiClawActionAvailability({
			displayStatus,
			isActionLoading,
		})

		const menuActions: Array<{
			key: string
			label: string
			danger: boolean
			disabled: boolean
			onClick: () => void
			testId: string
		}> = []

		if (actionAvailability.edit.visible) {
			menuActions.push({
				key: "edit",
				label: editLabel,
				danger: false,
				disabled: actionAvailability.edit.disabled,
				onClick: onEdit,
				testId: `magi-claw-mobile-item-edit-${rowId}`,
			})
		}

		if (actionAvailability.restart.visible) {
			menuActions.push({
				key: "restart",
				label: restartLabel,
				danger: false,
				disabled: actionAvailability.restart.disabled,
				onClick: onRestart,
				testId: `magi-claw-mobile-item-restart-${rowId}`,
			})
		}

		if (actionAvailability.stop.visible) {
			menuActions.push({
				key: "stop",
				label: stopLabel,
				danger: false,
				disabled: actionAvailability.stop.disabled,
				onClick: onStop,
				testId: `magi-claw-mobile-item-stop-${rowId}`,
			})
		}

		if (actionAvailability.start.visible) {
			menuActions.push({
				key: "start",
				label: startLabel,
				danger: false,
				disabled: actionAvailability.start.disabled,
				onClick: onStart,
				testId: `magi-claw-mobile-item-start-${rowId}`,
			})
		}

		if (actionAvailability.delete.visible) {
			menuActions.push({
				key: "delete",
				label: deleteLabel,
				danger: true,
				disabled: actionAvailability.delete.disabled,
				onClick: onDelete,
				testId: `magi-claw-mobile-item-delete-${rowId}`,
			})
		}

		return menuActions
	}, [
		displayStatus,
		isActionLoading,
		deleteLabel,
		editLabel,
		onDelete,
		onEdit,
		onRestart,
		onStart,
		onStop,
		restartLabel,
		rowId,
		startLabel,
		stopLabel,
	])

	if (actions.length === 0) return null

	const position = resolveContextMenuPosition(anchorRect, actions.length)

	return createPortal(
		<>
			<div className="fixed inset-0 z-[1200]" aria-hidden="true" onClick={onClose} />
			<div
				className="fixed z-[1201] overflow-hidden rounded-2xl border border-border/80 bg-background/95 backdrop-blur-sm"
				style={{
					top: position.top,
					left: position.left,
					minWidth: MENU_WIDTH,
					boxShadow: "0px 14px 36px 0px rgba(0,0,0,0.24)",
				}}
				data-testid={`magi-claw-mobile-context-menu-${rowId}`}
			>
				{actions.map((action, index) => (
					<div key={action.key}>
						<button
							type="button"
							className="flex h-12 w-full items-center px-4 transition-colors active:opacity-60 disabled:opacity-40"
							data-testid={action.testId}
							disabled={action.disabled}
							onClick={() => {
								if (action.disabled) return
								action.onClick()
								onClose()
							}}
						>
							<span
								className={`flex-1 text-left text-[16px] leading-5 ${
									action.danger ? "text-destructive" : "text-foreground"
								}`}
							>
								{action.label}
							</span>
						</button>
						{index < actions.length - 1 ? <div className="h-px bg-border/70" /> : null}
					</div>
				))}
			</div>
		</>,
		document.body,
	)
}
