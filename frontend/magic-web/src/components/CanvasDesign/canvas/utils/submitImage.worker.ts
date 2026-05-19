import { getNormalizedImageProcessCrop } from "./imageCropUtils"
import type {
	SubmitImageSourceDimensions,
	SubmitImageWorkerEraseRequest,
	SubmitImageWorkerExtendRequest,
	SubmitImageWorkerRequest,
	SubmitImageWorkerResponse,
	SubmitImageWorkerSuccessResponse,
} from "./submitImageWorkerProtocol"

function isOffscreenCanvasSupported(): boolean {
	return typeof OffscreenCanvas !== "undefined"
}

function canDecodeImageBitmap(): boolean {
	return typeof createImageBitmap === "function"
}

function createCanvas(width: number, height: number): OffscreenCanvas {
	if (!isOffscreenCanvasSupported()) {
		throw new Error("OffscreenCanvas is not supported")
	}
	return new OffscreenCanvas(width, height)
}

async function canvasToBlob(canvas: OffscreenCanvas): Promise<Blob> {
	if (typeof canvas.convertToBlob !== "function") {
		throw new Error("convertToBlob is not supported")
	}
	return canvas.convertToBlob({ type: "image/png" })
}

async function decodeImageBitmap(ossSrc: string): Promise<ImageBitmap> {
	if (!canDecodeImageBitmap()) {
		throw new Error("createImageBitmap is not supported")
	}
	const response = await fetch(ossSrc, { cache: "default" })
	if (!response.ok) {
		throw new Error(`Fetch failed: ${response.status}`)
	}
	const blob = await response.blob()
	return createImageBitmap(blob)
}

function getSourceDimensionsFromRequest(
	request: SubmitImageWorkerEraseRequest,
): SubmitImageSourceDimensions | null {
	const width = request.sourceDimensions?.width ?? 0
	const height = request.sourceDimensions?.height ?? 0
	if (width > 0 && height > 0) {
		return { width, height }
	}
	return null
}

async function resolveEraseSourceDimensions(
	request: SubmitImageWorkerEraseRequest,
): Promise<SubmitImageSourceDimensions> {
	const sourceDimensions = getSourceDimensionsFromRequest(request)
	if (sourceDimensions) {
		return sourceDimensions
	}
	if (!request.ossSrc) {
		throw new Error("缺少原图地址")
	}
	const bitmap = await decodeImageBitmap(request.ossSrc)
	try {
		return {
			width: bitmap.width,
			height: bitmap.height,
		}
	} finally {
		bitmap.close()
	}
}

async function handleErase(
	request: SubmitImageWorkerEraseRequest,
): Promise<SubmitImageWorkerSuccessResponse> {
	const sourceDimensions = await resolveEraseSourceDimensions(request)
	const sourceCrop = getNormalizedImageProcessCrop({
		crop: request.crop,
		sourceDimensions,
	})
	if (!sourceCrop || sourceCrop.width <= 0 || sourceCrop.height <= 0) {
		throw new Error("无效的图片裁剪区域")
	}

	const elementWidth = Math.max(1, request.elementSize.width ?? sourceCrop.width)
	const elementHeight = Math.max(1, request.elementSize.height ?? sourceCrop.height)
	const outputCanvas = createCanvas(
		Math.max(1, Math.round(sourceCrop.width)),
		Math.max(1, Math.round(sourceCrop.height)),
	)
	const outputContext = outputCanvas.getContext("2d")
	if (!outputContext) {
		throw new Error("获取橡皮结果画布失败")
	}

	outputContext.fillStyle = "#000"
	outputContext.fillRect(0, 0, outputCanvas.width, outputCanvas.height)
	outputContext.save()
	outputContext.scale(sourceCrop.width / elementWidth, sourceCrop.height / elementHeight)
	outputContext.strokeStyle = "#fff"
	outputContext.lineCap = "round"
	outputContext.lineJoin = "round"

	const { meta, points } = request.strokes
	for (let i = 0; i < meta.length; i += 3) {
		const pointOffset = meta[i]
		const pointCount = meta[i + 1]
		const radius = meta[i + 2]
		if (pointCount <= 0) continue

		outputContext.beginPath()
		outputContext.lineWidth = radius * 2

		const firstPointIndex = pointOffset * 2
		outputContext.moveTo(points[firstPointIndex], points[firstPointIndex + 1])

		for (let pointIndex = 1; pointIndex < pointCount; pointIndex += 1) {
			const currentIndex = (pointOffset + pointIndex) * 2
			outputContext.lineTo(points[currentIndex], points[currentIndex + 1])
		}
		if (pointCount === 1) {
			outputContext.lineTo(points[firstPointIndex] + 0.01, points[firstPointIndex + 1] + 0.01)
		}
		outputContext.stroke()
	}
	outputContext.restore()

	return {
		type: request.type,
		requestId: request.requestId,
		status: "success",
		sourceDimensions,
		blob: await canvasToBlob(outputCanvas),
	}
}

async function handleExtend(
	request: SubmitImageWorkerExtendRequest,
): Promise<SubmitImageWorkerSuccessResponse> {
	const bitmap = await decodeImageBitmap(request.ossSrc)
	try {
		const sourceDimensions = {
			width: bitmap.width,
			height: bitmap.height,
		}
		const sourceCrop = getNormalizedImageProcessCrop({
			crop: request.crop,
			sourceDimensions,
		})
		if (!sourceCrop || sourceCrop.width <= 0 || sourceCrop.height <= 0) {
			throw new Error("无效的图片裁剪区域")
		}

		const elementWidth = Math.max(1, request.elementSize.width ?? sourceCrop.width)
		const elementHeight = Math.max(1, request.elementSize.height ?? sourceCrop.height)
		const widthScale = sourceCrop.width / elementWidth
		const heightScale = sourceCrop.height / elementHeight
		const outputWidth = Math.max(1, Math.round(request.frame.width * widthScale))
		const outputHeight = Math.max(1, Math.round(request.frame.height * heightScale))
		const drawRect = {
			x: Math.round((request.imageRect.x - request.frame.x) * widthScale),
			y: Math.round((request.imageRect.y - request.frame.y) * heightScale),
			width: Math.max(1, Math.round(request.imageRect.width * widthScale)),
			height: Math.max(1, Math.round(request.imageRect.height * heightScale)),
		}

		const canvasCanvas = createCanvas(outputWidth, outputHeight)
		const canvasContext = canvasCanvas.getContext("2d")
		if (!canvasContext) {
			throw new Error("获取扩图合成画布失败")
		}

		canvasContext.fillStyle = "#fff"
		canvasContext.fillRect(0, 0, outputWidth, outputHeight)
		canvasContext.drawImage(
			bitmap,
			sourceCrop.x,
			sourceCrop.y,
			sourceCrop.width,
			sourceCrop.height,
			drawRect.x,
			drawRect.y,
			drawRect.width,
			drawRect.height,
		)

		const markCanvas = createCanvas(outputWidth, outputHeight)
		const markContext = markCanvas.getContext("2d")
		if (!markContext) {
			throw new Error("获取扩图标记画布失败")
		}

		markContext.fillStyle = "#fff"
		markContext.fillRect(0, 0, outputWidth, outputHeight)
		markContext.fillStyle = "#000"
		markContext.fillRect(drawRect.x, drawRect.y, drawRect.width, drawRect.height)

		const [canvasBlob, markBlob] = await Promise.all([
			canvasToBlob(canvasCanvas),
			canvasToBlob(markCanvas),
		])

		return {
			type: request.type,
			requestId: request.requestId,
			status: "success",
			sourceDimensions,
			canvasBlob,
			markBlob,
			size: `${outputWidth}x${outputHeight}`,
		}
	} finally {
		bitmap.close()
	}
}

async function processRequest(
	request: SubmitImageWorkerRequest,
): Promise<SubmitImageWorkerResponse> {
	if (!isOffscreenCanvasSupported()) {
		return {
			type: request.type,
			requestId: request.requestId,
			status: "unsupported",
			error: "OffscreenCanvas is not supported",
		}
	}
	if (!canDecodeImageBitmap() && (request.type === "extend" || request.ossSrc)) {
		return {
			type: request.type,
			requestId: request.requestId,
			status: "unsupported",
			error: "createImageBitmap is not supported",
		}
	}

	try {
		if (request.type === "erase") {
			return await handleErase(request)
		}
		return await handleExtend(request)
	} catch (error) {
		return {
			type: request.type,
			requestId: request.requestId,
			status: "error",
			error: error instanceof Error ? error.message : String(error),
		}
	}
}

self.onmessage = (event: MessageEvent<SubmitImageWorkerRequest>) => {
	void processRequest(event.data).then((response) => {
		self.postMessage(response)
	})
}
