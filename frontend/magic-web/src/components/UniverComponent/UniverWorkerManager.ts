import { nanoid } from "nanoid"
import type { IWorkbookData } from "@univerjs/core"
import UniverWorker from "./worker?worker"
import {
	TransformWorkerMessageType,
	type WorkerMessage,
	type WorkerResponse,
	type TransformTask,
} from "./types"

/** Univer Worker 管理器 */
export class UniverWorkerManager {
	private worker: Worker | null = null
	private pendingTasks = new Map<string, TransformTask>()
	private isDisposed = false

	constructor() {
		this.initializeWorker()
	}

	/** 初始化 Worker */
	private initializeWorker(): void {
		if (this.isDisposed) {
			throw new Error("WorkerManager has been disposed")
		}
		try {
			this.worker = new UniverWorker()
			this.setupWorkerHandlers()
		} catch (error) {
			throw new Error("Failed to initialize worker")
		}
	}

	/** 设置 Worker 事件处理器 */
	private setupWorkerHandlers(): void {
		if (!this.worker) return
		this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
			if (this.isDisposed) return
			const message = event.data
			const taskId = message.payload.id
			const task = this.pendingTasks.get(taskId)
			if (!task) return
			this.pendingTasks.delete(taskId)
			switch (message.type) {
				case TransformWorkerMessageType.TRANSFORM_RESPONSE:
					task.resolve(message.payload.result as Partial<IWorkbookData>)
					break
				case TransformWorkerMessageType.TRANSFORM_ERROR:
					const error = new Error(
						message.payload.error?.message || "Worker processing failed",
					)
					if (message.payload.error?.stack) {
						error.stack = message.payload.error.stack
					}
					task.reject(error)
					break
				default:
					task.reject(new Error("Unknown worker response type"))
					break
			}
		}
		this.worker.onerror = () => {
			if (this.isDisposed) return
			// 拒绝所有待处理的任务
			this.pendingTasks.forEach((task) => {
				task.reject(new Error("Worker encountered an error"))
			})
			this.pendingTasks.clear()
		}
	}

	/** 转换数据 */
	async transformData(
		data: File | Partial<IWorkbookData>,
		fileName?: string,
		isReadonly?: boolean,
	): Promise<Partial<IWorkbookData>> {
		if (this.isDisposed) {
			throw new Error("WorkerManager has been disposed")
		}

		// 如果已经是 JSON 数据，直接返回
		if (!(data instanceof File)) {
			return data
		}
		if (!this.worker) {
			throw new Error("Worker not initialized")
		}
		const taskId = nanoid()
		return new Promise<Partial<IWorkbookData>>((resolve, reject) => {
			const task: TransformTask = {
				id: taskId,
				resolve,
				reject,
			}
			this.pendingTasks.set(taskId, task)
			const message: WorkerMessage = {
				type: TransformWorkerMessageType.TRANSFORM_REQUEST,
				payload: {
					id: taskId,
					data,
					fileName,
					isReadonly,
				},
			}
			if (this.worker) {
				this.worker.postMessage(message)
			} else {
				reject(new Error("Worker not available"))
			}
		})
	}

	/** 获取待处理任务数量 */
	getPendingTasksCount(): number {
		return this.pendingTasks.size
	}

	/** 检查是否已销毁 */
	isWorkerDisposed(): boolean {
		return this.isDisposed
	}

	/** 销毁 Worker 并清理资源 */
	dispose(): void {
		if (this.isDisposed) return
		this.isDisposed = true
		// 拒绝所有待处理的任务
		this.pendingTasks.forEach((task) => {
			task.reject(new Error("Worker was disposed"))
		})
		this.pendingTasks.clear()
		// 终止 Worker
		if (this.worker) {
			try {
				this.worker.terminate()
			} catch (error) {
				// ignore termination errors
			}
			this.worker = null
		}
	}
}
