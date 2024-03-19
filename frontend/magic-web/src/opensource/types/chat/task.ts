import type {
	RepeatTypeMap,
	Units,
} from "@/opensource/pages/chatNew/components/MessageEditor/components/TimedTaskButton/components/CreateTask/constant"

export interface ListData<T> {
	total: number
	list: T[]
}

/**
 * 用户任务列表参数
 */
export interface TaskListParams {
	agent_id: string
	page?: number
	page_size?: number
}

/**
 * 用户任务
 */
export interface UserTask {
	id: string
	// 助理id
	agent_id: string
	// 会话id
	conversation_id: string
	// 话题id
	topic_id: string
	// 任务名称
	name: string
	// 定时类型
	type: RepeatTypeMap
	// 日期
	day: string
	// 时间
	time: string | null
	// 自定义
	value: {
		// 间隔
		interval: number
		// 单位
		unit: Units
		// 值
		values: string[]
		// 截止日期
		deadline: string
		// 月份
		month?: string
	}
}

export type CreateTaskParams = Omit<UserTask, "id">
