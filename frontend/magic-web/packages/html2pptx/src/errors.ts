import type { ExportFailureCode, ExportFailureDiagnostic, ExportFailurePhase } from "./api/options"

export type ExportFidelityFailureKind = "script" | "render-timeout" | "capture" | "page-size"

/**
 * A fidelity failure means the current page may contain missing or incomplete content.
 * The page pipeline can turn it into a diagnostic placeholder when skipFailedPages is enabled;
 * the error remains marked as a fidelity error so the host can report it for repair. Errors from
 * the destination, packaging Worker, ZIP writer, or finalization are still terminal failures.
 */
export class ExportFidelityError extends Error {
	readonly code = "HTML2PPTX_FIDELITY_FAILURE"
	readonly fatal = true

	constructor(
		message: string,
		readonly kind: ExportFidelityFailureKind,
		readonly sourceError?: unknown,
		readonly targets: readonly string[] = [],
	) {
		super(message)
		this.name = "ExportFidelityError"
	}
}

export function isExportFidelityError(error: unknown): error is ExportFidelityError {
	if (error instanceof ExportFidelityError) return true
	if (!error || typeof error !== "object" || !("code" in error)) return false
	return (error as { code?: unknown }).code === "HTML2PPTX_FIDELITY_FAILURE"
}

/**
 * Error carrying a stable, privacy-safe export failure classification.
 *
 * Callers should use `diagnostic` for metrics instead of parsing error messages. The original
 * error is retained only as a non-enumerable reference so existing logging remains useful while
 * diagnostics never include page HTML or media payloads.
 */
export class PptxExportError extends Error {
	readonly name: "PptxExportError" | "AbortError"
	readonly code: ExportFailureCode
	readonly diagnostic: ExportFailureDiagnostic
	readonly fatal = true
	readonly sourceError?: unknown

	constructor(diagnostic: ExportFailureDiagnostic, sourceError?: unknown) {
		super(diagnostic.message)
		this.name = diagnostic.cancelled ? "AbortError" : "PptxExportError"
		this.code = diagnostic.code
		this.diagnostic = diagnostic
		Object.defineProperty(this, "sourceError", {
			value: sourceError,
			enumerable: false,
			configurable: false,
			writable: false,
		})
		if (sourceError instanceof Error && sourceError.stack) this.stack = sourceError.stack
	}
}

export function isPptxExportError(error: unknown): error is PptxExportError {
	return error instanceof PptxExportError
}

/**
 * Build a stable diagnostic when the two-pass pipeline cannot create its OPFS staging store.
 * Browser support can expose `navigator.storage.getDirectory()` while rejecting the actual
 * writable-file operation (for example in Safari/Firefox or a restricted/private context), so
 * this is intentionally separate from the generic worker failure classification.
 */
export function createOpfsUnavailableError(
	sourceError: unknown,
	details: Record<string, unknown> = {},
): PptxExportError {
	const causeName =
		sourceError && typeof sourceError === "object" && "name" in sourceError
			? String((sourceError as { name?: unknown }).name ?? "Error")
			: sourceError instanceof Error
				? sourceError.name
				: "Error"
	return new PptxExportError(
		{
			phase: "preflight",
			code: "opfs-unavailable",
			message:
				"Origin Private File System staging is unavailable in this browser or execution context.",
			recoverable: false,
			cancelled: false,
			details: {
				capability: "opfs-staging",
				causeName,
				...details,
			},
		},
		sourceError,
	)
}

/** Recognize OPFS capability failures after they cross a Worker boundary. */
export function isOpfsUnavailableError(error: unknown): boolean {
	if (isPptxExportError(error)) return error.code === "opfs-unavailable"
	if (!error || typeof error !== "object") return false
	const candidate = error as {
		code?: unknown
		causeCode?: unknown
		name?: unknown
		message?: unknown
	}
	if (
		candidate.code === "OPFS_WRITE_UNAVAILABLE" ||
		candidate.causeCode === "OPFS_WRITE_UNAVAILABLE"
	) {
		return true
	}
	if (
		candidate.name === "OpfsCapabilityError" ||
		candidate.name === "SlideManifestStagingUnavailableError"
	) {
		return true
	}
	const message = typeof candidate.message === "string" ? candidate.message : ""
	return /origin private file system|\bopfs\b|slide manifest staging requires/i.test(message)
}

export function getPptxExportDiagnostic(error: unknown): ExportFailureDiagnostic | undefined {
	if (isPptxExportError(error)) return error.diagnostic
	if (!error || typeof error !== "object") return undefined
	const diagnostic = (error as { diagnostic?: unknown }).diagnostic
	if (!diagnostic || typeof diagnostic !== "object") return undefined
	return diagnostic as ExportFailureDiagnostic
}

export interface PptxExportErrorContext {
	phase: ExportFailurePhase
	code?: ExportFailureCode
	fileName?: string
	pageIndex?: number
	pageCount?: number
	bytesWritten?: number
	outputPolicy?: ExportFailureDiagnostic["outputPolicy"]
	mediaPolicyMode?: ExportFailureDiagnostic["mediaPolicyMode"]
	zipMode?: ExportFailureDiagnostic["zipMode"]
	details?: Record<string, unknown>
}

/** Convert an arbitrary thrown value to a stable PptxExportError without losing its cause. */
export function normalizePptxExportError(
	error: unknown,
	context: PptxExportErrorContext,
): PptxExportError {
	if (isPptxExportError(error)) {
		const diagnostic = error.diagnostic
		const merged: ExportFailureDiagnostic = {
			...diagnostic,
			phase: diagnostic.phase ?? context.phase,
			fileName: diagnostic.fileName ?? context.fileName,
			pageIndex: diagnostic.pageIndex ?? context.pageIndex,
			pageCount: diagnostic.pageCount ?? context.pageCount,
			bytesWritten: diagnostic.bytesWritten ?? context.bytesWritten,
			outputPolicy: diagnostic.outputPolicy ?? context.outputPolicy,
			mediaPolicyMode: diagnostic.mediaPolicyMode ?? context.mediaPolicyMode,
			zipMode: diagnostic.zipMode ?? context.zipMode,
			details:
				context.details || diagnostic.details
					? { ...(context.details ?? {}), ...(diagnostic.details ?? {}) }
					: undefined,
		}
		if (
			diagnostic.phase === merged.phase &&
			diagnostic.fileName === merged.fileName &&
			diagnostic.pageIndex === merged.pageIndex &&
			diagnostic.pageCount === merged.pageCount &&
			diagnostic.bytesWritten === merged.bytesWritten &&
			diagnostic.outputPolicy === merged.outputPolicy &&
			diagnostic.mediaPolicyMode === merged.mediaPolicyMode &&
			diagnostic.zipMode === merged.zipMode &&
			diagnostic.details === merged.details
		) {
			return error
		}
		return new PptxExportError(merged, error.sourceError ?? error)
	}
	const cancelled = isAbortLike(error)
	const code = context.code ?? inferFailureCode(context.phase, cancelled)
	const message = error instanceof Error ? error.message : String(error ?? "Unknown export error")
	return new PptxExportError(
		{
			phase: context.phase,
			code,
			message,
			recoverable: false,
			cancelled,
			fileName: context.fileName,
			pageIndex: context.pageIndex,
			pageCount: context.pageCount,
			bytesWritten: context.bytesWritten,
			outputPolicy: context.outputPolicy,
			mediaPolicyMode: context.mediaPolicyMode,
			zipMode: context.zipMode,
			details: context.details,
		},
		error,
	)
}

function inferFailureCode(phase: ExportFailurePhase, cancelled: boolean): ExportFailureCode {
	if (cancelled) return "cancelled"
	switch (phase) {
		case "preflight":
			return "preflight-rejected"
		case "source":
			return "source-failed"
		case "prepare-page":
			return "prepare-page-failed"
		case "render-page":
			return "render-page-failed"
		case "media-fetch":
			return "media-fetch-failed"
		case "transform-media":
			return "media-transform-failed"
		case "stage-media":
			return "media-fetch-failed"
		case "package-page":
			return "package-page-failed"
		case "worker":
			return "worker-failed"
		case "sink-write":
			return "sink-write-failed"
		case "finalize":
			return "finalize-failed"
		case "cleanup":
			return "cleanup-failed"
		default:
			return "unknown"
	}
}

function isAbortLike(error: unknown): boolean {
	return (
		(typeof DOMException !== "undefined" &&
			error instanceof DOMException &&
			error.name === "AbortError") ||
		(typeof error === "object" &&
			error !== null &&
			"name" in error &&
			(error as { name?: unknown }).name === "AbortError")
	)
}
