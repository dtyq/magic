import { genRequestUrl } from "@/opensource/utils/http"

import type { HttpClient } from "../core/HttpClient"
import { ScheduledTask } from "@/opensource/types/scheduledTask"
import { ListData } from "@/opensource/types/chat/task"
import { PageParams } from "@/opensource/types/other"

export const generateScheduledTaskApi = (fetch: HttpClient) => ({
	/** 获取定时任务列表 */
	getScheduledTaskList(data: ScheduledTask.GetListParams) {
		return fetch.post<ListData<ScheduledTask.Task>>(
			"/api/v1/super-agent/message-schedule/queries",
			data,
		)
	},

	/** 创建定时任务 */
	createScheduledTask(data: ScheduledTask.UpdateTask) {
		return fetch.post(genRequestUrl("/api/v1/super-agent/message-schedule"), data)
	},

	/** 更新定时任务 */
	updateScheduledTask(id: string, data: ScheduledTask.UpdateTask) {
		return fetch.put(genRequestUrl("/api/v1/super-agent/message-schedule/${id}", { id }), data)
	},

	/** 删除定时任务 */
	deleteScheduledTask(id: string) {
		return fetch.delete(genRequestUrl("/api/v1/super-agent/message-schedule/${id}", { id }))
	},

	/* 获取定时任务详情 */
	getScheduledTaskDetails(id: string) {
		return fetch.get<ScheduledTask.Task>(
			genRequestUrl("/api/v1/super-agent/message-schedule/${id}", { id }),
		)
	},

	/** 获取定时任务运行记录 */
	getScheduledTaskRunningRecord(id: string, data: PageParams) {
		return fetch.post<ListData<ScheduledTask.RunningRecord>>(
			genRequestUrl("/api/v1/super-agent/message-schedule/${id}/logs", { id }),
			data,
		)
	},
})
