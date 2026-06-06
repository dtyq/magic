import { SuperMagicApi } from "@/apis"
import type { RecordTaskProgress } from "@/apis/modules/superMagic/recordSummary"

const POLL_INTERVAL_MS = 5000

export interface SummaryProgressPollerCallbacks {
	onProgress: (task: RecordTaskProgress) => void
	onTaskDone: (taskKey: string) => void
	onTaskMissing: (taskKey: string) => void
}

/** Polls ASR task progress in batch while the recordings list page is mounted */
export class SummaryProgressPoller {
	private taskKeys = new Set<string>()
	private timer: ReturnType<typeof setInterval> | null = null
	private callbacks: SummaryProgressPollerCallbacks | null = null
	private isPolling = false

	/** Registers store callbacks for progress updates */
	setCallbacks(callbacks: SummaryProgressPollerCallbacks | null) {
		this.callbacks = callbacks
	}

	/** Adds a task to the poll set and triggers an immediate fetch */
	addTask(taskKey: string) {
		if (!taskKey) return
		this.taskKeys.add(taskKey)
		void this.pollOnce()
		this.startInterval()
	}

	/** Removes a task from polling without stopping the interval if others remain */
	removeTask(taskKey: string) {
		this.taskKeys.delete(taskKey)
		if (this.taskKeys.size === 0) this.stopInterval()
	}

	/** Clears all tasks and stops polling — call on page unmount */
	dispose() {
		this.taskKeys.clear()
		this.stopInterval()
		this.callbacks = null
	}

	private startInterval() {
		if (this.timer || this.taskKeys.size === 0) return
		this.timer = setInterval(() => {
			void this.pollOnce()
		}, POLL_INTERVAL_MS)
	}

	private stopInterval() {
		if (!this.timer) return
		clearInterval(this.timer)
		this.timer = null
	}

	/** Fetches progress for all tracked task keys in one batch request */
	private async pollOnce() {
		if (this.isPolling || this.taskKeys.size === 0 || !this.callbacks) return

		const keys = [...this.taskKeys]
		this.isPolling = true

		try {
			const response = await SuperMagicApi.batchTaskProgress({ task_keys: keys })
			const tasks = response.tasks ?? []

			for (const task of tasks) {
				if (!task.task_key) continue

				if (task.exists === false) {
					this.taskKeys.delete(task.task_key)
					this.callbacks.onTaskMissing(task.task_key)
					continue
				}

				this.callbacks.onProgress(task)

				if (task.phase_status === "completed" || task.phase_status === "failed") {
					this.taskKeys.delete(task.task_key)
					this.callbacks.onTaskDone(task.task_key)
				}
			}
		} catch {
			// Keep polling on transient network errors
		} finally {
			this.isPolling = false
			if (this.taskKeys.size === 0) this.stopInterval()
		}
	}
}

/** Module singleton shared by the recordings list store */
export const summaryProgressPoller = new SummaryProgressPoller()
