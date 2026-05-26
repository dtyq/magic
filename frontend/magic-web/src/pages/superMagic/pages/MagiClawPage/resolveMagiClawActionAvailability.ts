import { MAGIC_CLAW_STATUS } from "@/apis/modules/magicClawStatus"
import { MAGI_CLAW_DISPLAY_STATUS } from "./magiClawDisplayStatus"
import { getMagiClawMenuActionSequence, type MagiClawMenuAction } from "./magiClawMenuActions"

export type MagiClawLifecycleAction = "start" | "restart" | "stop"

export type MagiClawSecondaryAction = "edit" | "delete"

export type MagiClawResolvableAction = MagiClawLifecycleAction | MagiClawSecondaryAction

export interface MagiClawActionAvailability {
	visible: boolean
	disabled: boolean
}

export type MagiClawActionAvailabilityMap = Record<
	MagiClawResolvableAction,
	MagiClawActionAvailability
>

interface ResolveMagiClawActionAvailabilityParams {
	displayStatus?: string | null
	isActionLoading?: boolean
}

const LIFECYCLE_ACTIONS: MagiClawLifecycleAction[] = ["start", "restart", "stop"]
const SECONDARY_ACTIONS: MagiClawSecondaryAction[] = ["edit", "delete"]

function isTransientClawStatus(status?: string | null) {
	return status === MAGIC_CLAW_STATUS.PENDING || status === MAGI_CLAW_DISPLAY_STATUS.RESTARTING
}

function buildDefaultAvailability(visible: boolean, disabled: boolean): MagiClawActionAvailability {
	return { visible, disabled }
}

/**
 * Maps claw sandbox display status to per-action visibility and disabled state for mobile menus.
 */
export function resolveMagiClawActionAvailability({
	displayStatus,
	isActionLoading = false,
}: ResolveMagiClawActionAvailabilityParams): MagiClawActionAvailabilityMap {
	const menuSequence = new Set(
		getMagiClawMenuActionSequence(displayStatus).filter(
			(action): action is Exclude<MagiClawMenuAction, "divider"> => action !== "divider",
		),
	)
	const isTransient = isTransientClawStatus(displayStatus)

	const availability = {} as MagiClawActionAvailabilityMap

	for (const action of LIFECYCLE_ACTIONS) {
		const visible = menuSequence.has(action)
		availability[action] = buildDefaultAvailability(visible, !visible || isActionLoading)
	}

	for (const action of SECONDARY_ACTIONS) {
		if (action === "delete") {
			const visible = menuSequence.has("delete")
			availability.delete = buildDefaultAvailability(visible, !visible || isActionLoading)
			continue
		}

		// Edit stays visible on mobile but is blocked while sandbox is transitioning or an action is in flight.
		availability.edit = buildDefaultAvailability(true, isTransient || isActionLoading)
	}

	return availability
}
