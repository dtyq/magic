import { createPortal } from "react-dom"
import { useMemo } from "react"
import type { MagicClawItem } from "@/apis"
import type { MagiClawContextMenuAnchorRect } from "./useMagiClawMobilePage"
import { getMagiClawRowId } from "./useMagiClawMobilePage"

interface MagiClawMobileContextMenuProps {
	claw: MagicClawItem
	anchorRect: MagiClawContextMenuAnchorRect
	editLabel: string
	restartLabel: string
	toggleRunLabel: string
	deleteLabel: string
	onClose: () => void
	onEdit: () => void
	onRestart: () => void
	onToggleRun: () => void
	onDelete: () => void
}

const MENU_WIDTH = 208
const MENU_ITEM_HEIGHT = 48
const MENU_ITEM_COUNT = 4
const MENU_VIEWPORT_GAP = 8
const MENU_TRIGGER_GAP = 6

interface MagiClawContextMenuPosition {
	top: number
	left: number
}

/**
 * 根据锚点矩形计算菜单位置，优先让菜单右侧贴齐触发按钮并向下展开。
 */
function resolveContextMenuPosition(anchorRect: MagiClawContextMenuAnchorRect) {
	const estimatedMenuHeight = MENU_ITEM_COUNT * MENU_ITEM_HEIGHT + (MENU_ITEM_COUNT - 1)
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
 * MagiClawMobileContextMenu 复刻原型中的锚点三点菜单，而不是移动端底部抽屉。
 */
export function MagiClawMobileContextMenu({
	claw,
	anchorRect,
	editLabel,
	restartLabel,
	toggleRunLabel,
	deleteLabel,
	onClose,
	onEdit,
	onRestart,
	onToggleRun,
	onDelete,
}: MagiClawMobileContextMenuProps) {
	const rowId = getMagiClawRowId(claw)
	const actions = useMemo(
		() => [
			{
				key: "edit",
				label: editLabel,
				danger: false,
				onClick: onEdit,
				testId: `magi-claw-mobile-item-edit-${rowId}`,
			},
			{
				key: "restart",
				label: restartLabel,
				danger: false,
				onClick: onRestart,
				testId: `magi-claw-mobile-item-restart-${rowId}`,
			},
			{
				key: "toggle-run",
				label: toggleRunLabel,
				danger: false,
				onClick: onToggleRun,
				testId: `magi-claw-mobile-item-toggle-run-${rowId}`,
			},
			{
				key: "delete",
				label: deleteLabel,
				danger: true,
				onClick: onDelete,
				testId: `magi-claw-mobile-item-delete-${rowId}`,
			},
		],
		[
			deleteLabel,
			editLabel,
			onDelete,
			onEdit,
			onRestart,
			onToggleRun,
			restartLabel,
			rowId,
			toggleRunLabel,
		],
	)
	const position = resolveContextMenuPosition(anchorRect)

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
							className="flex h-12 w-full items-center px-4 transition-colors active:opacity-60"
							data-testid={action.testId}
							onClick={() => {
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
