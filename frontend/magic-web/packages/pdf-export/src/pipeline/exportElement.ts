import type { ExportElementToPdfOptions } from "../api/options"
import { canvasToSinglePdfPage, captureElementToCanvas, sliceCanvasIntoPages } from "../capture/pageCapture"
import { packagePdfInWorker } from "../packaging/package-pdf"
import { downloadBlobFile } from "../packaging/pdf-document"
import { throwIfAborted } from "../sandbox/abort"
import { DEFAULT_PAGE_CONFIG } from "../shared/constants"
import { ensurePdfFileName } from "../shared/page"
import { log, LogLevel } from "../logger"

/**
 * 从已渲染好的 DOM 元素直接导出 PDF
 * 跳过 markdown→html 解析和 sandbox iframe 渲染，直接对元素截图
 * 适用于业务层用自己的组件渲染好内容后传入 DOM 节点的场景
 */
export async function runElementExportPipeline(
	element: HTMLElement,
	options: ExportElementToPdfOptions | undefined,
	signal: AbortSignal,
): Promise<Blob | void> {
	const pixelRatio = options?.pixelRatio ?? DEFAULT_PAGE_CONFIG.pixelRatio
	const imageType = options?.imageType ?? DEFAULT_PAGE_CONFIG.imageType
	const imageQuality = options?.imageQuality ?? DEFAULT_PAGE_CONFIG.imageQuality
	const output = options?.output ?? DEFAULT_PAGE_CONFIG.output
	const fileName = ensurePdfFileName(options?.fileName ?? "export.pdf")
	const pagination = options?.pagination ?? DEFAULT_PAGE_CONFIG.pagination
	const paper = options?.paper ?? DEFAULT_PAGE_CONFIG.paper

	// capture 阶段：直接对 DOM 元素截图
	options?.onProgress?.({ phase: "capture", current: 0, total: 1 })

	log(LogLevel.L2, "Capturing element", {
		width: element.scrollWidth,
		height: element.scrollHeight,
	})

	const canvas = await captureElementToCanvas({
		element,
		pixelRatio,
		signal,
	})
	throwIfAborted(signal)

	const pages = pagination === "slice"
		? await sliceCanvasIntoPages({
				canvas,
				pageWidthMm: paper.widthMm,
				pageHeightMm: paper.heightMm,
				imageType,
				imageQuality,
				pixelRatio,
			})
		: [
				await canvasToSinglePdfPage({
					canvas,
					imageType,
					imageQuality,
					pixelRatio,
				}),
			]

	options?.onProgress?.({ phase: "capture", current: 1, total: 1 })

	// 组装 PDF
	options?.onProgress?.({ phase: "assemble", current: 0, total: 1 })
	const buffer = await packagePdfInWorker({
		pages,
		pageSize: { width: paper.widthMm, height: paper.heightMm },
		usePerPageSize: pagination === "none",
		signal,
	})
	const blob = new Blob([buffer], { type: "application/pdf" })
	options?.onProgress?.({ phase: "assemble", current: 1, total: 1 })

	if (output === "blob") return blob
	downloadBlobFile(blob, fileName)
	return undefined
}
