import { memo } from "react"
import { useTranslation } from "react-i18next"

import {
	ActionDrawer,
	ActionGroup,
	ActionItem,
} from "@/components/shadcn-composed/action-drawer"

import type { ActionsPopup } from "./types"

/**
 * ActionsPopup - Generic action popup component
 * Refactored to use ActionDrawer from shadcn-composed
 *
 * @param props - Component props
 * @returns JSX.Element
 */
function ActionsPopupComponent(props: ActionsPopup.Props) {
	const { t } = useTranslation("super")
	const {
		visible,
		title,
		actions,
		onClose,
		showCancel = true,
		cancelText = t("common.cancel"),
		className,
	} = props

	return (
		<ActionDrawer
			open={visible}
			onOpenChange={(open) => {
				if (!open) {
					onClose?.()
				}
			}}
			title={title}
			showCancel={showCancel}
			cancelText={cancelText}
			onCancel={onClose}
			className={className}
		>
			<ActionGroup>
				{actions.map((action) => (
					<ActionItem
						key={action.key}
						label={action.label}
						onClick={action.onClick}
						variant={action.variant === "danger" ? "destructive" : "default"}
						disabled={action.disabled}
					/>
				))}
			</ActionGroup>
		</ActionDrawer>
	)
}

ActionsPopupComponent.displayName = "ActionsPopup"

// Export memoized component
const MemoizedActionsPopup = memo(ActionsPopupComponent)

// Default export
export default MemoizedActionsPopup

// Export namespace and types
export { ActionsPopup }
export type { ActionsPopupProps, ActionButtonConfig, ActionButtonProps } from "./types"
