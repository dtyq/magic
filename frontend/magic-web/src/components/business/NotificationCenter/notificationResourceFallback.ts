import i18next from "i18next"
import type { NotificationItemData } from "./types"

function hasDisplayName(value: unknown) {
	if (value == null) return false
	return String(value).trim() !== ""
}

/** Align inbox copy with super workspace / crew naming fallbacks elsewhere in the product. */
export function notificationUntitledResourceName(
	message: NotificationItemData,
): string | undefined {
	const type = message.type
	const resourceType =
		typeof message.payload.resource_type === "string"
			? message.payload.resource_type.trim().toLowerCase()
			: ""

	if (type.startsWith("task_")) return undefined

	if (type.includes("project") || resourceType === "project" || type === "project_shared") {
		return i18next.t("project.unnamedProject", { ns: "super" })
	}
	if (type.includes("skill") || resourceType === "skill") {
		return i18next.t("mySkills.untitledSkill", { ns: "crew/market" })
	}
	if (type.includes("agent") || resourceType === "agent") {
		return i18next.t("untitledCrew", { ns: "crew/create" })
	}
	if (type.includes("micro_app") || resourceType === "micro_app") {
		return i18next.t("microApp.unnamedApp", { ns: "super" })
	}
	if (type === "file_shared" || resourceType === "file") {
		return i18next.t("common.untitledFile", { ns: "super" })
	}
	return undefined
}

export function notificationUntitledNameForField(message: NotificationItemData, field: string) {
	if (field === "project_name") {
		return i18next.t("project.unnamedProject", { ns: "super" })
	}
	if (field === "workspace_name") {
		return i18next.t("workspace.unnamedWorkspace", { ns: "super" })
	}
	if (field === "resource_name") {
		return notificationUntitledResourceName(message)
	}
	return undefined
}

export function applyNotificationResourceNameFallbacks(
	message: NotificationItemData,
	payload: Record<string, unknown>,
) {
	if (!hasDisplayName(payload.resource_name) && !hasDisplayName(message.payload.resource_name)) {
		const fallback = notificationUntitledResourceName(message)
		if (fallback) payload.resource_name = fallback
	}
}

export function notificationResourceLinkLabel(
	message: NotificationItemData,
	field: string,
	payload: Record<string, unknown>,
	partText: string,
) {
	const raw = String(payload[field] ?? "").trim()
	if (raw && raw !== "-") return partText
	return notificationUntitledNameForField(message, field) ?? partText
}
