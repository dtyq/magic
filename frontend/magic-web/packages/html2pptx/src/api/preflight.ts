import type {
	ExportPreflightResult,
	LargeExportOutputPolicy,
	MediaPolicy,
	PptxDestination,
	PreflightIssue,
	StagingPolicy,
} from "./options"

export interface PreflightOptions {
	destination?: PptxDestination
	outputPolicy?: LargeExportOutputPolicy
	pageCount?: number
	requiresOpfs?: boolean
	requiresSlidePlan?: boolean
	mediaPolicy?: MediaPolicy
	stagingPolicy?: StagingPolicy
	hasInjectedPackager?: boolean
	hasInjectedStagingStore?: boolean
	/** True when the caller explicitly provides an in-memory replay route. */
	hasInMemoryStagingStore?: boolean
}

/** Capability gate for the large-file path; no cumulative media-size limit is imposed. */
export function preflightPptxExport(options: PreflightOptions = {}): ExportPreflightResult {
	const warnings: PreflightIssue[] = []
	const errors: PreflightIssue[] = []
	const pageCount = normalizePageCount(options.pageCount)
	const outputPolicy = normalizeOutputPolicy(options.outputPolicy)
	const requiresOpfs =
		options.requiresOpfs === true ||
		options.stagingPolicy?.mode === "opfs" ||
		options.mediaPolicy?.mode === "rolling-stage" ||
		options.mediaPolicy?.mode === "full-stage"
	const requiresSlidePlan = options.requiresSlidePlan === true

	if (!options.destination) {
		errors.push({
			code: "destination-required",
			message: "Choose a save destination before starting a large export.",
			severity: "error",
		})
	}
	if (!options.hasInjectedPackager && typeof Worker === "undefined") {
		errors.push({
			code: "worker-unavailable",
			message: "A Packaging Worker is required for the browser streaming path.",
			severity: "error",
		})
	}
	if (
		requiresOpfs &&
		!options.hasInjectedStagingStore &&
		!options.hasInMemoryStagingStore &&
		!hasOpfs()
	) {
		errors.push({
			code: "opfs-unavailable",
			message:
				"This export requires Origin Private File System staging, which is unavailable here.",
			severity: "error",
			details: {
				capability: "opfs-staging",
				detection: "navigator.storage.getDirectory",
			},
		})
	}
	if (requiresSlidePlan && pageCount === undefined) {
		warnings.push({
			code: "page-count-unknown",
			message: "The lazy source will be staged before the final SlidePlan is created.",
			severity: "warning",
		})
	}
	const destinationSupported = isDestinationShapeSupported(options.destination)
	if (!destinationSupported) {
		errors.push({
			code: "invalid-destination",
			message:
				"The supplied destination is not a WritableStream or sink with write/close methods.",
			severity: "error",
		})
	}
	if (
		options.destination &&
		destinationSupported &&
		outputPolicy === "file-stream" &&
		!isDestinationAbortable(options.destination)
	) {
		errors.push({
			code: "destination-abort-required",
			message:
				"Large streaming destinations must provide abort() or destroy() so partial files can be discarded after cancellation or failure.",
			severity: "error",
		})
	}

	const knownMinimumOutputBytes = Math.max(4096, (pageCount ?? 1) * 1024)
	const estimatedZipEntries = BigInt((pageCount ?? 1) * 6 + 24)
	if (pageCount === undefined) {
		warnings.push({
			code: "unknown-output-size",
			message:
				"The final archive size is unknown until media sources are read; classic ZIP is selected for broad PowerPoint compatibility and the writer will stop before a ZIP32 overflow.",
			severity: "warning",
		})
	}
	const zipMode = estimatedZipEntries >= ZIP32_ENTRY_COUNT_SENTINEL ? "zip64" : "classic"

	return {
		accepted: errors.length === 0,
		outputPolicy,
		zipMode,
		capacityConfidence: "streaming-unknown",
		pageCount: pageCount ?? 0,
		knownMinimumOutputBytes,
		estimatedZipEntries,
		destinationCapacityKnown: false,
		centralDirectoryMode: "memory",
		requiresOpfs,
		requiresSlidePlan,
		warnings,
		errors,
	}
}

const ZIP32_ENTRY_COUNT_SENTINEL = BigInt("65535")

function normalizeOutputPolicy(
	policy: LargeExportOutputPolicy | undefined,
): Exclude<LargeExportOutputPolicy, "auto"> {
	if (policy && policy !== "file-stream") {
		throw new RangeError("Only the file-stream output policy is supported")
	}
	return "file-stream"
}

function normalizePageCount(value?: number): number | undefined {
	if (value === undefined) return undefined
	if (!Number.isSafeInteger(value) || value < 0) {
		throw new RangeError("pageCount must be a non-negative safe integer")
	}
	return value
}

function hasOpfs(): boolean {
	try {
		const storage = typeof navigator === "undefined" ? undefined : navigator.storage
		return (
			typeof (storage as (StorageManager & { getDirectory?: unknown }) | undefined)
				?.getDirectory === "function"
		)
	} catch {
		// Some restricted/private browser contexts expose navigator but reject access to storage.
		return false
	}
}

function isDestinationShapeSupported(destination?: PptxDestination): boolean {
	if (!destination) return false
	if (isWritableStreamShape(destination)) return true
	if (isOutputSinkShape(destination)) return true
	if (isNodeWritableShape(destination)) return true
	if (typeof destination !== "object" || destination === null || !("kind" in destination)) {
		return false
	}

	const wrapped = destination as {
		kind?: string
		writable?: unknown
		sink?: unknown
	}
	if (wrapped.kind === "sink-proxy") return isOutputSinkShape(wrapped.sink)
	if (wrapped.kind === "writable-stream" || wrapped.kind === "transferable-stream") {
		return isWritableStreamShape(wrapped.writable)
	}
	if (wrapped.kind === "node-writable") return isNodeWritableShape(wrapped.writable)
	return false
}

function isDestinationAbortable(destination: PptxDestination): boolean {
	if (isWritableStreamShape(destination)) {
		return typeof (destination as { abort?: unknown }).abort === "function"
	}
	if (typeof destination === "object" && destination !== null && "kind" in destination) {
		const wrapped = destination as {
			kind?: string
			writable?: unknown
			sink?: { abort?: unknown }
		}
		if (wrapped.kind === "sink-proxy") {
			return typeof wrapped.sink?.abort === "function"
		}
		if (wrapped.kind === "writable-stream" || wrapped.kind === "transferable-stream") {
			return (
				typeof (wrapped.writable as { abort?: unknown } | undefined)?.abort === "function"
			)
		}
		if (wrapped.kind === "node-writable") {
			return (
				typeof (wrapped.writable as { destroy?: unknown } | undefined)?.destroy ===
				"function"
			)
		}
	}
	if (isNodeWritableShape(destination)) {
		return typeof (destination as { destroy?: unknown }).destroy === "function"
	}
	if (isOutputSinkShape(destination)) {
		return typeof (destination as { abort?: unknown }).abort === "function"
	}
	return false
}

function isWritableStreamShape(value: unknown): value is WritableStream<Uint8Array> {
	return Boolean(value) && typeof (value as { getWriter?: unknown }).getWriter === "function"
}

function isOutputSinkShape(value: unknown): value is {
	write: (chunk: Uint8Array) => void | Promise<void>
	close: () => void | Promise<void>
} {
	return (
		Boolean(value) &&
		typeof (value as { write?: unknown }).write === "function" &&
		typeof (value as { close?: unknown }).close === "function"
	)
}

function isNodeWritableShape(value: unknown): value is NodeJS.WritableStream {
	return (
		Boolean(value) &&
		typeof (value as { write?: unknown }).write === "function" &&
		typeof (value as { end?: unknown }).end === "function" &&
		typeof (value as { on?: unknown }).on === "function"
	)
}
