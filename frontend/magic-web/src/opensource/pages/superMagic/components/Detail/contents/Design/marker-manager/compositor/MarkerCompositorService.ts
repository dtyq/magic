import type {
	Marker,
	MarkerArea,
	ImageElement,
} from "@/opensource/components/CanvasDesign/canvas/types"
import { MarkerTypeEnum } from "@/opensource/components/CanvasDesign/canvas/types"
import type {
	IdentifyImageMarkRequest,
	IdentifyImageMarkResponse,
	UploadPrivateFile,
	UploadPrivateFileResponse,
} from "@/opensource/components/CanvasDesign/types.magic"
import { drawMarkerOnCanvas } from "./markerDrawers"
import { generateUUID } from "@/opensource/components/CanvasDesign/canvas/utils/utils"

/** 用于合成的图片信息 */
interface ImageInfoForComposite {
	naturalWidth: number
	naturalHeight: number
	fileSize: number
	mimeType: string
	filename: string
}

interface ImageCompressionConfig {
	enableCompression: boolean
	minBytesPerPixel: number
	minQuality: number
	maxQuality: number
	pngMinBytesPerPixel: number
	pngToJpegThreshold: number
	pngToJpegQuality: number
	qualityCurveCoefficient: number
}

const DEFAULT_COMPRESSION_CONFIG: ImageCompressionConfig = {
	enableCompression: true,
	minBytesPerPixel: 0.3,
	minQuality: 0.65,
	maxQuality: 0.92,
	pngMinBytesPerPixel: 1.0,
	pngToJpegThreshold: 500 * 1024,
	pngToJpegQuality: 0.9,
	qualityCurveCoefficient: 0.3,
}

export interface MarkerCompositorMethods {
	getFileInfo: (path: string) => Promise<{ src?: string }>
	uploadPrivateFiles: (files: UploadPrivateFile[]) => Promise<UploadPrivateFileResponse[]>
	identifyImageMark: (params: IdentifyImageMarkRequest) => Promise<IdentifyImageMarkResponse>
}

export interface MarkerCompositorInput {
	marker: Marker
	element: ImageElement
	sequence: number
	methods: MarkerCompositorMethods
	projectId?: string
	/** 可选的图片信息（从画布获取，避免重复加载） */
	imageInfo?: Partial<ImageInfoForComposite>
	/** 可选的 OSS URL（从画布获取，避免重复调用 getFileInfo） */
	ossUrl?: string
	/** 可选的图片对象（从画布获取，避免重复加载） */
	image?: HTMLImageElement | ImageBitmap
}

export interface CompositeResult {
	filePath: string
	imageInfo: ImageInfoForComposite
}

export interface IdentifyInput {
	marker: Marker
	filePath: string
	imageInfo: ImageInfoForComposite
	methods: Pick<MarkerCompositorMethods, "identifyImageMark">
	projectId?: string
}

/**
 * 无画布合成服务：加载图片、绘制 marker、压缩、上传、识别
 */
export class MarkerCompositorService {
	/**
	 * 合成 marker 与图片并上传
	 * @returns 返回上传后的文件路径和图片信息
	 */
	static async composite(input: MarkerCompositorInput): Promise<CompositeResult> {
		const {
			marker,
			element,
			sequence,
			methods,
			imageInfo: providedImageInfo,
			ossUrl: providedOssUrl,
			image: providedImage,
		} = input
		const { getFileInfo, uploadPrivateFiles } = methods

		if (!element.src) {
			throw new Error("图片元素 src 为空")
		}

		// 1. 获取 OSS URL（优先使用提供的）
		let ossUrl = providedOssUrl
		if (!ossUrl) {
			const fileInfo = await getFileInfo(element.src)
			ossUrl = fileInfo?.src
			if (!ossUrl) {
				throw new Error(`无法获取图片 OSS 地址: ${element.src}`)
			}
		}

		// 2. 加载图片和获取图片信息（优先使用提供的）
		let image: HTMLImageElement | ImageBitmap
		let imageInfo: ImageInfoForComposite

		if (providedImage && providedImageInfo?.naturalWidth && providedImageInfo?.naturalHeight) {
			// 使用提供的图片对象和信息（从画布获取）
			image = providedImage
			imageInfo = {
				naturalWidth: providedImageInfo.naturalWidth,
				naturalHeight: providedImageInfo.naturalHeight,
				fileSize: providedImageInfo.fileSize ?? 0,
				mimeType: providedImageInfo.mimeType ?? "image/png",
				filename: providedImageInfo.filename ?? "image.png",
			}
		} else {
			// 降级：加载图片
			const loaded = await loadImageFromUrl(ossUrl)
			image = loaded.image
			imageInfo = loaded.imageInfo
		}

		// 3. 创建离屏 canvas 并绘制
		const composedFile = await compositeMarkerWithImage(marker, image, imageInfo, sequence)

		// 4. 上传
		const uploadResults = await uploadPrivateFiles([
			{
				file: composedFile,
				relativePath: "design-mark/",
				// eslint-disable-next-line @typescript-eslint/no-empty-function
				onUploadComplete: () => {},
				// eslint-disable-next-line @typescript-eslint/no-empty-function
				onUploadFailed: () => {},
			},
		])

		if (!uploadResults?.length || !uploadResults[0].path) {
			throw new Error("上传文件失败：未返回文件路径")
		}

		const filePath = uploadResults[0].path

		return {
			filePath,
			imageInfo,
		}
	}

	/**
	 * 识别图片标记
	 * @returns 返回识别结果
	 */
	static async identify(input: IdentifyInput): Promise<IdentifyImageMarkResponse> {
		const { marker, filePath, imageInfo, methods, projectId } = input
		const { identifyImageMark } = methods

		const request = buildIdentifyRequest(marker, filePath, imageInfo, projectId)
		const result = await identifyImageMark(request)
		return result
	}

	/**
	 * 将 marker 与图片合成并完成识别（便捷方法）
	 */
	static async compositeAndIdentify(
		input: MarkerCompositorInput,
	): Promise<IdentifyImageMarkResponse> {
		const compositeResult = await this.composite(input)
		return this.identify({
			marker: input.marker,
			filePath: compositeResult.filePath,
			imageInfo: compositeResult.imageInfo,
			methods: {
				identifyImageMark: input.methods.identifyImageMark,
			},
			projectId: input.projectId,
		})
	}
}

async function loadImageFromUrl(
	url: string,
): Promise<{ image: HTMLImageElement; imageInfo: ImageInfoForComposite }> {
	const response = await fetch(url)
	if (!response.ok) {
		throw new Error(`加载图片失败: ${response.status} ${response.statusText}`)
	}

	const blob = await response.blob()
	const fileSize = blob.size
	const mimeType = blob.type || "image/png"

	const image = await createImageFromBlob(blob)
	const naturalWidth = image.naturalWidth
	const naturalHeight = image.naturalHeight

	const urlPath = url.split("?")[0] || ""
	const filename = urlPath.split("/").pop() || "image.png"

	return {
		image,
		imageInfo: {
			naturalWidth,
			naturalHeight,
			fileSize,
			mimeType,
			filename,
		},
	}
}

function createImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(blob)
		const img = new Image()
		img.onload = () => {
			URL.revokeObjectURL(url)
			resolve(img)
		}
		img.onerror = () => {
			URL.revokeObjectURL(url)
			reject(new Error("创建图片失败"))
		}
		img.src = url
	})
}

function shouldCompressImage(
	params: { fileSize: number; width: number; height: number; mimeType: string },
	config: ImageCompressionConfig = DEFAULT_COMPRESSION_CONFIG,
): { compress: boolean; quality: number; outputFormat: string } {
	const { fileSize, width, height, mimeType } = params

	if (!config.enableCompression) {
		return { compress: false, quality: 1.0, outputFormat: mimeType }
	}

	const totalPixels = width * height
	const bytesPerPixel = fileSize / totalPixels

	if (mimeType === "image/png") {
		if (bytesPerPixel < config.pngMinBytesPerPixel) {
			return { compress: false, quality: 1.0, outputFormat: mimeType }
		}
		if (bytesPerPixel > 2.0 && fileSize > config.pngToJpegThreshold) {
			return {
				compress: true,
				quality: config.pngToJpegQuality,
				outputFormat: "image/jpeg",
			}
		}
		return { compress: false, quality: 1.0, outputFormat: mimeType }
	}

	if (bytesPerPixel < config.minBytesPerPixel) {
		return { compress: false, quality: 1.0, outputFormat: mimeType }
	}

	const quality = Math.max(
		config.minQuality,
		Math.min(
			config.maxQuality,
			1.0 - Math.log10(bytesPerPixel + 1) * config.qualityCurveCoefficient,
		),
	)

	return {
		compress: true,
		quality: Math.round(quality * 100) / 100,
		outputFormat: "image/jpeg",
	}
}

async function compositeMarkerWithImage(
	marker: Marker,
	image: HTMLImageElement | ImageBitmap,
	imageInfo: ImageInfoForComposite,
	sequence: number,
): Promise<File> {
	const canvas = document.createElement("canvas")
	canvas.width = imageInfo.naturalWidth
	canvas.height = imageInfo.naturalHeight

	const ctx = canvas.getContext("2d")
	if (!ctx) {
		throw new Error("获取 Canvas 2D 上下文失败")
	}

	// 绘制原图
	ctx.drawImage(image, 0, 0, imageInfo.naturalWidth, imageInfo.naturalHeight)

	// 绘制 marker
	drawMarkerOnCanvas(ctx, marker, imageInfo, sequence)

	// 压缩策略
	const compressionResult = shouldCompressImage({
		fileSize: imageInfo.fileSize,
		width: imageInfo.naturalWidth,
		height: imageInfo.naturalHeight,
		mimeType: imageInfo.mimeType,
	})

	const blob = await new Promise<Blob | null>((resolve) => {
		canvas.toBlob(
			resolve,
			compressionResult.outputFormat as "image/jpeg" | "image/png",
			compressionResult.quality,
		)
	})

	if (!blob) {
		throw new Error("将 Canvas 转换为 Blob 失败")
	}

	const lastDotIndex = imageInfo.filename.lastIndexOf(".")
	const baseExt = lastDotIndex !== -1 ? imageInfo.filename.slice(lastDotIndex) : ""
	let ext = baseExt
	if (compressionResult.outputFormat === "image/jpeg" && baseExt.toLowerCase() === ".png") {
		ext = ".jpg"
	}
	const newFilename = `${generateUUID()}${ext}`

	return new File([blob], newFilename, { type: compressionResult.outputFormat })
}

function buildIdentifyRequest(
	marker: Marker,
	filePath: string,
	imageInfo: ImageInfoForComposite,
	projectId?: string,
): IdentifyImageMarkRequest {
	if (marker.type === MarkerTypeEnum.Mark) {
		return {
			type: MarkerTypeEnum.Mark,
			project_id: projectId,
			file_path: filePath,
			mark: [marker.relativeX, marker.relativeY],
		}
	}

	const areaMarker = marker as MarkerArea
	const pixelWidth = areaMarker.areaWidth * imageInfo.naturalWidth
	const pixelHeight = areaMarker.areaHeight * imageInfo.naturalHeight
	return {
		type: MarkerTypeEnum.Area,
		project_id: projectId,
		file_path: filePath,
		area: [areaMarker.relativeX, areaMarker.relativeY, pixelWidth, pixelHeight],
	}
}
