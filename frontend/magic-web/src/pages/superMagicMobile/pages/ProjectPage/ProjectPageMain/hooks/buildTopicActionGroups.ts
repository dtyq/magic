import type { ActionGroup } from "@/pages/superMagicMobile/components/ActionSheet"
import type { ActionsPopup } from "@/pages/superMagicMobile/components/ActionsPopup/types"

/**
 * Groups flat topic actions into ConversationActionsPopup rows (rename+share / delete).
 */
export function buildTopicActionGroups(actions: ActionsPopup.ActionButtonConfig[]): ActionGroup[] {
	const renameShareActions = actions.filter(
		(action) => action.key === "rename" || action.key === "share",
	)
	const deleteActions = actions.filter((action) => action.key === "delete")
	const groups: ActionGroup[] = []

	if (renameShareActions.length > 0) {
		groups.push({
			actions: renameShareActions.map((action) => ({
				key: action.key,
				label: action.label,
				onClick: action.onClick,
				variant: action.variant === "danger" ? ("danger" as const) : ("default" as const),
				disabled: action.disabled,
			})),
		})
	}

	if (deleteActions.length > 0) {
		groups.push({
			actions: deleteActions.map((action) => ({
				key: action.key,
				label: action.label,
				onClick: action.onClick,
				variant: "danger" as const,
				disabled: action.disabled,
			})),
		})
	}

	return groups
}
