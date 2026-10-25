import type { PPTImageNode } from "../ir/node"
import type { MediaSourceDescriptor } from "./source-descriptor"

export type ImagePreflightAction = "passthrough" | "transform" | "reject"

/** What the streaming runner should do when the descriptor-only policy rejects an image. */
export type ImagePreflightRejectAction = "error" | "omit"

export type ImagePreflightReason =
	| "compatible-source"
	| "dimensions-unknown"
	| "encoded-byte-limit-exceeded"
	| "pixel-limit-exceeded"
	| "dimension-limit-exceeded"
	| "unsupported-content-type"

export interface ImagePreflightPolicy {
	/** Optional encoded-byte budget. Large streamable originals normally leave this unset. */
	maxEncodedBytes?: number
	/** Optional decoded-pixel budget used to protect low-memory devices. */
	maxPixels?: number
	/** Optional per-axis decoded dimension budget. */
	maxDimension?: number
	/** Formats that can be forwarded without decoding or re-encoding. */
	passthroughContentTypes?: readonly string[]
	/** Decision when the intrinsic source dimensions are unavailable. */
	unknownDimensionsAction?: ImagePreflightAction
	/** Decision when an encoded-byte or decoded-pixel budget is exceeded. */
	oversizedAction?: ImagePreflightAction
	/** Decision for a source format that is not in passthroughContentTypes. */
	unsupportedFormatAction?: ImagePreflightAction
}

/**
 * Public image policy used by large exports.
 *
 * The policy is deliberately metadata-only: the runner can decide whether an image is safe to
 * forward before opening its Blob/URL/OPFS payload. `rejectAction` makes a rejected image's
 * behavior explicit instead of silently dropping it.
 */
export interface ImagePolicy extends ImagePreflightPolicy {
	rejectAction?: ImagePreflightRejectAction
}

export interface ImagePreflightDecision {
	action: ImagePreflightAction
	reason: ImagePreflightReason
	contentType: string
	encodedBytes?: number
	width?: number
	height?: number
	pixelCount?: number
}

/** Context supplied to a host transform implementation after preflight requests conversion. */
export interface ImageTransformDescriptorInput {
	source: MediaSourceDescriptor
	intrinsicSize?: { width: number; height: number }
	decision: ImagePreflightDecision
	/** Stable business identity, when one was present on the image node. */
	assetKey?: string
	sizing: "cover" | "contain" | "crop" | "stretch"
	signal: AbortSignal
}

/** A transform may replace only the descriptor or also provide corrected intrinsic dimensions. */
export type ImageTransformDescriptorResult =
	| MediaSourceDescriptor
	| {
			source: MediaSourceDescriptor
			intrinsicSize?: { width: number; height: number }
	  }

/**
 * Optional host hook for image conversion. It is intentionally small and runs only when the
 * descriptor-only preflight returns `transform`; no hook means that decision is a structured
 * export failure rather than an implicit payload read/decode.
 */
export type ImageTransformDescriptor = (
	input: ImageTransformDescriptorInput,
) => ImageTransformDescriptorResult | Promise<ImageTransformDescriptorResult>

/**
 * Whether applying this policy can require a second pass over the page IR.
 *
 * Hosts that resolve media staging before invoking the runner should use the same predicate as
 * the pipeline. A policy that only ever forwards descriptors can stay on the direct path;
 * transform/reject decisions need replay so failures are reported before media is committed.
 */
export function imagePolicyRequiresReplay(policy: ImagePolicy | undefined): boolean {
	if (!policy) return false
	if (policy.unknownDimensionsAction && policy.unknownDimensionsAction !== "passthrough") {
		return true
	}
	if (policy.unsupportedFormatAction && policy.unsupportedFormatAction !== "passthrough") {
		return true
	}
	if (
		(policy.maxEncodedBytes !== undefined ||
			policy.maxPixels !== undefined ||
			policy.maxDimension !== undefined) &&
		(policy.oversizedAction ?? "transform") !== "passthrough"
	) {
		return true
	}
	if (
		policy.passthroughContentTypes !== undefined &&
		(policy.unsupportedFormatAction ?? "transform") !== "passthrough"
	) {
		return true
	}
	return false
}

const DEFAULT_PASSTHROUGH_CONTENT_TYPES = Object.freeze([
	"image/gif",
	"image/jpeg",
	"image/png",
	"image/svg+xml",
	"image/webp",
])

/**
 * Decide whether an image can stay on the zero-copy path using descriptor and
 * DOM metadata only. This function never opens, reads, decodes, or hashes the
 * image payload, so multi-GB originals do not create a second in-memory copy.
 */
export function preflightPptImage(
	input: Pick<PPTImageNode, "intrinsicSize" | "source"> & {
		source?: MediaSourceDescriptor
	},
	policy: ImagePreflightPolicy = {},
): ImagePreflightDecision {
	validatePolicy(policy)
	const source = input.source
	const contentType = normalizeContentType(source?.contentType)
	const encodedBytes = descriptorSize(source)
	const dimensions = normalizeDimensions(input.intrinsicSize)
	const passthroughContentTypes = new Set(
		(policy.passthroughContentTypes ?? DEFAULT_PASSTHROUGH_CONTENT_TYPES).map(
			normalizeContentType,
		),
	)

	if (!passthroughContentTypes.has(contentType)) {
		return decision(
			policy.unsupportedFormatAction ?? "transform",
			"unsupported-content-type",
			contentType,
			encodedBytes,
			dimensions,
		)
	}

	if (policy.maxEncodedBytes !== undefined && encodedBytes !== undefined) {
		if (encodedBytes > policy.maxEncodedBytes) {
			return decision(
				policy.oversizedAction ?? "passthrough",
				"encoded-byte-limit-exceeded",
				contentType,
				encodedBytes,
				dimensions,
			)
		}
	}

	if (!dimensions) {
		return decision(
			policy.unknownDimensionsAction ?? "passthrough",
			"dimensions-unknown",
			contentType,
			encodedBytes,
		)
	}

	if (
		policy.maxDimension !== undefined &&
		(dimensions.width > policy.maxDimension || dimensions.height > policy.maxDimension)
	) {
		return decision(
			policy.oversizedAction ?? "transform",
			"dimension-limit-exceeded",
			contentType,
			encodedBytes,
			dimensions,
		)
	}

	if (policy.maxPixels !== undefined && dimensions.pixelCount > policy.maxPixels) {
		return decision(
			policy.oversizedAction ?? "transform",
			"pixel-limit-exceeded",
			contentType,
			encodedBytes,
			dimensions,
		)
	}

	return decision("passthrough", "compatible-source", contentType, encodedBytes, dimensions)
}

function decision(
	action: ImagePreflightAction,
	reason: ImagePreflightReason,
	contentType: string,
	encodedBytes?: number,
	dimensions?: { width: number; height: number; pixelCount: number },
): ImagePreflightDecision {
	return {
		action,
		reason,
		contentType,
		...(encodedBytes === undefined ? {} : { encodedBytes }),
		...(dimensions ?? {}),
	}
}

function descriptorSize(source?: MediaSourceDescriptor): number | undefined {
	if (!source) return undefined
	if (source.kind === "bytes") return source.data.byteLength
	return source.size
}

function normalizeDimensions(
	dimensions?: PPTImageNode["intrinsicSize"],
): { width: number; height: number; pixelCount: number } | undefined {
	if (!dimensions) return undefined
	const { width, height } = dimensions
	if (
		!Number.isSafeInteger(width) ||
		width <= 0 ||
		!Number.isSafeInteger(height) ||
		height <= 0
	) {
		return undefined
	}
	const pixelCount = width * height
	if (!Number.isSafeInteger(pixelCount)) return undefined
	return { width, height, pixelCount }
}

function normalizeContentType(value?: string): string {
	return value?.split(";", 1)[0].trim().toLowerCase() || "application/octet-stream"
}

function validatePolicy(policy: ImagePreflightPolicy): void {
	for (const [name, value] of [
		["maxEncodedBytes", policy.maxEncodedBytes],
		["maxPixels", policy.maxPixels],
		["maxDimension", policy.maxDimension],
	] as const) {
		if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0)) {
			throw new RangeError(`${name} must be a positive safe integer`)
		}
	}
}
