import type { ExternalLogger, LogLevelLabel } from "../logger"

export type PdfPaginationMode = "slice" | "none"
export type PdfOutputType = "download" | "blob"
export type PdfImageType = "png" | "jpeg"
export type PdfProgressPhase =
	| "parse"
	| "preprocess"
	| "render"
	| "capture"
	| "assemble"

export interface PdfProgressContext {
	phase: PdfProgressPhase
	current: number
	total: number
}

export interface ExportHtmlToPdfOptions {
	pages: string[]
	pagination?: PdfPaginationMode
	fileName?: string
	viewport?: {
		width: number
		height: number
	}
	paper?: {
		widthMm: number
		heightMm: number
	}
	pixelRatio?: number
	imageType?: PdfImageType
	imageQuality?: number
	output?: PdfOutputType
	onProgress?: (ctx: PdfProgressContext) => void
	logger?: ExternalLogger
	logLevel?: LogLevelLabel
}

export interface ResolvedExportHtmlToPdfOptions {
	pages: string[]
	pagination: PdfPaginationMode
	fileName: string
	viewport: {
		width: number
		height: number
	}
	paper: {
		widthMm: number
		heightMm: number
	}
	pixelRatio: number
	imageType: PdfImageType
	imageQuality: number
	output: PdfOutputType
	onProgress?: (ctx: PdfProgressContext) => void
	logger?: ExternalLogger
	logLevel?: LogLevelLabel
}

export interface ExportHandle {
	promise: Promise<Blob | void>
	cancel: () => void
}

/** Internal DOM element export options used by non-HTML export routes. */
export interface ExportElementToPdfOptions {
	fileName?: string
	pixelRatio?: number
	imageType?: PdfImageType
	imageQuality?: number
	output?: PdfOutputType
	pagination?: PdfPaginationMode
	paper?: {
		widthMm: number
		heightMm: number
	}
	onProgress?: (ctx: PdfProgressContext) => void
	logger?: ExternalLogger
	logLevel?: LogLevelLabel
}
