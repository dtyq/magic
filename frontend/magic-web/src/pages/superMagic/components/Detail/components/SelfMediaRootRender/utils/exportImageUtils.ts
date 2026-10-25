import * as htmlToImage from "html-to-image"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { logger as rootLogger } from "@/infrastructure/logger"
import type { CardFrameRef } from "../components/CardFrame"
import {
	WECHAT_COVER_BASE_HEIGHT,
	WECHAT_HERO_COVER_ASPECT_RATIO,
} from "../platforms/wechat-official-accounts/wechatCoverDimensions"
import type { SelfMediaCard, SelfMediaPost } from "../types"
import { getExportImageMimeType, SELF_MEDIA_EXPORT_IMAGE_QUALITY } from "./exportImageFormat"
import type { SelfMediaExportFormat } from "./exportImageFormat"

const log = rootLogger.createLogger("selfMediaExportImageUtils")
const PER_CARD_TIMEOUT = 20000
const HIGH_RES_WEBP_TIMEOUT = 45000
const CAPTURE_ATTEMPTS = 2
const LONG_IMAGE_SEPARATOR_COLOR = "#e5e7eb"

export function dataUrlToBlob(dataUrl: string): Blob {
	const [meta, base64] = dataUrl.split(",")
	const mime = /data:(.*?);base64/.exec(meta)?.[1] || "image/png"
	const binary = atob(base64)
	const buffer = new Uint8Array(binary.length)
	for (let index = 0; index < binary.length; index++) {
		buffer[index] = binary.charCodeAt(index)
	}
	return new Blob([buffer], { type: mime })
}

export function safeName(input: string, fallback: string): string {
	const trimmed = (input || "").trim().replace(/[\\/:*?"<>|]+/g, "_")
	return trimmed || fallback
}

function stemFromCardHtmlPath(path: string): string {
	const trimmed = (path || "").trim()
	if (!trimmed) return ""
	const base = trimmed.split(/[/\\]/).pop() || trimmed
	return base.replace(/\.html?$/i, "").trim()
}

export function imageNameForCard(
	card: SelfMediaCard,
	oneBasedIndex: number,
	format: SelfMediaExportFormat,
): string {
	const index = String(oneBasedIndex).padStart(2, "0")
	const stem = safeName(stemFromCardHtmlPath(card.path), "card")
	return `${index}_${stem}.${format}`
}

export function resolveZipBaseName(posts: SelfMediaPost[], zipName?: string): string {
	if (zipName?.trim()) return safeName(zipName.trim(), "self-media")
	const first = posts[0]
	return safeName(first?.meta.title?.trim() || first?.meta.id || "", "self-media")
}

export function resolvePostBaseName(post: SelfMediaPost, fileName?: string): string {
	if (fileName?.trim()) return safeName(fileName.trim(), "self-media-long-image")
	return safeName(post.meta.title || post.meta.id, "self-media-long-image")
}

export function resolveWechatCoverBaseName(post: SelfMediaPost, fileName?: string): string {
	if (fileName?.trim()) return safeName(fileName.trim(), "wechat-cover")
	return safeName(post.meta.title || post.meta.feedTitle || post.meta.id, "wechat-cover")
}

function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onloadend = () => {
			if (typeof reader.result === "string") resolve(reader.result)
			else reject(new Error("Failed to convert image blob to data URL"))
		}
		reader.onerror = () => reject(reader.error || new Error("Failed to read image blob"))
		reader.readAsDataURL(blob)
	})
}

export async function captureCardDataUrl(args: {
	cardRef: CardFrameRef | null
	pixelRatio: number
	format: SelfMediaExportFormat
	postIdx: number
	cardIdx: number
}): Promise<string | null> {
	const { cardRef, pixelRatio, format, postIdx, cardIdx } = args
	let dataUrl: string | null = null
	let usedHostFallback = false
	if (cardRef) {
		const isHighResWebp = format === "webp" && pixelRatio >= 2
		const timeoutMs = isHighResWebp ? HIGH_RES_WEBP_TIMEOUT : PER_CARD_TIMEOUT
		const maxAttempts = isHighResWebp ? CAPTURE_ATTEMPTS : 1
		for (let attempt = 1; attempt <= maxAttempts && !dataUrl; attempt++) {
			try {
				dataUrl = await cardRef.capture({
					pixelRatio,
					timeoutMs,
					format,
				})
			} catch (error) {
				log.warn("⚠️ 卡片截图失败", {
					postIdx,
					cardIdx,
					attempt,
					maxAttempts,
					timeoutMs,
					error,
				})
			}
		}
		if (!dataUrl) {
			const iframe = cardRef.getIframeElement()
			if (iframe) {
				usedHostFallback = true
				try {
					const blob = await htmlToImage.toBlob(iframe, {
						pixelRatio,
						cacheBust: true,
						type: getExportImageMimeType(format),
						quality: SELF_MEDIA_EXPORT_IMAGE_QUALITY,
					})
					dataUrl = blob ? await blobToDataUrl(blob) : null
				} catch (error) {
					log.warn("⚠️ 宿主截图回退也失败，跳过当前卡片", {
						postIdx,
						cardIdx,
						error,
					})
				}
			}
		}
	}
	if (!dataUrl) {
		log.warn("⚠️ 当前卡片未产出图像，已跳过", { postIdx, cardIdx, usedHostFallback })
	}
	return dataUrl
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image()
		image.onload = () => resolve(image)
		image.onerror = () => reject(new Error("Failed to load captured card image"))
		image.src = dataUrl
	})
}

function canvasToImageBlob(
	canvas: HTMLCanvasElement,
	format: SelfMediaExportFormat,
): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) resolve(blob)
				else reject(new Error("Failed to create exported image blob"))
			},
			getExportImageMimeType(format),
			SELF_MEDIA_EXPORT_IMAGE_QUALITY,
		)
	})
}

async function loadImageFromFileId(
	fileApi: Pick<FileApi, "getTemporaryDownloadUrl">,
	fileId: string,
): Promise<HTMLImageElement> {
	const urls = await fileApi.getTemporaryDownloadUrl({ file_ids: [fileId] })
	const url = urls?.[0]?.url
	if (!url) throw new Error("Cover image URL is unavailable")
	const response = await fetch(url, { credentials: "omit" })
	if (!response.ok) throw new Error("Cover image download failed")
	const objectUrl = URL.createObjectURL(await response.blob())
	try {
		return await new Promise<HTMLImageElement>((resolve, reject) => {
			const image = new Image()
			image.onload = () => resolve(image)
			image.onerror = () => reject(new Error("Failed to load cover image"))
			image.src = objectUrl
		})
	} finally {
		URL.revokeObjectURL(objectUrl)
	}
}

function drawImageCover(
	context: CanvasRenderingContext2D,
	image: HTMLImageElement,
	x: number,
	y: number,
	width: number,
	height: number,
) {
	const sourceWidth = image.naturalWidth || image.width
	const sourceHeight = image.naturalHeight || image.height
	if (sourceWidth <= 0 || sourceHeight <= 0 || width <= 0 || height <= 0) return
	const sourceRatio = sourceWidth / sourceHeight
	const targetRatio = width / height
	let sourceX = 0
	let sourceY = 0
	let cropWidth = sourceWidth
	let cropHeight = sourceHeight
	if (sourceRatio > targetRatio) {
		cropWidth = sourceHeight * targetRatio
		sourceX = (sourceWidth - cropWidth) / 2
	} else {
		cropHeight = sourceWidth / targetRatio
		sourceY = (sourceHeight - cropHeight) / 2
	}
	context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, x, y, width, height)
}

export async function stitchWechatCoverImagesToBlob(args: {
	thumbnailFileId?: string
	heroFileId?: string
	pixelRatio: number
	format: SelfMediaExportFormat
	fileApi: Pick<FileApi, "getTemporaryDownloadUrl">
}): Promise<Blob> {
	const { thumbnailFileId, heroFileId, pixelRatio, format, fileApi } = args
	if (!thumbnailFileId || !heroFileId) throw new Error("Cover images are missing")
	const [squareImage, horizontalImage] = await Promise.all([
		loadImageFromFileId(fileApi, thumbnailFileId),
		loadImageFromFileId(fileApi, heroFileId),
	])
	const targetHeight = Math.max(1, Math.round(WECHAT_COVER_BASE_HEIGHT * pixelRatio))
	const squareWidth = targetHeight
	const horizontalWidth = Math.round(targetHeight * WECHAT_HERO_COVER_ASPECT_RATIO)
	const canvas = document.createElement("canvas")
	canvas.width = squareWidth + horizontalWidth
	canvas.height = targetHeight
	const context = canvas.getContext("2d")
	if (!context) throw new Error("Canvas 2D context is unavailable")
	context.fillStyle = "#ffffff"
	context.fillRect(0, 0, canvas.width, canvas.height)
	drawImageCover(context, squareImage, 0, 0, squareWidth, targetHeight)
	drawImageCover(context, horizontalImage, squareWidth, 0, horizontalWidth, targetHeight)
	return canvasToImageBlob(canvas, format)
}

export async function stitchCardDataUrlsToBlob(
	dataUrls: string[],
	separatorHeight: number,
	format: SelfMediaExportFormat,
): Promise<Blob> {
	const images = await Promise.all(dataUrls.map(loadImageFromDataUrl))
	const width = Math.max(...images.map((image) => image.width))
	const safeSeparatorHeight = Math.max(0, Math.floor(separatorHeight))
	const height =
		images.reduce((sum, image) => sum + image.height, 0) +
		Math.max(images.length - 1, 0) * safeSeparatorHeight
	if (width <= 0 || height <= 0) throw new Error("Captured card images have invalid dimensions")
	const canvas = document.createElement("canvas")
	canvas.width = width
	canvas.height = height
	const context = canvas.getContext("2d")
	if (!context) throw new Error("Canvas 2D context is unavailable")
	// Keep the background deterministic for JPG and for mixed-width cards.
	context.fillStyle = "#ffffff"
	context.fillRect(0, 0, width, height)
	let y = 0
	for (let index = 0; index < images.length; index++) {
		const image = images[index]
		context.drawImage(image, Math.floor((width - image.width) / 2), y)
		y += image.height
		if (safeSeparatorHeight > 0 && index < images.length - 1) {
			context.fillStyle = LONG_IMAGE_SEPARATOR_COLOR
			context.fillRect(0, y, width, safeSeparatorHeight)
			y += safeSeparatorHeight
		}
	}
	return canvasToImageBlob(canvas, format)
}
