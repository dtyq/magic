import type { LargeExportOutputPolicy, MediaPolicy } from "@magic/html2pptx"

/** Emergency/local override key. Remote configuration can populate the same shape on window. */
export const PPTX_EXPORT_FLAGS_STORAGE_KEY = "magic:pptx-export-flags"

/**
 * Routing switches kept outside the renderer so a rollout can be stopped without changing the
 * export call sites. These are routing controls, not cumulative file-size limits.
 */
export interface PptxExportFeatureFlags {
	/** Enables the File System Access/streaming sink route. */
	streamingOutputSink: boolean
	/** Indicates that the active package writer is the zip.js writer. */
	zipJsPackageWriter: boolean
	/** Allows archives that may cross ZIP32 boundaries. */
	zip64: boolean
}

export const DEFAULT_PPTX_EXPORT_FEATURE_FLAGS: Readonly<PptxExportFeatureFlags> = {
	streamingOutputSink: true,
	zipJsPackageWriter: true,
	zip64: true,
}

/** ZIP capability threshold used to decide whether the streaming writer must use ZIP64. */
export const PPTX_EXPORT_ROUTING_LIMITS = {
	zip32MaxBytes: 4 * 1024 * 1024 * 1024,
} as const

export type PptxMediaSourceReliability = "local" | "stable-url" | "signed-url" | "unknown"

export type PptxExportRoute = "streaming" | "legacy-blob" | "unavailable"
export type PptxExportStrategyReasonCode =
	| "streaming"
	| "legacy-blob"
	| "streaming-disabled"
	| "zipjs-disabled"
	| "zip64-disabled"
	| "file-stream-unavailable"

export type ResolvedPptxMediaPolicyMode = Exclude<NonNullable<MediaPolicy["mode"]>, "auto">

export interface PptxExportStrategyInput {
	pageCount?: number
	estimatedBytes?: number | bigint
	largestMediaBytes?: number | bigint
	hasLargeMedia?: boolean
	/** Used to decide whether the current URL must be staged before a second pass. */
	mediaSource?: PptxMediaSourceReliability
	requestedMediaPolicy?: MediaPolicy["mode"]
	requiresReplay?: boolean
	outputPolicy?: LargeExportOutputPolicy
	fileStreamingAvailable?: boolean
	flags?: Partial<PptxExportFeatureFlags>
	/** Whether the host can create a Blob and trigger a normal browser download. */
	bufferedDownloadAvailable?: boolean
}

export interface PptxExportStrategyDecision {
	route: PptxExportRoute
	reasonCode: PptxExportStrategyReasonCode
	reason: string
	isLargeExport: boolean
	requiresZip64: boolean
	mediaPolicyMode: ResolvedPptxMediaPolicyMode
	fileStreamingAvailable: boolean
	featureFlags: PptxExportFeatureFlags
	bufferedDownloadAvailable: boolean
}

/**
 * Resolve a media policy before the runner starts reading pages.
 *
 * `auto` is deliberately conservative for replayed/expiring sources: it selects rolling-stage.
 * A stable local source can remain direct-streamed and therefore does not consume OPFS space.
 */
export function resolvePptxMediaPolicyMode(
	options: {
		requested?: MediaPolicy["mode"]
		mediaSource?: PptxMediaSourceReliability
		requiresReplay?: boolean
	} = {},
): ResolvedPptxMediaPolicyMode {
	if (options.requested && options.requested !== "auto") return options.requested
	if (options.requiresReplay || options.mediaSource === "signed-url") return "rolling-stage"
	if (options.mediaSource === "unknown") return "rolling-stage"
	return "direct-stream"
}

/** Read defaults plus safe runtime/local overrides without throwing in SSR or private mode. */
export function resolvePptxExportFeatureFlags(
	overrides?: Partial<PptxExportFeatureFlags>,
): PptxExportFeatureFlags {
	const runtime = readRuntimeFeatureFlags()
	const stored = readStoredFeatureFlags()
	return {
		...DEFAULT_PPTX_EXPORT_FEATURE_FLAGS,
		...stored,
		...runtime,
		...overrides,
	}
}

/**
 * Decide whether an export may use the new streaming path.
 *
 * When File System Access is unavailable, supported browsers use the independent legacy Blob
 * exporter instead of entering the streaming/OPFS pipeline.
 */
export function resolvePptxExportStrategy(
	input: PptxExportStrategyInput = {},
): PptxExportStrategyDecision {
	const featureFlags = resolvePptxExportFeatureFlags(input.flags)
	const fileStreamingAvailable = input.fileStreamingAvailable ?? detectFileStreamingCapability()
	const bufferedDownloadAvailable =
		input.bufferedDownloadAvailable ?? detectBufferedDownloadCapability()
	const isLargeExport =
		input.hasLargeMedia === true ||
		isAtLeastZip32(input.estimatedBytes) ||
		isAtLeastZip32(input.largestMediaBytes)
	const requiresZip64 = isLargeExport
	const mediaPolicyMode = resolvePptxMediaPolicyMode({
		requested: input.requestedMediaPolicy,
		mediaSource: input.mediaSource,
		requiresReplay: input.requiresReplay ?? isLargeExport,
	})

	if (!featureFlags.streamingOutputSink) {
		return unavailableDecision(
			"streaming-disabled",
			"Streaming PPTX output is disabled by the active feature flag.",
			isLargeExport,
			requiresZip64,
			mediaPolicyMode,
			fileStreamingAvailable,
			featureFlags,
			bufferedDownloadAvailable,
		)
	}
	if (!featureFlags.zipJsPackageWriter) {
		return unavailableDecision(
			"zipjs-disabled",
			"The streaming package writer is disabled by the active feature flag.",
			isLargeExport,
			requiresZip64,
			mediaPolicyMode,
			fileStreamingAvailable,
			featureFlags,
			bufferedDownloadAvailable,
		)
	}
	if (requiresZip64 && !featureFlags.zip64) {
		return unavailableDecision(
			"zip64-disabled",
			"ZIP64 is disabled, so this export cannot safely use the large-file path.",
			isLargeExport,
			requiresZip64,
			mediaPolicyMode,
			fileStreamingAvailable,
			featureFlags,
			bufferedDownloadAvailable,
		)
	}
	if (!fileStreamingAvailable) {
		if (bufferedDownloadAvailable) {
			return createDecision({
				route: "legacy-blob",
				reasonCode: "legacy-blob",
				reason: "This browser uses the compatibility Blob exporter for PPTX export.",
				isLargeExport,
				requiresZip64,
				mediaPolicyMode,
				fileStreamingAvailable,
				featureFlags,
				bufferedDownloadAvailable,
			})
		}
		return unavailableDecision(
			"file-stream-unavailable",
			"This browser cannot provide a writable file destination or a client-side download for PPTX.",
			isLargeExport,
			requiresZip64,
			mediaPolicyMode,
			fileStreamingAvailable,
			featureFlags,
			bufferedDownloadAvailable,
		)
	}

	return createDecision({
		route: "streaming",
		reasonCode: "streaming",
		reason: "The large PPTX export is routed to the streaming sink.",
		isLargeExport,
		requiresZip64,
		mediaPolicyMode,
		fileStreamingAvailable,
		featureFlags,
		bufferedDownloadAvailable,
	})
}

function unavailableDecision(
	reasonCode: Exclude<PptxExportStrategyReasonCode, "streaming" | "legacy-blob">,
	reason: string,
	isLargeExport: boolean,
	requiresZip64: boolean,
	mediaPolicyMode: ResolvedPptxMediaPolicyMode,
	fileStreamingAvailable: boolean,
	featureFlags: PptxExportFeatureFlags,
	bufferedDownloadAvailable: boolean,
): PptxExportStrategyDecision {
	return createDecision({
		route: "unavailable",
		reasonCode,
		reason,
		isLargeExport,
		requiresZip64,
		mediaPolicyMode,
		fileStreamingAvailable,
		featureFlags,
		bufferedDownloadAvailable,
	})
}

function createDecision(
	decision: Omit<PptxExportStrategyDecision, "featureFlags"> & {
		featureFlags: PptxExportFeatureFlags
	},
): PptxExportStrategyDecision {
	return decision
}

function isAtLeastZip32(value?: number | bigint): boolean {
	if (typeof value === "bigint") {
		return value >= BigInt(PPTX_EXPORT_ROUTING_LIMITS.zip32MaxBytes)
	}
	return (
		typeof value === "number" &&
		Number.isFinite(value) &&
		value >= PPTX_EXPORT_ROUTING_LIMITS.zip32MaxBytes
	)
}

function detectFileStreamingCapability(): boolean {
	return typeof (globalThis as { showSaveFilePicker?: unknown }).showSaveFilePicker === "function"
}

function detectBufferedDownloadCapability(): boolean {
	return (
		typeof Blob === "function" &&
		typeof URL !== "undefined" &&
		typeof URL.createObjectURL === "function" &&
		typeof document !== "undefined" &&
		typeof document.createElement === "function"
	)
}

function readRuntimeFeatureFlags(): Partial<PptxExportFeatureFlags> {
	const value = (globalThis as { __MAGIC_PPTX_EXPORT_FLAGS__?: unknown })
		.__MAGIC_PPTX_EXPORT_FLAGS__
	return sanitizeFlags(value)
}

function readStoredFeatureFlags(): Partial<PptxExportFeatureFlags> {
	try {
		if (typeof localStorage === "undefined") return {}
		return sanitizeFlags(
			JSON.parse(localStorage.getItem(PPTX_EXPORT_FLAGS_STORAGE_KEY) || "null"),
		)
	} catch {
		return {}
	}
}

function sanitizeFlags(value: unknown): Partial<PptxExportFeatureFlags> {
	if (!value || typeof value !== "object") return {}
	const source = value as Record<string, unknown>
	const flags: Partial<PptxExportFeatureFlags> = {}
	for (const key of ["streamingOutputSink", "zipJsPackageWriter", "zip64"] as const) {
		if (typeof source[key] === "boolean") flags[key] = source[key]
	}
	return flags
}
