import type { ExportHtmlToPdfOptions, ResolvedExportHtmlToPdfOptions } from "../api/options"
import { DEFAULT_DPI, DEFAULT_PAGE_CONFIG, MM_PER_INCH } from "./constants"

export function resolveExportHtmlToPdfOptions(
	options: ExportHtmlToPdfOptions,
): ResolvedExportHtmlToPdfOptions {
	const defaultConfig = DEFAULT_PAGE_CONFIG
	const pages = options.pages.filter((page) => typeof page === "string" && page.length > 0)
	if (!pages.length) {
		throw new Error("exportHtmlToPdf requires at least one non-empty HTML page")
	}

	return {
		pages,
		pagination: options.pagination ?? defaultConfig.pagination,
		fileName: ensurePdfFileName(options.fileName ?? "export.pdf"),
		viewport: {
			width: options.viewport?.width ?? defaultConfig.viewport.width,
			height: options.viewport?.height ?? defaultConfig.viewport.height,
		},
		paper: {
			widthMm: options.paper?.widthMm ?? defaultConfig.paper.widthMm,
			heightMm: options.paper?.heightMm ?? defaultConfig.paper.heightMm,
		},
		pixelRatio: options.pixelRatio ?? defaultConfig.pixelRatio,
		imageType: options.imageType ?? defaultConfig.imageType,
		imageQuality: options.imageQuality ?? defaultConfig.imageQuality,
		output: options.output ?? defaultConfig.output,
		onProgress: options.onProgress,
		logger: options.logger,
		logLevel: options.logLevel,
	}
}

export function ensurePdfFileName(fileName: string): string {
	return fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`
}

export function pxToMm(px: number): number {
	return (px / DEFAULT_DPI) * MM_PER_INCH
}
