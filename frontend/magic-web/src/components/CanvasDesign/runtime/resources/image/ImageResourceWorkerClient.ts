import ImageResourceWorker from "./imageResource.worker?worker"
import type {
	ImageResourceWorkerRequest,
	ImageResourceWorkerMessage,
	ImageResourceWorkerResponse,
	ImageResourceWorkerReadyMessage,
} from "./imageResource.worker"
import {
	DEFAULT_MEDIA_DECODE_CONCURRENT_PIXEL_BUDGET,
	getMediaDecodePriorityRank,
	type MediaDecodePriority,
} from "../offline-cache/MediaDecodePixelBudget"

interface ImageResourceWorkerOwnerInfo {
	ownerId: string
	canvasId: string
	managerInstanceId: number
}

interface PendingWorkerRequest {
	ownerId: string
	request: ImageResourceWorkerRequest
	resolve: (response: ImageResourceWorkerResponse) => void
	reject: (error: Error) => void
	signal?: AbortSignal
	abortListener?: () => void
	priority: MediaDecodePriority
	pixelCost: number
	sequence: number
}

export interface ImageResourceWorkerClientLease {
	send(
		request: ImageResourceWorkerRequest,
		options?: ImageResourceWorkerSendOptions,
	): Promise<ImageResourceWorkerResponse>
	getSnapshot(): ImageResourceWorkerClientSnapshot
	release(error?: Error): void
	cancelAll(error?: Error): void
}

export interface ImageResourceWorkerClientSnapshot {
	activeRequestCount: number
	activePixelCost: number
	queuedRequestCount: number
}

export interface ImageResourceWorkerSendOptions {
	signal?: AbortSignal
	priority?: MediaDecodePriority
	pixelCost?: number
}

const WORKER_TERMINATE_DELAY_MS = 30 * 1000
const MAX_ACTIVE_WORKER_REQUESTS = 4
const MAX_ACTIVE_DECODE_PIXELS = DEFAULT_MEDIA_DECODE_CONCURRENT_PIXEL_BUDGET

function isWorkerReadyMessage(
	message: ImageResourceWorkerMessage,
): message is ImageResourceWorkerReadyMessage {
	return "type" in message && message.type === "ready"
}

export class ImageResourceWorkerClient {
	private static prewarmRequestIdSeed = 0

	private worker: Worker | null = null
	private terminateTimer: ReturnType<typeof setTimeout> | null = null
	private readonly activeOwners = new Map<string, ImageResourceWorkerOwnerInfo>()
	private readonly pendingRequests = new Map<string, PendingWorkerRequest>()
	private readonly queuedRequestIds: string[] = []
	private readonly activeRequests = new Map<string, { pixelCost: number }>()
	private activePixelCost = 0
	private requestSequence = 0
	private prewarmPromise: Promise<void> | null = null

	constructor(private readonly createWorker: () => Worker = () => new ImageResourceWorker()) {}

	public prewarm(reason: string): Promise<void> {
		if (typeof Worker !== "function") return Promise.resolve()
		if (this.prewarmPromise) return this.prewarmPromise

		const owner: ImageResourceWorkerOwnerInfo = {
			ownerId: "canvas-design-image-worker-prewarm",
			canvasId: "prewarm",
			managerInstanceId: 0,
		}
		const lease = this.acquire(owner)
		const requestId = `prewarm-${++ImageResourceWorkerClient.prewarmRequestIdSeed}`
		const startedAt = Date.now()

		const promise = lease
			.send(
				{
					type: "warmup",
					requestId: `${requestId}:${reason}`,
					mainThreadSentAt: startedAt,
					variant: "preview",
				},
				{ priority: "background" },
			)
			.then(() => undefined)
			.catch(() => undefined)
			.finally(() => {
				if (this.prewarmPromise === promise) {
					this.prewarmPromise = null
				}
				lease.release(new Error("ImageResourceWorkerClient prewarm complete"))
			})

		this.prewarmPromise = promise
		return promise
	}

	public acquire(owner: ImageResourceWorkerOwnerInfo): ImageResourceWorkerClientLease {
		this.activeOwners.set(owner.ownerId, owner)
		this.cancelScheduledTerminate()

		let released = false
		return {
			send: (request, options) => this.send(owner, request, options),
			getSnapshot: () => this.getSnapshot(),
			cancelAll: (error) => {
				this.cancelOwnerRequests(
					owner.ownerId,
					error ?? new Error("Worker owner cancelled"),
				)
			},
			release: (error) => {
				if (released) return
				released = true
				this.release(owner, error)
			},
		}
	}

	public getSnapshot(): ImageResourceWorkerClientSnapshot {
		return {
			activeRequestCount: this.activeRequests.size,
			activePixelCost: this.activePixelCost,
			queuedRequestCount: this.queuedRequestIds.length,
		}
	}

	private send(
		owner: ImageResourceWorkerOwnerInfo,
		request: ImageResourceWorkerRequest,
		options?: ImageResourceWorkerSendOptions,
	): Promise<ImageResourceWorkerResponse> {
		if (!this.activeOwners.has(owner.ownerId)) {
			return Promise.reject(new Error("ImageResourceWorkerClient owner released"))
		}
		if (this.pendingRequests.has(request.requestId)) {
			return Promise.reject(
				new Error(`Duplicate image resource worker requestId: ${request.requestId}`),
			)
		}

		if (options?.signal?.aborted) {
			return Promise.reject(createAbortError())
		}

		return new Promise((resolve, reject) => {
			const abortListener = () => {
				this.cancelRequest(request.requestId, createAbortError())
			}
			const pending: PendingWorkerRequest = {
				ownerId: owner.ownerId,
				request,
				resolve,
				reject,
				signal: options?.signal,
				abortListener,
				priority: options?.priority ?? "background",
				pixelCost: Math.max(0, Math.ceil(options?.pixelCost ?? 0)),
				sequence: ++this.requestSequence,
			}
			this.pendingRequests.set(request.requestId, pending)
			options?.signal?.addEventListener("abort", abortListener, { once: true })
			this.queuedRequestIds.push(request.requestId)
			this.pump()
		})
	}

	private pump(): void {
		if (this.pendingRequests.size === 0) return
		while (this.activeRequests.size < MAX_ACTIVE_WORKER_REQUESTS) {
			this.sortQueuedRequests()
			const queueIndex = this.findRunnableRequestIndex()
			if (queueIndex < 0) return
			const requestId = this.queuedRequestIds.splice(queueIndex, 1)[0]
			const pending = this.pendingRequests.get(requestId)
			if (!pending) continue
			this.postRequest(requestId, pending)
		}
	}

	private sortQueuedRequests(): void {
		this.queuedRequestIds.sort((leftId, rightId) => {
			const left = this.pendingRequests.get(leftId)
			const right = this.pendingRequests.get(rightId)
			if (!left || !right) return 0
			const priorityDiff =
				getMediaDecodePriorityRank(left.priority) -
				getMediaDecodePriorityRank(right.priority)
			return priorityDiff !== 0 ? priorityDiff : left.sequence - right.sequence
		})
	}

	private findRunnableRequestIndex(): number {
		while (this.queuedRequestIds.length > 0) {
			const requestId = this.queuedRequestIds[0]
			if (this.pendingRequests.has(requestId)) break
			this.queuedRequestIds.shift()
		}
		const firstRequestId = this.queuedRequestIds[0]
		if (!firstRequestId) return -1
		const firstPending = this.pendingRequests.get(firstRequestId)
		if (!firstPending) return -1
		const firstPriorityRank = getMediaDecodePriorityRank(firstPending.priority)

		for (let index = 0; index < this.queuedRequestIds.length; index += 1) {
			const requestId = this.queuedRequestIds[index]
			const pending = this.pendingRequests.get(requestId)
			if (!pending) continue
			// Never let a lower-priority request overtake the highest-priority queue band.
			if (getMediaDecodePriorityRank(pending.priority) !== firstPriorityRank) break
			if (
				this.activeRequests.size === 0 ||
				this.activePixelCost + pending.pixelCost <= MAX_ACTIVE_DECODE_PIXELS
			) {
				return index
			}
		}

		return -1
	}

	private postRequest(requestId: string, pending: PendingWorkerRequest): void {
		try {
			const worker = this.getWorker()
			this.activeRequests.set(requestId, { pixelCost: pending.pixelCost })
			this.activePixelCost += pending.pixelCost
			const transferables: Transferable[] = []
			if (pending.request.type === "encode-persistent-low" && pending.request.imageSource) {
				transferables.push(pending.request.imageSource)
			}
			if (transferables.length > 0) {
				worker.postMessage(pending.request, { transfer: transferables })
			} else {
				worker.postMessage(pending.request)
			}
		} catch (error) {
			this.releaseActiveRequest(requestId)
			pending.request.imageSource?.close()
			this.removePendingRequest(requestId)
			pending.reject(error instanceof Error ? error : new Error(String(error)))
		}
	}

	private releaseActiveRequest(requestId: string): void {
		const active = this.activeRequests.get(requestId)
		if (!active) return
		this.activeRequests.delete(requestId)
		this.activePixelCost = Math.max(0, this.activePixelCost - active.pixelCost)
	}

	private getWorker(): Worker {
		if (this.worker) return this.worker

		const worker = this.createWorker()
		this.worker = worker

		worker.onmessage = (event: MessageEvent<ImageResourceWorkerMessage>) => {
			const message = event.data
			if (isWorkerReadyMessage(message)) {
				// 根因备忘：刷新后首屏图片慢时，日志确认慢点可能发生在浏览器启动/加载 worker
				// 脚本到 ready 消息之间，而不是 getFileInfo、service worker 或实际解码阶段。
				// 这里不阻塞请求；后续若治理 cold start，应在首屏图片侧做超时降级或更早预热。
				return
			}

			const { requestId } = message
			this.releaseActiveRequest(requestId)
			const pending = this.pendingRequests.get(requestId)
			if (!pending) {
				message.imageSource?.close()
				this.pump()
				return
			}
			this.removePendingRequest(requestId)
			pending.resolve(message)
			this.pump()
		}

		worker.onerror = (event) => {
			const reason =
				event instanceof ErrorEvent && event.message
					? event.message
					: "ImageResourceWorker error"
			this.rejectAll(new Error(reason))
			this.terminateWorker()
		}

		return worker
	}

	private release(owner: ImageResourceWorkerOwnerInfo, error?: Error): void {
		this.activeOwners.delete(owner.ownerId)
		this.cancelOwnerRequests(
			owner.ownerId,
			error ?? new Error("ImageResourceWorkerClient owner released"),
		)
		if (this.activeOwners.size === 0) {
			this.scheduleTerminate()
		}
	}

	private cancelOwnerRequests(ownerId: string, error: Error): void {
		this.pendingRequests.forEach((pending, requestId) => {
			if (pending.ownerId !== ownerId) return
			this.cancelRequest(requestId, error)
		})
	}

	private rejectAll(error: Error): void {
		const activeRequestIds = new Set(this.activeRequests.keys())
		const requests = [...this.pendingRequests.entries()]
		this.pendingRequests.clear()
		this.queuedRequestIds.length = 0
		this.activeRequests.clear()
		this.activePixelCost = 0
		requests.forEach(([requestId, pending]) => {
			if (pending.abortListener) {
				pending.signal?.removeEventListener("abort", pending.abortListener)
			}
			if (!activeRequestIds.has(requestId)) pending.request.imageSource?.close()
			pending.reject(error)
		})
	}

	private cancelRequest(requestId: string, error: Error): void {
		const queueIndex = this.queuedRequestIds.indexOf(requestId)
		if (queueIndex >= 0) this.queuedRequestIds.splice(queueIndex, 1)
		const pending = this.removePendingRequest(requestId)
		if (!pending) return
		pending.reject(error)
		if (queueIndex >= 0) {
			pending.request.imageSource?.close()
			this.pump()
			return
		}
		try {
			this.worker?.postMessage({
				type: "cancel",
				requestId: `cancel:${requestId}`,
				targetRequestId: requestId,
			})
		} catch {
			// A terminating worker cannot receive a cancellation message; rejecting the caller is enough.
		}
	}

	private removePendingRequest(requestId: string): PendingWorkerRequest | undefined {
		const pending = this.pendingRequests.get(requestId)
		if (!pending) return undefined
		this.pendingRequests.delete(requestId)
		if (pending.abortListener) {
			pending.signal?.removeEventListener("abort", pending.abortListener)
		}
		return pending
	}

	private scheduleTerminate(): void {
		this.cancelScheduledTerminate()
		this.terminateTimer = setTimeout(() => {
			this.terminateTimer = null
			if (this.activeOwners.size > 0) return
			this.terminateWorker()
		}, WORKER_TERMINATE_DELAY_MS)
	}

	private cancelScheduledTerminate(): void {
		if (!this.terminateTimer) return
		clearTimeout(this.terminateTimer)
		this.terminateTimer = null
	}

	private terminateWorker(): void {
		if (!this.worker) return
		this.cancelScheduledTerminate()
		this.worker.terminate()
		this.worker = null
		this.queuedRequestIds.length = 0
		this.activeRequests.clear()
		this.activePixelCost = 0
	}
}

function createAbortError(): Error {
	const error = new Error("Image resource worker request aborted")
	error.name = "AbortError"
	return error
}

const sharedImageResourceWorkerClient = new ImageResourceWorkerClient()

export function acquireImageResourceWorkerClient(
	owner: ImageResourceWorkerOwnerInfo,
): ImageResourceWorkerClientLease {
	return sharedImageResourceWorkerClient.acquire(owner)
}

export function prewarmImageResourceWorkerClient(reason: string): Promise<void> {
	return sharedImageResourceWorkerClient.prewarm(reason)
}
