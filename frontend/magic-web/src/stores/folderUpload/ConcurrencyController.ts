export class ConcurrencyController {
	private maxConcurrent: number
	private activeProjects: Set<string> = new Set()
	private waitingQueue: Array<{
		projectId: string
		resolve: () => void
		reject: (error: Error) => void
	}> = []

	constructor(maxConcurrent: number = 3) {
		this.maxConcurrent = maxConcurrent
	}

	/**
	 * 获取并发许可
	 */
	async acquire(projectId: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.activeProjects.size < this.maxConcurrent) {
				this.activeProjects.add(projectId)
				resolve()
			} else {
				// 加入等待队列
				this.waitingQueue.push({ projectId, resolve, reject })
			}
		})
	}

	/**
	 * 释放并发许可
	 */
	release(projectId: string): void {
		this.activeProjects.delete(projectId)

		// 处理等待队列
		if (this.waitingQueue.length > 0 && this.activeProjects.size < this.maxConcurrent) {
			const next = this.waitingQueue.shift()
			if (next) {
				this.activeProjects.add(next.projectId)
				next.resolve()
			}
		}
	}

	/**
	 * 获取当前活跃的项目数量
	 */
	get activeCount(): number {
		return this.activeProjects.size
	}

	/**
	 * 获取等待队列长度
	 */
	get waitingCount(): number {
		return this.waitingQueue.length
	}

	/**
	 * 检查项目是否在活跃状态
	 */
	isActive(projectId: string): boolean {
		return this.activeProjects.has(projectId)
	}

	/**
	 * 取消指定项目的等待
	 */
	cancelWaiting(projectId: string): boolean {
		const index = this.waitingQueue.findIndex((item) => item.projectId === projectId)
		if (index !== -1) {
			const item = this.waitingQueue.splice(index, 1)[0]
			item.reject(new Error("Task cancelled"))
			return true
		}
		return false
	}

	/**
	 * 清空所有等待队列
	 */
	clearWaiting(): void {
		this.waitingQueue.forEach((item) => {
			item.reject(new Error("All tasks cancelled"))
		})
		this.waitingQueue = []
	}

	/**
	 * 更新最大并发数
	 */
	updateMaxConcurrent(maxConcurrent: number): void {
		this.maxConcurrent = maxConcurrent

		// 如果新的并发数更大，处理等待队列
		while (this.waitingQueue.length > 0 && this.activeProjects.size < this.maxConcurrent) {
			const next = this.waitingQueue.shift()
			if (next) {
				this.activeProjects.add(next.projectId)
				next.resolve()
			}
		}
	}
}
