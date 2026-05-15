import type { ExportHtmlToPdfOptions } from "../api/options"
import type { CapturedPage } from "../capture/pageCapture"
import { canvasToSinglePdfPage, captureToCanvas, sliceCanvasIntoPages } from "../capture/pageCapture"
import { materializePseudoIcons, restoreIcons } from "../materialize/pseudo-icon"
import { packagePdfInWorker } from "../packaging/package-pdf"
import { downloadBlobFile } from "../packaging/pdf-document"
import { collectCanvasSnapshots, compositeCanvasSnapshots, preprocessDOM } from "../preprocess/domLevel"
import { preprocessString } from "../preprocess/stringLevel"
import { PdfRenderSandbox } from "../sandbox"
import { measureContentSize } from "../sandbox/pdfRenderSandbox.helpers"
import { throwIfAborted } from "../sandbox/abort"
import { resolveExportHtmlToPdfOptions } from "../shared/page"
import { log, LogLevel } from "../logger"

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
	const clamped = Math.max(1, Math.floor(safeRatio * 10) / 10)
	log(LogLevel.L1, "Clamped pixelRatio to avoid oversized canvas", {
		contentWidth,
		contentHeight,
		requestedRatio,
		clampedRatio: clamped,
		estimatedPixels: Math.round(contentWidth * clamped * contentHeight * clamped),
	})
	return clamped
}

export async function runHtmlExportPipeline(
	options: ExportHtmlToPdfOptions,
	signal: AbortSignal,
): Promise<Blob | void> {
	const resolvedOptions = resolveExportHtmlToPdfOptions(options)

	const viewportWidthPx = resolvedOptions.viewport.width
	const viewportHeightPx = resolvedOptions.viewport.height
	const allPages: (CapturedPage & { widthMm: number; heightMm: number })[] = []
	const total = resolvedOptions.pages.length

	const sandbox = new PdfRenderSandbox({
		pageWidthPx: viewportWidthPx,
		pageHeightPx: viewportHeightPx,
	})
	try {
		for (let index = 0; index < total; index++) {
			throwIfAborted(signal)

			resolvedOptions.onProgress?.({ phase: "preprocess", current: index, total })
			const html = preprocessString(resolvedOptions.pages[index])
			resolvedOptions.onProgress?.({ phase: "preprocess", current: index + 1, total })

			resolvedOptions.onProgress?.({ phase: "render", current: index, total })
			let { iDocument, iWindow, totalWidth, totalHeight } = await sandbox.render(html, { signal })
			log(LogLevel.L2, "Sandbox render completed", {
				page: index + 1,
				totalWidth,
				totalHeight,
			})
			throwIfAborted(signal)

			// 按实际内容尺寸 resize 后 reflow（不重新 document.write，保留已渲染的 DOM）
			if (
				Math.abs(viewportWidthPx - totalWidth) > RESIZE_EPSILON_PX ||
				Math.abs(viewportHeightPx - totalHeight) > RESIZE_EPSILON_PX
			) {
				sandbox.resize({ pageWidthPx: totalWidth, pageHeightPx: totalHeight })
				const reflowed = await sandbox.reflow({ signal })
				iDocument = reflowed.iDocument
				iWindow = reflowed.iWindow
				totalWidth = reflowed.totalWidth
				totalHeight = reflowed.totalHeight
				log(LogLevel.L2, "Sandbox reflow after auto-size", {
					page: index + 1,
					totalWidth,
					totalHeight,
				})
				throwIfAborted(signal)
			}

			preprocessDOM(iDocument)
			await yieldToMain()

			const body = iDocument.body
			const postPre = measureContentSize({
				iframeDocument: iDocument,
				fallbackWidth: viewportWidthPx,
				fallbackHeight: viewportHeightPx,
			})

			if (
				postPre.width > totalWidth + RESIZE_EPSILON_PX ||
				postPre.height > totalHeight + RESIZE_EPSILON_PX
			) {
				sandbox.resize({
					pageWidthPx: postPre.width,
					pageHeightPx: postPre.height,
				})
				const postLayoutReflow = await sandbox.reflow({ signal })
				iDocument = postLayoutReflow.iDocument
				iWindow = postLayoutReflow.iWindow
				totalWidth = postLayoutReflow.totalWidth
				totalHeight = postLayoutReflow.totalHeight
				preprocessDOM(iDocument)
				await yieldToMain()
			}

			// 在 snapdom 截图前收集 canvas 元素快照（ECharts 等图表）
			const canvasSnapshots = collectCanvasSnapshots(iDocument)

			// 将伪元素图标（Font Awesome、Antd Icon 等）实体化为真实元素
			const iconBackups = materializePseudoIcons(iDocument, iWindow)
			resolvedOptions.onProgress?.({ phase: "render", current: index + 1, total })
			await yieldToMain()

			resolvedOptions.onProgress?.({ phase: "capture", current: index, total })

			// 根据实际内容尺寸自适应 pixelRatio，防止超大 canvas 卡顿/OOM
			const effectivePixelRatio = clampPixelRatio(
				iDocument.body.scrollWidth || viewportWidthPx,
				iDocument.body.scrollHeight || viewportHeightPx,
				resolvedOptions.pixelRatio,
			)

			const canvas = await captureToCanvas({
				iDocument,
				pixelRatio: effectivePixelRatio,
				signal,
			})
			throwIfAborted(signal)

			// 将 canvas 快照合成到 snapdom 输出的 canvas 上
			await compositeCanvasSnapshots(canvas, canvasSnapshots, resolvedOptions.pixelRatio)

			// 截图完成后恢复图标 DOM
			restoreIcons(iconBackups)

			if (resolvedOptions.pagination === "slice") {
				const pages = await sliceCanvasIntoPages({
					canvas,
					pageWidthMm: resolvedOptions.paper.widthMm,
					pageHeightMm: resolvedOptions.paper.heightMm,
					imageType: resolvedOptions.imageType,
					imageQuality: resolvedOptions.imageQuality,
					pixelRatio: resolvedOptions.pixelRatio,
				})
				allPages.push(...pages)
			} else {
				const page = await canvasToSinglePdfPage({
					canvas,
					imageType: resolvedOptions.imageType,
					imageQuality: resolvedOptions.imageQuality,
					pixelRatio: resolvedOptions.pixelRatio,
					cssLayoutWidthPx: body.scrollWidth,
					cssLayoutHeightPx: body.scrollHeight,
				})
				allPages.push(page)
			}

			resolvedOptions.onProgress?.({ phase: "capture", current: index + 1, total })
			sandbox.resize({ pageWidthPx: viewportWidthPx, pageHeightPx: viewportHeightPx })
		}

		resolvedOptions.onProgress?.({ phase: "assemble", current: 0, total: 1 })
		const buffer = await packagePdfInWorker({
			pages: allPages,
			pageSize: {
				width: resolvedOptions.paper.widthMm,
				height: resolvedOptions.paper.heightMm,
			},
			usePerPageSize: resolvedOptions.pagination === "none",
			signal,
		})
		const blob = new Blob([buffer], { type: "application/pdf" })
		resolvedOptions.onProgress?.({ phase: "assemble", current: 1, total: 1 })

		if (resolvedOptions.output === "blob") return blob
		downloadBlobFile(blob, resolvedOptions.fileName)
		return undefined
	} finally {
		sandbox.destroy()
	}
}
