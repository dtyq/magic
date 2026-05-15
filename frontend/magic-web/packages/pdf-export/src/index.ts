import type { ExportHandle, ExportHtmlToPdfOptions } from "./api/options"
import { configureLogger } from "./logger"
import { runHtmlExportPipeline } from "./pipeline/exportHtmlToPdf"
export { exportHtmlToImage } from "./pipeline/exportHtmlToImage"
export type { ExportHtmlToImageOptions, ExportImageHandle, ImageExportFormat } from "./pipeline/exportHtmlToImage"

export function exportHtmlToPdf(options: ExportHtmlToPdfOptions): ExportHandle {
	const controller = new AbortController()
	const promise = (async (): Promise<Blob | void> => {
		configureLogger({
			minLevel: options?.logLevel,
			logger: options?.logger,
		})
		return runHtmlExportPipeline(options, controller.signal)
	})()
	return { promise, cancel: () => controller.abort() }
}

export type {
	ExportHtmlToPdfOptions,
	ExportHandle,
	PdfImageType,
	PdfOutputType,
	PdfPaginationMode,
	PdfProgressContext,
	PdfProgressPhase,
	ResolvedExportHtmlToPdfOptions,
} from "./api"
export {
	DEFAULT_PAGE_CONFIG,
} from "./shared/constants"
export {
	LogLevel,
	type ExternalLogger,
	type LoggerOptions,
	type LogFn,
	type LogLevelLabel,
	type LogLevelValue,
} from "./logger"
