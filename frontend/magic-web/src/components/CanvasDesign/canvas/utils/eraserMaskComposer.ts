import type { ImageElement } from "../types"
import type { EraserStroke } from "../interaction/EraserRenderer"
import { generateUUID } from "./utils"
import { getNormalizedImageProcessCrop } from "./imageCropUtils"

interface CreateEraserMaskFileParams {
	element: Pick<ImageElement, "width" | "height" | "crop">
	strokes: EraserStroke[]
	naturalWidth: number
	naturalHeight: number
}

export async function createEraserMaskFile(params: CreateEraserMaskFileParams): Promise<File> {
	const { element, strokes, naturalWidth, naturalHeight } = params
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

	const outputCanvas = document.createElement("canvas")
	outputCanvas.width = Math.max(1, Math.round(sourceCrop.width))
	outputCanvas.height = Math.max(1, Math.round(sourceCrop.height))

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

	strokes.forEach((stroke) => {
		if (stroke.points.length === 0) return

		outputContext.beginPath()
		outputContext.lineWidth = stroke.radius * 2
		const [firstPoint, ...restPoints] = stroke.points
		outputContext.moveTo(firstPoint.x, firstPoint.y)
		restPoints.forEach((point) => {
			outputContext.lineTo(point.x, point.y)
		})
		if (restPoints.length === 0) {
			outputContext.lineTo(firstPoint.x + 0.01, firstPoint.y + 0.01)
		}
		outputContext.stroke()
	})
	outputContext.restore()

	const blob = await new Promise<Blob | null>((resolve) => {
		outputCanvas.toBlob(resolve, "image/png")
	})
	if (!blob) {
		throw new Error("导出橡皮结果失败")
	}

	return new File([blob], `${generateUUID()}.png`, {
		type: "image/png",
	})
}
