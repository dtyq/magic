import { snapdom } from "@zumer/snapdom"
import type { PdfImageType } from "../api/options"
import { log, LogLevel } from "../logger"
import { throwIfAborted } from "../sandbox/abort"
import { DEFAULT_DPI, MM_PER_INCH } from "../shared/constants"

export interface CaptureInput {
	iDocument: Document
	pixelRatio: number
	signal: AbortSignal
}

export interface CaptureFullDocumentInput extends CaptureInput {
	imageType: PdfImageType
	imageQuality: number
}

export interface CapturedPage {
	imageType: PdfImageType
	imageBytes: ArrayBuffer
}

/**
 * 整页截图，返回原始 Canvas（不做格式转换）
 * 供分页模式使用：先拿到 canvas，再切片
 */
export async function captureToCanvas({
	iDocument,
	pixelRatio,
	signal,
}: CaptureInput): Promise<HTMLCanvasElement> {
	throwIfAborted(signal)
	const body = iDocument.body
	return captureElementToCanvas({ element: body, pixelRatio, signal })
}

/**
 * 对任意 DOM 元素截图，返回原始 Canvas
 * 可用于离屏渲染的 DOM 节点直接截图（不需要 iframe sandbox）
 */
export async function captureElementToCanvas({
	element,
	pixelRatio,
	signal,
}: {
	element: HTMLElement
	pixelRatio: number
	signal: AbortSignal
}): Promise<HTMLCanvasElement> {
	throwIfAborted(signal)
	const result = await snapdom(element, {
		embedFonts: true,
		cache: "auto",
		scale: pixelRatio,
		backgroundColor: "#ffffff",
	} as Parameters<typeof snapdom>[1])
	const canvas = await result.toCanvas()
	log(LogLevel.L2, "Captured element to canvas (snapdom)", {
		canvasWidth: canvas.width,
		canvasHeight: canvas.height,
		contentWidth: element.scrollWidth,
		contentHeight: element.scrollHeight,
	})
	return canvas
}

/**
 * 整页截图并直接转换为单个 CapturedPage（单页模式）
 */
export async function captureFullDocument({
	iDocument,
	pixelRatio,
	imageType,
	imageQuality,
	signal,
}: CaptureFullDocumentInput): Promise<CapturedPage> {
	const canvas = await captureToCanvas({ iDocument, pixelRatio, signal })
	const imageBytes = await canvasToArrayBuffer(canvas, imageType, imageQuality)
	canvas.width = 0
	canvas.height = 0
	return { imageType, imageBytes }
}

/**
 * 将整页 canvas 按目标页面尺寸纵向切片
 *
 * 原理：
 * - canvas 宽度对应 PDF 页宽 (pageWidthMm)
 * - 根据宽高比计算每页在 canvas 上的像素高度
 * - 逐页裁剪并转为 ArrayBuffer
 */
export async function sliceCanvasIntoPages({
	canvas,
	pageWidthMm,
	pageHeightMm,
	imageType,
	imageQuality,
}: {
	canvas: HTMLCanvasElement
	pageWidthMm: number
	pageHeightMm: number
	imageType: PdfImageType
	imageQuality: number
	pixelRatio?: number
}): Promise<(CapturedPage & { widthMm: number; heightMm: number })[]> {
	const canvasWidth = canvas.width
	const canvasHeight = canvas.height

	// 每页在 canvas 坐标中的高度 = canvasWidth * (pageHeightMm / pageWidthMm)
	const sliceHeightPx = Math.round(canvasWidth * (pageHeightMm / pageWidthMm))
	const pageCount = Math.max(1, Math.ceil(canvasHeight / sliceHeightPx))

	log(LogLevel.L2, "Slicing canvas into pages", {
		canvasWidth,
		canvasHeight,
		sliceHeightPx,
		pageCount,
		pageWidthMm,
		pageHeightMm,
	})

	const pages: (CapturedPage & { widthMm: number; heightMm: number })[] = []

	for (let i = 0; i < pageCount; i++) {
		const srcY = i * sliceHeightPx
		const srcH = Math.min(sliceHeightPx, canvasHeight - srcY)

		const sliceCanvas = document.createElement("canvas")
		sliceCanvas.width = canvasWidth
		sliceCanvas.height = srcH

		const ctx = sliceCanvas.getContext("2d")
		if (!ctx) throw new Error("Failed to create slice canvas context")

		// 白色背景（避免 JPEG 透明区域变黑）
		ctx.fillStyle = "#ffffff"
		ctx.fillRect(0, 0, canvasWidth, srcH)

		ctx.drawImage(canvas, 0, srcY, canvasWidth, srcH, 0, 0, canvasWidth, srcH)

		const imageBytes = await canvasToArrayBuffer(sliceCanvas, imageType, imageQuality)
		sliceCanvas.width = 0
		sliceCanvas.height = 0

		// 最后一页可能不满一页高度，按实际比例计算 mm
		const actualHeightMm = pageWidthMm * (srcH / canvasWidth)

		pages.push({
			imageType,
			imageBytes,
			widthMm: pageWidthMm,
			heightMm: actualHeightMm,
		})
	}

	// 释放源 canvas
	canvas.width = 0
	canvas.height = 0

	log(LogLevel.L1, `Sliced into ${pages.length} pages`)
	return pages
}

export async function canvasToSinglePdfPage({
	canvas,
	imageType,
	imageQuality,
	pixelRatio,
	cssLayoutWidthPx,
	cssLayoutHeightPx,
}: {
	canvas: HTMLCanvasElement
	imageType: PdfImageType
	imageQuality: number
	pixelRatio: number
	/** 使用布局 CSS 像素宽高计算 PDF 页物理尺寸（snapdom 位图倍率可能 ≠ pixelRatio） */
	cssLayoutWidthPx?: number
	cssLayoutHeightPx?: number
}): Promise<CapturedPage & { widthMm: number; heightMm: number }> {
	const contentWidthPx = cssLayoutWidthPx ?? canvas.width / pixelRatio
	const contentHeightPx = cssLayoutHeightPx ?? canvas.height / pixelRatio
	const pxToMm = MM_PER_INCH / DEFAULT_DPI
	const imageBytes = await canvasToArrayBuffer(canvas, imageType, imageQuality)

	canvas.width = 0
	canvas.height = 0

	return {
		imageType,
		imageBytes,
		widthMm: contentWidthPx * pxToMm,
		heightMm: contentHeightPx * pxToMm,
	}
}

export function canvasToArrayBuffer(
	canvas: HTMLCanvasElement,
	imageType: PdfImageType,
	imageQuality: number,
): Promise<ArrayBuffer> {
	const mimeType = imageType === "jpeg" ? "image/jpeg" : "image/png"
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (!blob) {
					reject(new Error("canvas.toBlob returned null"))
					return
				}
				blob.arrayBuffer().then(resolve, reject)
			},
			mimeType,
			mimeType === "image/jpeg" ? imageQuality : undefined,
		)
	})
}
