import type { PageParams } from "./common"

export enum AiAuditStatus {
	Finished = "finished",
	Waiting = "waiting",
	Running = "running",
	Error = "error",
	Suspended = "suspended",
}

export interface AiAuditRequest extends PageParams {
	/**
	 * 组织代码
	 */
	organization_code?: string
	/**
	 * 项目id
	 */
	project_id?: string
	/**
	 * 话题id
	 */
	topic_id?: string
	/**
	 * 话题名称
	 */
	topic_name?: string
	/**
	 * 话题状态
	 */
	topic_status?: AiAuditStatus
	/**
	 * 用户名称
	 */
	user_name?: string
	[property: string]: any
}

export interface RiskMarkRequest {
	/**
	 * 风险原因
	 */
	risk_reason: string
}

export interface RiskReasonResponse {
	/**
	 * 风险原因
	 */
	risk_reason?: string
	/**
	 * 风险等级
	 */
	risk_level?: number
	/**
	 * 状态
	 */
	status?: number
	/**
	 * 创建时间
	 */
	create_time?: string
	/**
	 * 更新时间
	 */
	update_time?: string
}

export interface UsageData {
	key: string
	user_name: string
	user_id: string
	user_phone?: string
	organization_code: string
	organization_name: string
	topic_name: string
	topic_id: string
	topic_status: AiAuditStatus
	create_time: string
	last_update_time: string
	sandbox_id: string
	project_id: string
	task_rounds: number
	last_task_start_time: string
	last_message_send_timestamp: string
	last_message_content: string
	limit_times: number
	cost: number
	risk_info: {
		has_risk: boolean
	}
	[key: string]: unknown
}
