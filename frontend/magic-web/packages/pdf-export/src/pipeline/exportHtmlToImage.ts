import type { PdfImageType, PdfProgressContext } from "../api/options"
import { captureToCanvas } from "../capture/pageCapture"
import { materializePseudoIcons, restoreIcons } from "../materialize/pseudo-icon"
import { collectCanvasSnapshots, compositeCanvasSnapshots, preprocessDOM } from "../preprocess/domLevel"
import { preprocessString } from "../preprocess/stringLevel"
import { PdfRenderSandbox } from "../sandbox"
import { measureContentSize } from "../sandbox/pdfRenderSandbox.helpers"
import { throwIfAborted } from "../sandbox/abort"
import { packageImagesInWorker } from "../packaging/package-images"
import { log, LogLevel } from "../logger"
import type { ExternalLogger, LogLevelLabel } from "../logger"

const RESIZE_EPSILON_PX = 2

/**
 * canvas 总像素上限（64 百万像素 ≈ 256MB 显存）
 * 超出时自动降低 pixelRatio 以避免 GPU 光栅化卡顿和 OOM
 */
const MAX_CANVAS_PIXELS = 64_000_000

/**
 * 让出主线程，等待浏览器完成一帧渲染后再继续
 * rAF 回调在下一帧绘制前执行，内部再 setTimeout(0) 确保 paint 完成
 */
const yieldToMain = (): Promise<void> =>
	new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))

/**
 * 根据内容实际尺寸和像素上限，计算安全的 pixelRatio
 */
function clampPixelRatio(
	contentWidth: number,
	contentHeight: number,
	requestedRatio: number,
): number {
	const totalPixels = contentWidth * requestedRatio * contentHeight * requestedRatio
	if (totalPixels <= MAX_CANVAS_PIXELS) return requestedRatio
	const safeRatio = Math.sqrt(MAX_CANVAS_PIXELS / (contentWidth * contentHeight))
	const clamped = Math.max(1, Math.floor(safeRatio * 10) / 10) // 保留一位小数，最低 1x
	log(LogLevel.L1, "Clamped pixelRatio to avoid oversized canvas", {
		contentWidth,
		contentHeight,
		requestedRatio,
		clampedRatio: clamped,
		estimatedPixels: Math.round(contentWidth * clamped * contentHeight * clamped),
	})
	return clamped
}

// ─── 类型 ───────────────────────────────────────────────────

export type ImageExportFormat = "png" | "jpeg"

export interface ExportHtmlToImageOptions {
	pages: string[]
	format?: ImageExportFormat
	/** JPEG 质量 (0-1)，仅 format=jpeg 时有效 */
	imageQuality?: number
	fileName?: string
	viewport?: { width: number; height: number }
	pixelRatio?: number
	onProgress?: (ctx: PdfProgressContext) => void
	logger?: ExternalLogger
	logLevel?: LogLevelLabel
}

interface ResolvedOptions {
	pages: string[]
	format: ImageExportFormat
	imageQuality: number
	fileName: string
	viewport: { width: number; height: number }
	pixelRatio: number
	onProgress?: (ctx: PdfProgressContext) => void
}

export interface ExportImageHandle {
	promise: Promise<void>
	cancel: () => void
}

// ─── 工具 ───────────────────────────────────────────────────

function resolveOptions(options: ExportHtmlToImageOptions): ResolvedOptions {
	const pages = options.pages.filter((p) => typeof p === "string" && p.length > 0)
	if (!pages.length) throw new Error("exportHtmlToImage requires at least one non-empty HTML page")

	const format = options.format ?? "png"
	return {
		pages,
		format,
		imageQuality: options.imageQuality ?? (format === "jpeg" ? 0.92 : 1),
		fileName: options.fileName?.replace(/\.[^.]+$/, "") ?? "export",
		viewport: {
			width: options.viewport?.width ?? 1440,
			height: options.viewport?.height ?? 900,
		},
		pixelRatio: options.pixelRatio ?? 2,
	}
}

function canvasToArrayBuffer(canvas: HTMLCanvasElement, format: ImageExportFormat, quality: number): Promise<ArrayBuffer> {
	const mimeType = format === "png" ? "image/png" : "image/jpeg"
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (!blob) return reject(new Error("canvas.toBlob returned null"))
				blob.arrayBuffer().then(resolve, reject)
			},
			mimeType,
			quality,
		)
	})
}

function downloadBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob)
	const anchor = document.createElement("a")
	anchor.href = url
	anchor.download = fileName
	anchor.click()
	setTimeout(() => URL.revokeObjectURL(url), 0)
}

// ─── 核心流水线 ──────────────────────────────────────────────

async function runImageExportPipeline(
	options: ExportHtmlToImageOptions,
	signal: AbortSignal,
): Promise<void> {
	const resolved = resolveOptions(options)
	const { pages, format, imageQuality, fileName, viewport, pixelRatio } = resolved
	const total = pages.length
	const ext = format === "png" ? "png" : "jpg"
	const mimeType = format === "png" ? "image/png" : "image/jpeg"

	const imageFiles: { buffer: ArrayBuffer; name: string }[] = []

	const sandbox = new PdfRenderSandbox({
		pageWidthPx: viewport.width,
		pageHeightPx: viewport.height,
	})

	try {
		for (let index = 0; index < total; index++) {
			throwIfAborted(signal)

			resolved.onProgress?.({ phase: "preprocess", current: index, total })
			const html = preprocessString(pages[index])
			resolved.onProgress?.({ phase: "preprocess", current: index + 1, total })

			resolved.onProgress?.({ phase: "render", current: index, total })
			let { iDocument, iWindow, totalWidth, totalHeight } = await sandbox.render(html, { signal })
			throwIfAborted(signal)

			// auto-resize to content
			if (
				Math.abs(viewport.width - totalWidth) > RESIZE_EPSILON_PX ||
				Math.abs(viewport.height - totalHeight) > RESIZE_EPSILON_PX
			) {
				sandbox.resize({ pageWidthPx: totalWidth, pageHeightPx: totalHeight })
				const reflowed = await sandbox.reflow({ signal })
				iDocument = reflowed.iDocument
				iWindow = reflowed.iWindow
				totalWidth = reflowed.totalWidth
				totalHeight = reflowed.totalHeight
				throwIfAborted(signal)
			}

			preprocessDOM(iDocument)
			await yieldToMain()

			const postPre = measureContentSize({
				iframeDocument: iDocument,
				fallbackWidth: viewport.width,
				fallbackHeight: viewport.height,
			})

			if (
				postPre.width > totalWidth + RESIZE_EPSILON_PX ||
				postPre.height > totalHeight + RESIZE_EPSILON_PX
			) {
				sandbox.resize({ pageWidthPx: postPre.width, pageHeightPx: postPre.height })
				const postLayoutReflow = await sandbox.reflow({ signal })
				iDocument = postLayoutReflow.iDocument
				iWindow = postLayoutReflow.iWindow
				preprocessDOM(iDocument)
				await yieldToMain()
			}

			const canvasSnapshots = collectCanvasSnapshots(iDocument)
			const iconBackups = materializePseudoIcons(iDocument, iWindow)
			resolved.onProgress?.({ phase: "render", current: index + 1, total })
			await yieldToMain()

			// 根据实际内容尺寸自适应 pixelRatio，防止超大 canvas 卡顿/OOM
			const effectivePixelRatio = clampPixelRatio(
				iDocument.body.scrollWidth || viewport.width,
				iDocument.body.scrollHeight || viewport.height,
				pixelRatio,
			)

			resolved.onProgress?.({ phase: "capture", current: index, total })
			const canvas = await captureToCanvas({ iDocument, pixelRatio: effectivePixelRatio, signal })
			throwIfAborted(signal)

			await compositeCanvasSnapshots(canvas, canvasSnapshots, pixelRatio)
			restoreIcons(iconBackups)

			const buffer = await canvasToArrayBuffer(canvas, format, imageQuality)
			canvas.width = 0
			canvas.height = 0

			const pageName = total === 1 ? `${fileName}.${ext}` : `${fileName}-${index + 1}.${ext}`
			imageFiles.push({ buffer, name: pageName })

			resolved.onProgress?.({ phase: "capture", current: index + 1, total })
			sandbox.resize({ pageWidthPx: viewport.width, pageHeightPx: viewport.height })
		}

		// 输出：单张直接下载，多张在 Worker 中打包为 ZIP
		resolved.onProgress?.({ phase: "assemble", current: 0, total: 1 })

		if (imageFiles.length === 1) {
			const blob = new Blob([imageFiles[0].buffer], { type: mimeType })
			downloadBlob(blob, imageFiles[0].name)
		} else {
			const zipBuffer = await packageImagesInWorker({
				files: imageFiles,
				zipFileName: `${fileName}.zip`,
				signal,
			})
			const zipBlob = new Blob([zipBuffer], { type: "application/zip" })
			downloadBlob(zipBlob, `${fileName}.zip`)
		}

		resolved.onProgress?.({ phase: "assemble", current: 1, total: 1 })
	} finally {
		sandbox.destroy()
	}
}

// ─── 公开 API ───────────────────────────────────────────────

export function exportHtmlToImage(options: ExportHtmlToImageOptions): ExportImageHandle {
	const controller = new AbortController()
	const promise = (async (): Promise<void> => {
		await runImageExportPipeline(options, controller.signal)
	})()
	return { promise, cancel: () => controller.abort() }
}
