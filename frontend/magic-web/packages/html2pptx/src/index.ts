import type { ExportOptions, ExportHandle } from "./types/index"
import { configureLogger } from "./logger"
import { createSandbox } from "./renderer"
import { DEFAULT_CONFIG } from "./utils/unit"
import { runExport } from "./export/export-slides"

/**
 * 导出 HTML 为 PPTX 文件
 *
 * 支持并发：每次调用返回独立的 { promise, cancel }，互不干扰。
 *
 * @param content - HTML 内容字符串，或多页 HTML 数组
 * @param options - 导出选项
 * @returns ExportHandle — promise 等待完成，cancel() 取消本次导出
 *
 * @example
 * ```ts
 * // 基础用法
 * const { promise } = exportPPTX('<div class="slide">...</div>')
 * await promise
 *
 * // 接入 console
 * exportPPTX(html, { logger: console })
 *
 * // 只收 warn 以上
 * exportPPTX(html, { logger: console, logLevel: "warn" })
 *
 * // 并发导出，各自独立取消
 * const exportA = exportPPTX(htmlA)
 * const exportB = exportPPTX(htmlB, { fileName: 'b.pptx' })
 * exportA.cancel()
 * await exportB.promise
 * ```
 */
export function exportPPTX(
	content: string | string[],
	options?: ExportOptions,
): ExportHandle {
	const controller = new AbortController()
	const promise = runExportPipeline(content, options, controller.signal)
	return { promise, cancel: () => controller.abort() }
}

async function runExportPipeline(
	content: string | string[],
	options: ExportOptions | undefined,
	signal: AbortSignal,
): Promise<void> {
	configureLogger({
		minLevel: options?.logLevel,
		logger: options?.logger,
	})

	const config = { ...DEFAULT_CONFIG, ...options?.config }
	const fileName = options?.fileName ?? "export.pptx"
	const htmlSlides = Array.isArray(content) ? content : [content]

	const sandbox = await createSandbox(config)
	try {
		await runExport({
			config,
			fileName,
			htmlSlides,
			sandbox,
			skipFailedPages: options?.skipFailedPages ?? false,
			onSlideProgress: options?.onSlideProgress,
			signal,
		})
	}
	catch (error) {
		throw error
	}
	finally {
		sandbox.destroy()
	}
}

export type { SlideConfig, ExportOptions, ExportPageContext, ExportHandle } from "./types/index"
export { DEFAULT_CONFIG } from "./utils/unit"
export { LogLevel } from "./logger"
