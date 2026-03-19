import type { CreateTaskParams, UserTask } from "@/types/chat/task"
import conversationStore from "@/stores/chatNew/conversation"
import { ChatApi } from "@/apis"

class ConversationTaskService {
	private agentId: string | undefined

	switchAgent(agentId: string) {
		this.agentId = agentId
		this.getTaskList()
	}

	/**
	 * 获取任务列表
	 * @param callback 回调函数
	 * @returns 任务列表
	 */
	getTaskList() {
		if (!this.agentId) return Promise.resolve()

		return ChatApi.getTaskList({ agent_id: this.agentId, page: 1, page_size: 100 }).then(
			(res) => {
				conversationStore.setConversationTaskList(res.list)
			},
		)
	}

	/**
	 * 创建任务
	 * @param data 任务数据
	 * @param callback 回调函数
	 * @returns 创建后的任务数据
	 */
	createTask(data: CreateTaskParams, callback?: () => void) {
		return ChatApi.createTask(data).then(() => {
			this.getTaskList()
			callback?.()
		})
	}

	/**
	 * 更新任务
	 * @param data 任务数据
	 * @param callback 回调函数
	 * @returns 更新后的任务数据
	 */
	updateTask(data: UserTask, callback?: () => void) {
		return ChatApi.updateTask(data).then(() => {
			this.getTaskList()
			callback?.()
		})
	}

	/**
	 * 删除任务
	 * @param taskId 任务ID
	 * @param callback 回调函数
	 * @returns 删除后的任务数据
	 */
	deleteTask(taskId: string, callback?: () => void) {
		return ChatApi.deleteTask(taskId).then(() => {
			this.getTaskList()
			callback?.()
		})
	}

	/**
	 * 清除代理信息
	 */
	clearAgentInfo() {
		conversationStore.setConversationTaskList([])
		this.agentId = undefined
	}
}

export default new ConversationTaskService()
