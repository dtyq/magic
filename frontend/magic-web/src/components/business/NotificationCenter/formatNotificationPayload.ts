import i18next from "i18next"

function text(value: unknown) {
	if (value == null || value === "") return "-"
	return String(value)
}

export function formatNotificationPermission(value: unknown) {
	if (value === "viewer") return i18next.t("inbox.permission.viewer", { ns: "sidebar" })
	if (value === "editor") return i18next.t("inbox.permission.editor", { ns: "sidebar" })
	// Collaboration roles use "manage"; retain "manager" for existing notification payloads.
	if (value === "manage" || value === "manager")
		return i18next.t("inbox.permission.manager", { ns: "sidebar" })
	return text(value)
}

function formatShareScope(value: unknown) {
	if (value === "all") return i18next.t("inbox.shareScope.all", { ns: "sidebar" })
	if (value === "specific") return i18next.t("inbox.shareScope.specific", { ns: "sidebar" })
	return text(value)
}

/** Payload display values for template substitution. Field-level missing values become "-". */
export function formatNotificationPayload(payload: Record<string, unknown>) {
	const next: Record<string, unknown> = { ...payload }
	if ("permission" in payload) next.permission = formatNotificationPermission(payload.permission)
	if ("share_scope" in payload) next.share_scope = formatShareScope(payload.share_scope)
	return next
}

export function notificationPointsAmount(payload: Record<string, unknown>) {
	const points = payload.points
	if (points == null || points === "") return undefined
	return `+${points}`
}

export function notificationResource(payload: Record<string, unknown>) {
	const organization = payload.organization_name
	const permission = payload.permission
	if (organization == null && permission == null) return undefined
	return {
		organization: text(organization),
		permission: formatNotificationPermission(permission),
	}
}
