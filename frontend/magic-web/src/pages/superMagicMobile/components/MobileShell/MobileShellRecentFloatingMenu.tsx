import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import type { ActionButtonConfig } from "@/pages/superMagicMobile/components/ActionsPopup/types"

const MENU_WIDTH = 208
const ITEM_HEIGHT = 48

export interface FloatingMenuAnchor {
	clientX: number
	clientY: number
}

export interface MobileShellRecentFloatingMenuProps {
	actions: ActionButtonConfig[]
	position: FloatingMenuAnchor
	testIdPrefix: string
	onClose: () => void
}

/** Computes fixed menu coordinates so the card stays inside the viewport. */
export function computeRecentFloatingMenuPosition(anchor: FloatingMenuAnchor, actionCount: number) {
	const estimatedMenuHeight = actionCount * ITEM_HEIGHT + Math.max(0, actionCount - 1)
	const left = Math.min(anchor.clientX, window.innerWidth - MENU_WIDTH - 8)
	const spaceBelow = window.innerHeight - anchor.clientY - 8
	const top =
		spaceBelow > estimatedMenuHeight ? anchor.clientY : anchor.clientY - estimatedMenuHeight - 8

	return { top, left }
}

/** Prototype-style floating context menu for sidebar recent items (portal to body). */
export function MobileShellRecentFloatingMenu({
	actions,
	position,
	testIdPrefix,
	onClose,
}: MobileShellRecentFloatingMenuProps) {
	if (actions.length === 0) return null

	const { top, left } = computeRecentFloatingMenuPosition(position, actions.length)

	return createPortal(
		<>
			<div
				className="fixed inset-0 z-[200]"
				onClick={onClose}
				aria-hidden
				data-testid={`${testIdPrefix}-recent-floating-menu-backdrop`}
			/>
			<div
				className="fixed z-[201] min-w-[208px] overflow-hidden rounded-2xl border border-border bg-background shadow-[0px_8px_32px_0px_rgba(0,0,0,0.36)] dark:shadow-[0px_8px_32px_0px_rgba(0,0,0,0.5)]"
				style={{ top, left }}
				data-testid={`${testIdPrefix}-recent-floating-menu`}
				role="menu"
			>
				{actions.map((action, index) => (
					<div key={action.key}>
						<button
							type="button"
							role="menuitem"
							disabled={action.disabled}
							data-testid={action["data-testid"]}
							onClick={() => {
								onClose()
								action.onClick?.()
							}}
							className={cn(
								"flex h-12 w-full items-center px-4 text-left text-base leading-5 transition-opacity active:opacity-60",
								action.variant === "danger"
									? "text-destructive"
									: "text-foreground",
								action.disabled && "cursor-not-allowed opacity-50",
							)}
						>
							<span className="flex-1 truncate">{action.label}</span>
						</button>
						{index < actions.length - 1 && <div className="h-px bg-border" />}
					</div>
				))}
			</div>
		</>,
		document.body,
	)
}
