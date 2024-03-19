import type { TaskQueueItem } from "./types"

export class TaskQueue {
	private queue: TaskQueueItem[] = []

	/**
	 * 添加任务到队列
	 */
	enqueue(item: TaskQueueItem): void {
		this.queue.push(item)
		// 按优先级排序，优先级高的在前
		this.queue.sort((a, b) => b.priority - a.priority)
	}

	/**
	 * 从队列取出任务
	 */
	dequeue(): TaskQueueItem | null {
		return this.queue.shift() || null
	}

	/**
	 * 查看队列头部任务但不移除
	 */
	peek(): TaskQueueItem | null {
		return this.queue[0] || null
	}

	/**
	 * 检查队列是否有任务
	 */
	hasNext(): boolean {
		return this.queue.length > 0
	}

	/**
	 * 获取队列长度
	 */
	get length(): number {
		return this.queue.length
	}

	/**
	 * 清空队列
	 */
	clear(): void {
		this.queue = []
	}

	/**
	 * 移除指定任务
	 */
	remove(taskId: string): boolean {
		const index = this.queue.findIndex((item) => item.task.id === taskId)
		if (index !== -1) {
			this.queue.splice(index, 1)
			return true
		}
		return false
	}

	/**
	 * 获取指定项目的任务数量
	 */
	getProjectTaskCount(projectId: string): number {
		return this.queue.filter((item) => item.task.projectId === projectId).length
	}

	/**
	 * 获取队列中的所有任务ID
	 */
	getAllTaskIds(): string[] {
		return this.queue.map((item) => item.task.id)
	}

	/**
	 * 获取队列中的所有任务项
	 */
	getAllTasks(): TaskQueueItem[] {
		return [...this.queue] // 返回副本，避免外部修改
	}
}
