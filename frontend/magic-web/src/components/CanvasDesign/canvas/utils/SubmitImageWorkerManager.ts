import type { Canvas } from "../Canvas"
import type { CropConfig } from "../types"
import type {
	FlattenedEraserStrokes,
	SubmitImageWorkerRequest,
	SubmitImageWorkerResponse,
} from "./submitImageWorkerProtocol"
import { getSubmitImageWorkerTransferables } from "./submitImageWorkerProtocol"

interface CreateEraserMaskInWorkerParams {
	src?: string
	crop?: CropConfig
	elementSize: {
		width?: number
		height?: number
	}
	sourceDimensions?: {
		width: number
		height: number
	}
	strokes: FlattenedEraserStrokes
}

interface CreateExtendImagesInWorkerParams {
	src: string
	crop?: CropConfig
	elementSize: {
		width?: number
		height?: number
	}
	frame: {
		x: number
		y: number
		width: number
		height: number
	}
	imageRect: {
		x: number
		y: number
		width: number
		height: number
	}
}

export class SubmitImageWorkerManager {
	private canvas: Canvas
	private worker: Worker | null = null
	private pendingRequests = new Map<
		string,
		{
			resolve: (response: SubmitImageWorkerResponse) => void
			reject: (error: Error) => void
		}
	>()
	private requestIdCounter = 0

	constructor(options: { canvas: Canvas }) {
		this.canvas = options.canvas
	}

	public async createEraserMaskInWorker(
		params: CreateEraserMaskInWorkerParams,
	): Promise<{ blob: Blob; sourceDimensions: { width: number; height: number } } | null> {
		if (!this.isWorkerAvailable()) {
			return null
		}

		const resolvedOssSrc =
			!params.sourceDimensions && params.src
				? await this.canvas.imageResourceManager.ensureFreshOssSrc(params.src)
				: undefined
		const ossSrc = resolvedOssSrc ?? undefined
		if (!params.sourceDimensions && !ossSrc) {
			return null
		}

		const response = await this.sendToWorker({
			type: "erase",
			requestId: this.createRequestId("erase"),
			crop: params.crop,
			elementSize: params.elementSize,
			sourceDimensions: params.sourceDimensions,
			ossSrc,
			strokes: params.strokes,
		})
		if (response.status === "unsupported") {
			return null
		}
		if (response.status === "error") {
			throw new Error(response.error)
		}
		if (!response.blob) {
			throw new Error("导出橡皮结果失败")
		}
		return {
			blob: response.blob,
			sourceDimensions: response.sourceDimensions,
		}
	}

	public async createExtendImagesInWorker(params: CreateExtendImagesInWorkerParams): Promise<{
		canvasBlob: Blob
		markBlob: Blob
		size: string
		sourceDimensions: { width: number; height: number }
	} | null> {
		if (!this.isWorkerAvailable()) {
			return null
		}

		const ossSrc = await this.canvas.imageResourceManager.ensureFreshOssSrc(params.src)
		if (!ossSrc) {
			return null
		}

		const response = await this.sendToWorker({
			type: "extend",
			requestId: this.createRequestId("extend"),
			crop: params.crop,
			elementSize: params.elementSize,
			frame: params.frame,
			imageRect: params.imageRect,
			ossSrc,
		})
		if (response.status === "unsupported") {
			return null
		}
		if (response.status === "error") {
			throw new Error(response.error)
		}
		if (!response.canvasBlob || !response.markBlob || !response.size) {
			throw new Error("导出扩图结果失败")
		}
		return {
			canvasBlob: response.canvasBlob,
			markBlob: response.markBlob,
			size: response.size,
			sourceDimensions: response.sourceDimensions,
		}
	}

	public destroy(): void {
		const pendingError = new Error("SubmitImageWorkerManager destroyed")
		this.pendingRequests.forEach((pending) => pending.reject(pendingError))
		this.pendingRequests.clear()
		if (this.worker) {
			this.worker.terminate()
			this.worker = null
		}
	}

	private isWorkerAvailable(): boolean {
		return typeof Worker === "function"
	}

	private getWorker(): Worker {
		if (!this.worker) {
			this.worker = new Worker(new URL("./submitImage.worker.ts", import.meta.url), {
				type: "module",
			})
			this.worker.onmessage = (event: MessageEvent<SubmitImageWorkerResponse>) => {
				const pending = this.pendingRequests.get(event.data.requestId)
				if (!pending) {
					return
				}
				this.pendingRequests.delete(event.data.requestId)
				pending.resolve(event.data)
			}
			this.worker.onerror = (event) => {
				const error = new Error(event.message || "SubmitImageWorker error")
				this.pendingRequests.forEach((pending) => pending.reject(error))
				this.pendingRequests.clear()
			}
		}
		return this.worker
	}

	private async sendToWorker(
		request: SubmitImageWorkerRequest,
	): Promise<SubmitImageWorkerResponse> {
		return new Promise((resolve, reject) => {
			this.pendingRequests.set(request.requestId, { resolve, reject })
			this.getWorker().postMessage(request, getSubmitImageWorkerTransferables(request))
		})
	}

	private createRequestId(prefix: string): string {
		this.requestIdCounter += 1
		return `${prefix}-${this.requestIdCounter}-${Date.now()}`
	}
}
