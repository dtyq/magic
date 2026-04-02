import type { PageParams } from "./common"

export namespace ModelAudit {
	export interface ModelAuditLogParams extends PageParams {
		start_date?: string
		end_date?: string
		product_code?: string
		organization_code?: string
		access_scope?: string
		magic_topic_id?: string
	}

	export interface ModelAuditUserInfo {
		user_id: string
		user_name: string
		organization_code: string
		phone: string
		email: string
	}

	export interface ModelAuditLogItem {
		id: string
		user_id: string
		organization_code: string
		ip: string
		type: string
		product_code: string
		status: string
		ak: string
		access_scope?: string
		points?: number
		magic_topic_id?: string
		operation_time: number
		all_latency: number
		usage: Record<string, unknown>
		detail_info: Record<string, unknown> | null
		user_info: ModelAuditUserInfo
	}
}
