import { useCallback, useRef, useMemo } from "react"
import { nanoid } from "nanoid"
import {
	TransformWorkerMessageType,
	type TransformWorkerOptions,
	type TransformResult,
	type WorkerResponse,
	type FileType,
} from "./types"

// Import worker as URL
import TransformWorkerUrl from "./worker?worker&url"

/**
 * Transform Data Worker Hook
 * 使用 Web Worker 处理数据转换，避免阻塞主线程
 */
export function useTransformWorker(options?: TransformWorkerOptions) {
	const workerRef = useRef<Worker | null>(null)
	const pendingTasksRef = useRef<Map<string, TransformResult>>(new Map())

	// Default options
	const workerOptions = useMemo(
		() => ({
			timeout: 30000, // 30 seconds
			maxConcurrentTasks: 3,
			...options,
		}),
		[options],
	)

	// Initialize worker if not already created
	const getWorker = useCallback(() => {
		if (!workerRef.current) {
			try {
				workerRef.current = new Worker(TransformWorkerUrl, { type: "module" })

				// Handle worker messages
				workerRef.current.onmessage = (event: MessageEvent) => {
					const message = event.data as WorkerResponse
					const taskId = message.payload.id
					const task = pendingTasksRef.current.get(taskId)

					if (!task) {
						console.warn(`[useTransformWorker] 收到未知任务ID的消息: ${taskId}`)
						return
					}

					switch (message.type) {
						case TransformWorkerMessageType.TRANSFORM_RESPONSE:
							// Task completed successfully
							task.resolve(message.payload.result)
							pendingTasksRef.current.delete(taskId)
							break

						case TransformWorkerMessageType.TRANSFORM_ERROR:
							// Task failed
							const error = new Error(message.payload.error.message)
							if (message.payload.error.stack) {
								error.stack = message.payload.error.stack
							}
							task.reject(error)
							pendingTasksRef.current.delete(taskId)
							break

						case TransformWorkerMessageType.TRANSFORM_PROGRESS:
							// Progress update - could emit events or call callbacks here
							console.log(
								`[Worker] 任务 ${taskId} 进度: ${message.payload.progress}% - ${message.payload.stage}`,
							)
							break

						default:
							// @ts-ignore
							console.warn(`[useTransformWorker] 未知消息类型:`, message?.type)
					}
				}

				// Handle worker errors
				workerRef.current.onerror = (error) => {
					console.error("[useTransformWorker] Worker error:", error)
					// Reject all pending tasks
					pendingTasksRef.current.forEach((task) => {
						task.reject(new Error("Worker encountered an error"))
					})
					pendingTasksRef.current.clear()
				}

				console.log("[useTransformWorker] Worker initialized")
			} catch (error) {
				console.error("[useTransformWorker] Failed to create worker:", error)
				throw new Error("Failed to initialize transform worker")
			}
		}

		return workerRef.current
	}, [])

	/**
	 * Transform data using worker
	 * @param data 原始数据：字符串内容或File对象
	 * @param fileType 文件类型
	 * @param fileName 文件名
	 * @returns Promise that resolves with transformed data
	 */
	const transformData = useCallback(
		async (data: any, fileType: FileType, fileName: string): Promise<any> => {
			// Check concurrent task limit
			if (pendingTasksRef.current.size >= workerOptions.maxConcurrentTasks) {
				throw new Error(`已达到最大并发任务数限制: ${workerOptions.maxConcurrentTasks}`)
			}

			const worker = getWorker()
			const taskId = nanoid()

			// Create promise for this task
			const taskPromise = new Promise<any>((resolve, reject) => {
				const task: TransformResult = {
					id: taskId,
					promise: taskPromise,
					resolve,
					reject,
				}

				// Add to pending tasks
				pendingTasksRef.current.set(taskId, task)

				// Set timeout
				const timeoutId = setTimeout(() => {
					if (pendingTasksRef.current.has(taskId)) {
						pendingTasksRef.current.delete(taskId)
						reject(new Error(`转换任务超时 (${workerOptions.timeout}ms)`))
					}
				}, workerOptions.timeout)

				// Clear timeout when task completes
				task.promise.finally(() => {
					clearTimeout(timeoutId)
				})

				// Send request to worker
				worker.postMessage({
					type: TransformWorkerMessageType.TRANSFORM_REQUEST,
					payload: {
						id: taskId,
						data,
						fileType,
						fileName,
					},
				})
			})

			return taskPromise
		},
		[getWorker, workerOptions],
	)

	/**
	 * Check if worker is available
	 */
	const isWorkerAvailable = useCallback(() => {
		return !!workerRef.current
	}, [])

	/**
	 * Get number of pending tasks
	 */
	const getPendingTasksCount = useCallback(() => {
		return pendingTasksRef.current.size
	}, [])

	/**
	 * Terminate worker and cleanup
	 */
	const terminateWorker = useCallback(() => {
		if (workerRef.current) {
			// Reject all pending tasks
			pendingTasksRef.current.forEach((task) => {
				task.reject(new Error("Worker was terminated"))
			})
			pendingTasksRef.current.clear()

			// Terminate worker
			workerRef.current.terminate()
			workerRef.current = null
			console.log("[useTransformWorker] Worker terminated")
		}
	}, [])

	return {
		transformData,
		isWorkerAvailable,
		getPendingTasksCount,
		terminateWorker,
		maxConcurrentTasks: workerOptions.maxConcurrentTasks,
		timeout: workerOptions.timeout,
	}
}
