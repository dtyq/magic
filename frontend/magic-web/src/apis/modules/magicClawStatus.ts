export const MAGIC_CLAW_STATUS = {
	PENDING: "Pending",
	RUNNING: "Running",
	EXITED: "Exited",
	UNKNOWN: "Unknown",
	NOT_FOUND: "NotFound",
} as const

export type MagicClawStatus = (typeof MAGIC_CLAW_STATUS)[keyof typeof MAGIC_CLAW_STATUS]
