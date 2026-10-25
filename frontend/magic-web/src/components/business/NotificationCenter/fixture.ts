import type { NotificationListItem } from "@/apis/modules/notifications"
import type { NotificationTemplateCatalog } from "./types"

export const NOTIFICATION_TEST_TEMPLATES: NotificationTemplateCatalog = {
	locale: "zh-CN",
	catalog_version: 1,
	templates: {
		"project_invitation:1": {
			title_template: "项目协作邀请",
			body_template: "{{inviter_name}} 邀请你加入项目「{{resource_name}}」",
		},
		"task_failed:1": {
			title_template: "任务执行失败",
			body_template: "{{workspace_name}} / {{project_name}} 执行失败，请重试。",
		},
	},
}

export function testNotification(
	partial: Partial<NotificationListItem> &
		Pick<NotificationListItem, "notification_id" | "category" | "type">,
): NotificationListItem {
	return {
		template_version: 1,
		payload: {},
		message_status: "active",
		read_status: "unread",
		action_status: partial.category === "authorization" ? "pending" : "none",
		created_at: "2026-09-16 11:15:06",
		...partial,
	}
}
