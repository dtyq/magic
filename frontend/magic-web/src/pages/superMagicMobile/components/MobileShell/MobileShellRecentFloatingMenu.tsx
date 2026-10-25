import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import type { ActionButtonConfig } from "@/pages/superMagicMobile/components/ActionsPopup/types"

const MENU_WIDTH = 208
const ITEM_HEIGHT = 48

/** Matches action menuitem row metrics so empty state does not look visually smaller. */
const FLOATING_MENU_EMPTY_ROW_CLASS =
	"flex min-h-12 w-full items-center px-4 py-3 text-left text-base leading-5 text-muted-foreground whitespace-normal"

// Shared recent floating-menu selectors are route-agnostic for cross-page sidebar tests.
const MOBILE_SHELL_RECENT_FLOATING_MENU_TEST_ID_PREFIX = "mobile-super-shell"

export interface FloatingMenuAnchor {
	clientX: number
	clientY: number
}

export interface MobileShellRecentFloatingMenuProps {
	actions: ActionButtonConfig[]
	position: FloatingMenuAnchor
	/** Kept for caller compatibility; shared sidebar selectors are intentionally route-agnostic. */
	testIdPrefix: string
	onClose: () => void
}

/** Estimates menu height for positioning; empty state uses a single row. */
function estimateFloatingMenuHeight(actionCount: number) {
	if (actionCount <= 0) return ITEM_HEIGHT

	return actionCount * ITEM_HEIGHT + Math.max(0, actionCount - 1)
}

/** Computes fixed menu coordinates so the card stays inside the viewport. */
export function computeRecentFloatingMenuPosition(anchor: FloatingMenuAnchor, actionCount: number) {
	const estimatedMenuHeight = estimateFloatingMenuHeight(actionCount)
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
	onClose,
}: MobileShellRecentFloatingMenuProps) {
	const { t } = useTranslation("super")
	const isEmpty = actions.length === 0
	const { top, left } = computeRecentFloatingMenuPosition(position, actions.length)

	return createPortal(
		<>
			<div
				className="fixed inset-0 z-[200]"
				onClick={onClose}
				aria-hidden
				data-testid={`${MOBILE_SHELL_RECENT_FLOATING_MENU_TEST_ID_PREFIX}-recent-floating-menu-backdrop`}
			/>
			<div
				className="fixed z-[201] w-max min-w-[208px] max-w-[calc(100vw-16px)] overflow-hidden rounded-2xl border border-border bg-background shadow-[0px_8px_32px_0px_rgba(0,0,0,0.36)] dark:shadow-[0px_8px_32px_0px_rgba(0,0,0,0.5)]"
				style={{ top, left }}
				data-testid={`${MOBILE_SHELL_RECENT_FLOATING_MENU_TEST_ID_PREFIX}-recent-floating-menu`}
				role="menu"
			>
				{isEmpty ? (
					<div
						role="status"
						className={FLOATING_MENU_EMPTY_ROW_CLASS}
						data-testid={`${MOBILE_SHELL_RECENT_FLOATING_MENU_TEST_ID_PREFIX}-recent-floating-menu-empty`}
					>
						{t("mobile.shell.noAvailableQuickActions")}
					</div>
				) : (
					actions.map((action, index) => (
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
					))
				)}
			</div>
		</>,
		document.body,
	)
}
