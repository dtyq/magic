export type NotificationCategory = "system" | "auth"
export type NotificationTab = "all" | NotificationCategory
export type NotificationAuthStatus = "pending" | "accepted" | "rejected"

export type NotificationIconName =
	| "users"
	| "share"
	| "project"
	| "file"
	| "alert"
	| "spark"
	| "points"
	| "payment"
	| "success"
	| "robot"
	| "microApp"
	| "connector"

export type NotificationId = string

export interface NotificationItemData {
	id: NotificationId
	category: NotificationCategory
	type: string
	template_version: number
	payload: Record<string, unknown>
	created_at: string
	message_status?: "active" | "withdrawn"
	is_unread: boolean
	auth_status?: NotificationAuthStatus
	business_result?: "applied" | "expired"
}

export interface NotificationTemplateCatalog {
	locale: string
	catalog_version: number
	templates: Record<string, { title_template: string; body_template: string }>
}
