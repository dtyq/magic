import type {
	ExportProgress,
	LegacyExportHandle,
	LegacyExportOptions,
	LegacyExportSummary,
	SlideConfig,
	StreamingExportContent,
	StreamingHtmlPage,
	StreamingHtmlPageInput,
} from "../api/options"
import { configureLogger, log, LogLevel, resetLogger } from "../logger"
import { HtmlRenderSandbox } from "../sandbox"
import { createAbortError, throwIfAborted } from "../sandbox/abort"
import { DEFAULT_CONFIG, MAX_PPT_PAGE_PX } from "../shared/unit"
import { DEFAULT_DPI } from "../shared/constants"
import { prepareSlideNodes } from "./render-slide"
import { sliceByPageHeight } from "./slice-nodes"
import { createPresentation, ensureFileName } from "../packaging/pptx-document"
import { drawByRegistry } from "../registry/drawer-registry"
import { materializeLegacyPptImageNodes } from "../materialize/legacy-images"
import type { PPTNode } from "../ir/node"
import type { SerializablePPTNode } from "../ir/serialize"
import type { Html2PptxRuntime } from "../runtime"

const PPTX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation"

interface RenderedLegacyPage {
	nodes: PPTNode[]
	totalWidth: number
	totalHeight: number
	background: string | null
}

/**
 * Browser compatibility exporter.
 *
 * Unlike the streaming exporter this path never creates a Packaging Worker,
 * never opens an OPFS staging session and never requires a writable file
 * handle. It renders and packages the presentation on the main thread, then
 * returns a Blob for a normal browser download.
 */
export function createPptxLegacyExporter(runtime: Html2PptxRuntime = {}) {
	return function exportPPTXLegacy(
		content: StreamingExportContent,
		options: LegacyExportOptions = {},
	): LegacyExportHandle {
		const controller = new AbortController()
		const promise = runLegacyExport(content, options, controller.signal, runtime)
		return { promise, cancel: () => controller.abort() }
	}
}

export const exportPPTXLegacy = createPptxLegacyExporter()

async function runLegacyExport(
	content: StreamingExportContent,
	options: LegacyExportOptions,
	signal: AbortSignal,
	runtime: Html2PptxRuntime,
): Promise<LegacyExportSummary> {
	configureLogger({ minLevel: options.logLevel, logger: options.logger })
	const config = { ...DEFAULT_CONFIG, ...options.config }
	const fileName = ensureFileName(options.fileName ?? "export.pptx")
	const pageCount = getKnownPageCount(content)
	const sandbox = runtime.createSandbox
		? runtime.createSandbox(config)
		: new HtmlRenderSandbox(config, { ReadyController: runtime.sandboxReadyController })
	const rendered: RenderedLegacyPage[] = []

	const reportProgress = (progress: ExportProgress) => options.onProgress?.(progress)
	const reportIssue = (page: StreamingHtmlPage, error: unknown) => {
		const message = error instanceof Error ? error.message : String(error)
		options.onExportIssue?.({
			pageIndex: page.index,
			pageKey: page.key,
			pageName: page.pageName,
			pagePath: page.pagePath,
			pageFileId: page.pageFileId,
			code: "render-error",
			message,
			severity: "error",
		})
	}

	try {
		let successCount = 0
		for await (const page of normalizePages(content, signal)) {
			throwIfAborted(signal)
			reportProgress({ phase: "prepare-page", pageIndex: page.index, pageCount })
			try {
				const prepared = await (runtime.pipeline?.prepareSlideNodes ?? prepareSlideNodes)({
					config,
					html: page.html,
					sandbox,
					signal,
					pageIndex: page.index,
					pageKey: page.key,
					pageName: page.pageName,
					pagePath: page.pagePath,
					pageFileId: page.pageFileId,
					onResourceError: options.onResourceLoadError,
					onExportIssue: options.onExportIssue,
					runtime: runtime.pipeline,
				})
				if (options.autoSize && prepared.totalWidth > MAX_PPT_PAGE_PX) {
					throw new Error(
						`[exportPPTXLegacy] Page ${page.index + 1} width ${prepared.totalWidth}px exceeds PowerPoint's ${MAX_PPT_PAGE_PX}px limit.`,
					)
				}
				rendered.push({
					nodes: prepared.pptNodes,
					totalWidth: prepared.totalWidth,
					totalHeight: prepared.totalHeight,
					background: prepared.bodyBackground,
				})
				successCount += 1
				reportProgress({ phase: "render-page", pageIndex: page.index, pageCount })
			} catch (error) {
				if (signal.aborted) throw createAbortError()
				log(LogLevel.L4, `第 ${page.index + 1} 页兼容导出失败`, { error: String(error) })
				if (!options.skipFailedPages) throw error
				reportIssue(page, error)
				rendered.push({
					nodes: createFailedPagePlaceholder(config, page, error),
					totalWidth: config.htmlWidth,
					totalHeight: config.htmlHeight,
					background: null,
				})
			}
		}

		if (successCount === 0 && rendered.length === 0) {
			throw new Error("[exportPPTXLegacy] No pages were produced")
		}

		const finalConfig = options.autoSize ? buildAutoSizeConfig(config, rendered) : config
		const slides: PPTNode[][] = []
		const backgrounds: Array<string | null> = []
		for (const page of rendered) {
			const outputPages = options.autoSize
				? sliceByPageHeight({
						nodes: page.nodes,
						pageHeightInch: finalConfig.slideHeight,
						totalHeightInch: page.totalHeight / DEFAULT_DPI,
					})
				: [page.nodes]
			for (const outputPage of outputPages) {
				slides.push(outputPage)
				backgrounds.push(page.background)
			}
		}

		reportProgress({ phase: "package-page", pageCount: slides.length })
		const presentation = createPresentation(finalConfig)
		for (let index = 0; index < slides.length; index += 1) {
			throwIfAborted(signal)
			const slide = presentation.addSlide()
			const background = backgrounds[index]
			if (background) slide.background = { color: background }
			await materializeLegacyPptImageNodes(slides[index], signal, options.onResourceLoadError)
			for (const node of slides[index]) {
				throwIfAborted(signal)
				await drawByRegistry(slide, node as unknown as SerializablePPTNode, signal)
			}
		}

		reportProgress({ phase: "finalize", pageCount: slides.length })
		const chunks: ArrayBuffer[] = []
		const writable = new WritableStream<Uint8Array>({
			write(chunk) {
				const copy = new Uint8Array(chunk.byteLength)
				copy.set(chunk)
				chunks.push(copy.buffer)
			},
		})
		await presentation.writeTo({
			destination: writable,
			signal,
			useWebWorkers: false,
		})
		throwIfAborted(signal)
		const data = new Blob(chunks, { type: PPTX_MIME_TYPE })
		reportProgress({ phase: "completed", pageCount: slides.length, bytesWritten: data.size })
		return { data, fileName, pageCount: slides.length, bytesWritten: data.size }
	} finally {
		sandbox.destroy()
		if (options.logLevel || options.logger) resetLogger()
	}
}

async function* normalizePages(
	content: StreamingExportContent,
	signal: AbortSignal,
): AsyncIterable<StreamingHtmlPage> {
	if (typeof content === "string") {
		throwIfAborted(signal)
		yield { index: 0, html: content }
		return
	}
	let fallbackIndex = 0
	for await (const input of content as
		| Iterable<StreamingHtmlPageInput>
		| AsyncIterable<StreamingHtmlPageInput>) {
		throwIfAborted(signal)
		if (typeof input === "string") yield { index: fallbackIndex, html: input }
		else if (input && typeof input.html === "string") yield input
		else
			throw new TypeError(
				"[exportPPTXLegacy] Each page must be an HTML string or { index, html } object",
			)
		fallbackIndex += 1
	}
}

function getKnownPageCount(content: StreamingExportContent): number | undefined {
	if (typeof content === "string") return 1
	if (Array.isArray(content)) return content.length
	return undefined
}

function buildAutoSizeConfig(config: SlideConfig, pages: RenderedLegacyPage[]): SlideConfig {
	const width = Math.max(config.htmlWidth, ...pages.map((page) => page.totalWidth))
	return {
		htmlWidth: width,
		htmlHeight: config.htmlHeight,
		slideWidth: width / DEFAULT_DPI,
		slideHeight: config.slideHeight,
	}
}

function createFailedPagePlaceholder(
	config: SlideConfig,
	page: Pick<StreamingHtmlPage, "index" | "pageName" | "pagePath">,
	error: unknown,
): PPTNode[] {
	const pageLabel = page.pageName || page.pagePath || `Page ${page.index + 1}`
	const message = error instanceof Error ? error.message : String(error ?? "Unknown error")
	return [
		{
			type: "shape",
			x: 0,
			y: 0,
			w: config.slideWidth,
			h: config.slideHeight,
			zOrder: 0,
			shapeType: "rect",
			fill: { type: "solid", color: "FFF7ED" },
			line: null,
			shadow: null,
		},
		{
			type: "text",
			x: 0.6,
			y: 0.7,
			w: Math.max(config.slideWidth - 1.2, 1),
			h: Math.max(config.slideHeight - 1.4, 1),
			zOrder: 1,
			text: `PPTX export issue\n${pageLabel}\n\n${message.slice(0, 360)}`,
			fontSize: 18,
			fontFace: "Arial",
			fontWeight: 400,
			color: "9A3412",
			bold: false,
			italic: false,
			underline: false,
			align: "left",
			valign: "top",
			wrap: true,
			margin: [0, 0, 0, 0],
		},
	]
}
