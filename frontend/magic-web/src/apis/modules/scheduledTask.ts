import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"
import { ScheduledTask } from "@/types/scheduledTask"
import { ListData } from "@/types/chat/task"
import { PageParams } from "@/types/other"

export const generateScheduledTaskApi = (fetch: ServiceHttpClient) => ({
	/** 获取定时任务列表 */
	getScheduledTaskList(data: ScheduledTask.GetListParams) {
		return fetch.post<ListData<ScheduledTask.Task>>(
			"/api/v1/super-agent/message-schedule/queries",
			data,
		)
	},

	/** 创建定时任务 */
	createScheduledTask(data: ScheduledTask.UpdateTask) {
		return fetch.post("/api/v1/super-agent/message-schedule", data)
	},

	/** 更新定时任务 */
	updateScheduledTask(id: string, data: ScheduledTask.UpdateTask) {
		return fetch.put(`/api/v1/super-agent/message-schedule/${id}`, data)
	},

	/** 删除定时任务 */
	deleteScheduledTask(id: string) {
		return fetch.delete(`/api/v1/super-agent/message-schedule/${id}`)
	},

	/* 获取定时任务详情 */
	getScheduledTaskDetails(id: string) {
		return fetch.get<ScheduledTask.Task>(`/api/v1/super-agent/message-schedule/${id}`)
	},

	/** 获取定时任务运行记录 */
	getScheduledTaskRunningRecord(id: string, data: PageParams) {
		return fetch.post<ListData<ScheduledTask.RunningRecord>>(
			`/api/v1/super-agent/message-schedule/${id}/logs`,
			data,
		)
	},

	/** 立即执行定时任务 */
	executeScheduledTask(id: string) {
		return fetch.post<ScheduledTask.ExecuteResult>(
			`/api/v1/super-agent/message-schedule/${id}/execute`,
		)
	},
})
