import type { NotificationListItem } from "@/apis/modules/notifications"
import type { NotificationIconName, NotificationItemData } from "./types"

const ICON_BY_TYPE: Record<string, NotificationIconName> = {
	payment_success: "payment",
	points_referral_reward: "points",
	points_manual_reward: "points",
	task_finished: "success",
	task_failed: "alert",
	project_shared: "project",
	file_shared: "file",
	skill_approved: "spark",
	agent_approved: "robot",
	project_invitation: "users",
	project_access_revoked: "project",
	agent_invitation: "robot",
	agent_access_revoked: "robot",
	skill_invitation: "spark",
	skill_access_revoked: "spark",
	micro_app_invitation: "microApp",
	micro_app_access_revoked: "microApp",
}

const ICON_BY_RESOURCE_TYPE: Record<string, NotificationIconName> = {
	project: "project",
	skill: "spark",
	agent: "robot",
	file: "file",
	micro_app: "microApp",
	mcp: "connector",
	connector: "connector",
}

export function notificationIconForType(
	type: string,
	resourceType?: unknown,
): NotificationIconName {
	if (Object.prototype.hasOwnProperty.call(ICON_BY_TYPE, type)) return ICON_BY_TYPE[type]
	// Keep resource artwork for events without a dedicated mapping, including future event types.
	const normalizedResourceType =
		typeof resourceType === "string" ? resourceType.trim().toLowerCase() : ""
	if (Object.prototype.hasOwnProperty.call(ICON_BY_RESOURCE_TYPE, normalizedResourceType))
		return ICON_BY_RESOURCE_TYPE[normalizedResourceType]
	return "share"
}

export function mapNotificationItem(item: NotificationListItem): NotificationItemData {
	// Handling an invitation clears its dot even when the API read state lags behind.
	const isHandledAuthorization =
		item.category === "authorization" &&
		(item.action_status === "accepted" || item.action_status === "rejected")
	return {
		id: item.notification_id,
		category: item.category === "authorization" ? "auth" : "system",
		type: item.type,
		template_version: item.template_version,
		payload: item.payload ?? {},
		created_at: item.created_at,
		message_status: item.message_status,
		is_unread: item.read_status === "unread" && !isHandledAuthorization,
		auth_status:
			item.action_status === "pending" ||
			item.action_status === "accepted" ||
			item.action_status === "rejected"
				? item.action_status
				: undefined,
	}
}

export function toApiCategory(tab: "all" | "system" | "auth") {
	if (tab === "auth") return "authorization" as const
	return tab
}
