import { MAGIC_CLAW_STATUS } from "@/apis/modules/magicClawStatus"

export type MagiClawMenuAction = "start" | "restart" | "stop" | "delete" | "divider"

const MAGI_CLAW_MENU_ACTIONS = {
	pending: ["delete"],
	running: ["restart", "stop", "divider", "delete"],
	default: ["start", "divider", "delete"],
} as const satisfies Record<string, readonly MagiClawMenuAction[]>

export function getMagiClawMenuActionSequence(status?: string | null) {
	if (status === MAGIC_CLAW_STATUS.PENDING) return MAGI_CLAW_MENU_ACTIONS.pending
	if (status === MAGIC_CLAW_STATUS.RUNNING) return MAGI_CLAW_MENU_ACTIONS.running
	return MAGI_CLAW_MENU_ACTIONS.default
}
