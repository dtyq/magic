export const MAGI_CLAW_DISPLAY_STATUS = {
	RESTARTING: "Restarting",
} as const

export type MagiClawDisplayStatus =
	(typeof MAGI_CLAW_DISPLAY_STATUS)[keyof typeof MAGI_CLAW_DISPLAY_STATUS]
