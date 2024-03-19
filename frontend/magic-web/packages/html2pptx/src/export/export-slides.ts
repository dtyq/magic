import type { SlideConfig, ExportPageContext } from "../types/index"
import type { SandboxInstance } from "../renderer/createSandbox"
import { log, LogLevel } from "../logger"
import { createAbortError } from "../renderer/abort"
import { ensureNotAborted } from "./abort-guard"
import { renderSlide } from "./render-slide"
import { createPresentation, ensureFileName } from "./pptx-document"
import { awaitPendingMedia } from "../drawer/drawMedia"

export interface ExportTaskInput {
	config: SlideConfig
	fileName: string
	htmlSlides: string[]
	sandbox: SandboxInstance
	skipFailedPages: boolean
	onSlideProgress?: (context: ExportPageContext) => void
	signal: AbortSignal
}

/**
 * 执行单文件多页导出：依次渲染每页 HTML 并写入同一个 PPTX
 */
export async function runExport({
	config,
	fileName,
	htmlSlides,
	sandbox,
	skipFailedPages,
	onSlideProgress,
	signal,
}: ExportTaskInput): Promise<void> {
	const pres = createPresentation(config)
	let successCount = 0

	log(LogLevel.L2, "开始导出", { slideCount: htmlSlides.length, fileName })

	for (let i = 0; i < htmlSlides.length; i++) {
		ensureNotAborted(signal)
		const html = htmlSlides[i]
		const pageFileName = ensureFileName(fileName)
		onSlideProgress?.({
			index: i,
			total: htmlSlides.length,
			html,
			fileName: pageFileName,
			config,
		})
		log(LogLevel.L2, `处理第 ${i + 1}/${htmlSlides.length} 页`)

		try {
			const slide = pres.addSlide()
			await renderSlide({ config, html, sandbox, slide, signal })
			ensureNotAborted(signal)
			successCount += 1
			log(LogLevel.L2, `第 ${i + 1} 页绘制完成（媒体下载可能仍在后台进行）`)
		} catch (error) {
			if (signal.aborted) throw createAbortError()
			log(LogLevel.L4, `第 ${i + 1} 页导出失败`, { error: String(error) })
			if (!skipFailedPages) throw error
		}
	}

	if (successCount === 0) throw new Error("[exportPPTX] 所有页面导出失败")

	ensureNotAborted(signal)
	await awaitPendingMedia(signal)

	ensureNotAborted(signal)
	await pres.writeFile({ fileName: ensureFileName(fileName) })
	log(LogLevel.L2, "导出完成", { fileName, successCount, total: htmlSlides.length })
}
