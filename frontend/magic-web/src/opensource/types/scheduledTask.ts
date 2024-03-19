import { IMCPItem } from "@/opensource/components/Agent/MCP"
import { MentionListItem } from "@/opensource/components/business/MentionPanel/tiptap-plugin/types"
import { ModelItem } from "@/opensource/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import { JSONContent } from "@tiptap/core"

/** 定时任务 */
export namespace ScheduledTask {
	export interface GetListParams {
		page: number
		page_size: number
		/** 项目id */
		project_id?: string
		/** 状态，0 未启用 1 启用 */
		enabled?: 0 | 1
		/** 完成状态，0 未完成 1 完成 */
		completed?: 0 | 1
		/**	任务名称，支持模糊查询 */
		task_name_like?: string
		/** 话题id */
		topic_id?: string
		/** 工作区id */
		workspace_id?: string
		[property: string]: any
	}

	export interface MessageContent {
		content: JSONContent | string
		instructs?: Array<{ value: string; instruction: string | null }>
		extra?: {
			super_agent: {
				mentions?: MentionListItem[]
				input_mode?: string
				chat_mode?: string
				topic_pattern?: string
				model?: ModelItem | null
			}
		}
	}

	export const enum ScheduleType {
		Once = "no_repeat", // 不重复
		Daily = "daily_repeat", // 每日
		Weekly = "weekly_repeat", // 每周
		Monthly = "monthly_repeat", // 每月
	}

	export interface TimeConfig {
		day?: string
		time: string
		type: ScheduleType
	}

	// 完整task任务信息
	export interface Task {
		id: string
		message_content: MessageContent
		message_type: string
		organization_code: string
		project_id: string
		/* 0 未启用 1 启用 */
		enabled: number
		/* 0 未完成 1 完成 */
		completed: number
		task_name: string
		task_scheduler_crontab_id: string
		time_config: TimeConfig
		topic_id: string
		updated_at: string
		user_id: string
		workspace_id: string
		workspace_name: string
		project_name: string
		topic_name: string
		deadline: string
		plugins?: { servers: IMCPItem[] }
	}

	// 更新task任务信息
	export type UpdateTask = {
		id?: string
		message_content: MessageContent
		message_type: string
		enabled: number
		task_name: string
		time_config: TimeConfig
		topic_id: string
		workspace_id: string
		project_id: string
		deadline?: string
		plugins?: { servers: { id: string }[] }
	}

	/** 定时任务运行记录状态 */
	export enum RunningRecordStatus {
		Success = 1,
		Failed = 2,
		Running = 3,
	}

	/** 定时任务运行记录 */
	export interface RunningRecord {
		executed_at: string
		task_name: string
		workspace_id: string
		workspace_name: string
		project_id: string
		project_name: string
		topic_id: string
		topic_name: string
		status: RunningRecordStatus
		error_message: string
	}
}
