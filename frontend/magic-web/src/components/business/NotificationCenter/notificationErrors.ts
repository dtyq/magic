export const NOTIFICATION_ERROR_CODE = {
	NOT_FOUND: 35000,
	WITHDRAWN: 35001,
	ACTIONED: 35002,
	EXPIRED: 35003,
	VERSION_MISMATCH: 35004,
	TEMPLATE_NOT_FOUND: 35010,
	HANDLER_UNAVAILABLE: 35011,
} as const

export function getBusinessCode(error: unknown): number | undefined {
	if (!error || typeof error !== "object" || !("code" in error)) return undefined
	const code = (error as { code: unknown }).code
	return typeof code === "number" ? code : undefined
}

export function shouldRefreshAfterNotificationError(code: number | undefined) {
	return (
		code === NOTIFICATION_ERROR_CODE.NOT_FOUND ||
		code === NOTIFICATION_ERROR_CODE.WITHDRAWN ||
		code === NOTIFICATION_ERROR_CODE.ACTIONED ||
		code === NOTIFICATION_ERROR_CODE.EXPIRED ||
		code === NOTIFICATION_ERROR_CODE.VERSION_MISMATCH
	)
}
