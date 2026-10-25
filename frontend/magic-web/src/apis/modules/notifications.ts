import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"

export type NotificationCategory = "system" | "authorization"
export type NotificationListCategory = "all" | NotificationCategory
export type NotificationReadStatus = "unread" | "read"
export type NotificationActionStatus = "none" | "pending" | "accepted" | "rejected"
export type NotificationMessageStatus = "active" | "withdrawn"
export type NotificationBusinessResult = "applied" | "expired"

export interface NotificationListItem {
	notification_id: string
	category: NotificationCategory
	type: string
	template_version: number
	payload: Record<string, unknown>
	message_status: NotificationMessageStatus
	read_status: NotificationReadStatus
	action_status: NotificationActionStatus
	created_at: string
}

export interface NotificationListParams {
	category?: NotificationListCategory
	cursor?: string
	page_size?: number
}

export interface NotificationListResult {
	items: NotificationListItem[]
	page_size: number
	next_cursor: string | null
	has_more: boolean
}

export interface NotificationCounts {
	total: number
	system_unread: number
	authorization_pending: number
}

export interface NotificationUpdate {
	organization_code: string
	counts: NotificationCounts
	reason: "created" | "withdrawn" | "read" | "actioned"
	event_id: string
}

export interface NotificationUpdateMessage {
	type: "notification_update"
	notification_update: NotificationUpdate
}

export interface NotificationTemplateEntry {
	title_template: string
	body_template: string
}

export interface NotificationTemplateCatalog {
	locale: string
	catalog_version: number
	templates: Record<string, NotificationTemplateEntry>
	etag?: string
}

export interface NotificationReadResult {
	notification_id: string
	read_status: NotificationReadStatus
	read_at: string
}

export interface NotificationAcceptResult {
	notification_id: string
	action_status: "accepted"
	business_result: NotificationBusinessResult
	actioned_at: string
}

export interface NotificationRejectResult {
	notification_id: string
	action_status: "rejected"
	actioned_at: string
}

export const generateNotificationApi = (fetch: ServiceHttpClient) => ({
	listNotifications(params: NotificationListParams = {}) {
		return fetch.get<NotificationListResult>("/api/v1/notifications", {
			params: {
				category: params.category ?? "all",
				cursor: params.cursor,
				page_size: params.page_size ?? 10,
			},
		})
	},
	getNotificationCounts() {
		return fetch.get<NotificationCounts>("/api/v1/notifications/counts")
	},
	getNotificationTemplates(locale: "zh-CN" | "en-US") {
		return fetch.get<NotificationTemplateCatalog>("/api/v1/notification-templates", {
			params: { locale },
			enableErrorMessagePrompt: false,
		})
	},
	markNotificationRead(notificationId: string) {
		return fetch.post<NotificationReadResult>(
			`/api/v1/notifications/${notificationId}/read`,
			{},
		)
	},
	acceptNotification(notificationId: string) {
		return fetch.post<NotificationAcceptResult>(
			`/api/v1/notifications/${notificationId}/accept`,
			{},
			{ enableErrorMessagePrompt: false },
		)
	},
	rejectNotification(notificationId: string, reason?: string) {
		return fetch.post<NotificationRejectResult>(
			`/api/v1/notifications/${notificationId}/reject`,
			reason ? { reason } : {},
			{ enableErrorMessagePrompt: false },
		)
	},
})
