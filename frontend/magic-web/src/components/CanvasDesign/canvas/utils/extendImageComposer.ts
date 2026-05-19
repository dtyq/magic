import type { ImageElement } from "../types"
import { getNormalizedImageProcessCrop } from "./imageCropUtils"
import { generateUUID } from "./utils"

interface Rect {
	x: number
	y: number
	width: number
	height: number
}

interface CreateExtendImageFilesParams {
	element: Pick<ImageElement, "width" | "height" | "crop">
	image: CanvasImageSource
	naturalWidth: number
	naturalHeight: number
	frame: Rect
	imageRect: Rect
}

export interface ExtendImageFilesResult {
	canvasFile: File
	markFile: File
	size: string
}

export async function createExtendImageFiles(
	params: CreateExtendImageFilesParams,
): Promise<ExtendImageFilesResult> {
	const { element, image, naturalWidth, naturalHeight, frame, imageRect } = params

	const sourceCrop = getNormalizedImageProcessCrop({
		crop: element.crop,
		sourceDimensions: {
			width: naturalWidth,
			height: naturalHeight,
		},
	})
	if (!sourceCrop || sourceCrop.width <= 0 || sourceCrop.height <= 0) {
		throw new Error("无效的图片裁剪区域")
	}

	const elementWidth = Math.max(1, element.width ?? sourceCrop.width)
	const elementHeight = Math.max(1, element.height ?? sourceCrop.height)
	const widthScale = sourceCrop.width / elementWidth
	const heightScale = sourceCrop.height / elementHeight

	const outputWidth = Math.max(1, Math.round(frame.width * widthScale))
	const outputHeight = Math.max(1, Math.round(frame.height * heightScale))
	const drawRect = {
		x: Math.round((imageRect.x - frame.x) * widthScale),
		y: Math.round((imageRect.y - frame.y) * heightScale),
		width: Math.max(1, Math.round(imageRect.width * widthScale)),
		height: Math.max(1, Math.round(imageRect.height * heightScale)),
	}

	const canvasCanvas = document.createElement("canvas")
	canvasCanvas.width = outputWidth
	canvasCanvas.height = outputHeight
	const canvasContext = canvasCanvas.getContext("2d")
	if (!canvasContext) {
		throw new Error("获取扩图合成画布失败")
	}

	canvasContext.fillStyle = "#fff"
	canvasContext.fillRect(0, 0, outputWidth, outputHeight)
	canvasContext.drawImage(
		image,
		sourceCrop.x,
		sourceCrop.y,
		sourceCrop.width,
		sourceCrop.height,
		drawRect.x,
		drawRect.y,
		drawRect.width,
		drawRect.height,
	)

	const markCanvas = document.createElement("canvas")
	markCanvas.width = outputWidth
	markCanvas.height = outputHeight
	const markContext = markCanvas.getContext("2d")
	if (!markContext) {
		throw new Error("获取扩图标记画布失败")
	}

	markContext.fillStyle = "#fff"
	markContext.fillRect(0, 0, outputWidth, outputHeight)
	markContext.fillStyle = "#000"
	markContext.fillRect(drawRect.x, drawRect.y, drawRect.width, drawRect.height)

	const [canvasBlob, markBlob] = await Promise.all([
		canvasToBlob(canvasCanvas, "导出扩图合成图失败"),
		canvasToBlob(markCanvas, "导出扩图标记图失败"),
	])

	return {
		canvasFile: new File([canvasBlob], `${generateUUID()}-expand-canvas.png`, {
			type: "image/png",
		}),
		markFile: new File([markBlob], `${generateUUID()}-expand-mark.png`, {
			type: "image/png",
		}),
		size: `${outputWidth}x${outputHeight}`,
	}
}

async function canvasToBlob(canvas: HTMLCanvasElement, errorMessage: string): Promise<Blob> {
	const blob = await new Promise<Blob | null>((resolve) => {
		canvas.toBlob(resolve, "image/png")
	})
	if (!blob) {
		throw new Error(errorMessage)
	}
	return blob
}
