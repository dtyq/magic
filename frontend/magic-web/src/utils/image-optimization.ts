import {
	buildFormatProcess,
	buildQualityProcess,
	buildResizeProcess,
	combineProcesses,
} from "./tos-image"

export type ImageVariant = "thumbnail" | "preview" | "original"

export interface ImageOptimizationOptions {
	variant: ImageVariant
	width?: number
	height?: number
	dpr?: number
	/** Defaults to WebP; original keeps the source format while still allowing resize. */
	format?: "webp" | "original"
	quality?: number
}

const DEFAULT_DPR = 2
const DEFAULT_QUALITY = 85
const MAX_DIMENSION_BY_VARIANT: Record<Exclude<ImageVariant, "original">, number> = {
	thumbnail: 2048,
	preview: 4096,
}

function scaleDimension(
	value: number | undefined,
	dpr: number,
	maxDimension: number,
): number | undefined {
	if (value === undefined || !Number.isFinite(value) || value <= 0) return undefined
	return Math.min(maxDimension, Math.max(1, Math.round(value * dpr)))
}

function getProcessDimensions(options: ImageOptimizationOptions) {
	const dpr =
		typeof options.dpr === "number" && Number.isFinite(options.dpr) && options.dpr > 0
			? options.dpr
			: DEFAULT_DPR

	const maxDimension =
		options.variant === "original"
			? Number.MAX_SAFE_INTEGER
			: MAX_DIMENSION_BY_VARIANT[options.variant]

	return {
		width: scaleDimension(options.width, dpr, maxDimension),
		height: scaleDimension(options.height, dpr, maxDimension),
	}
}

function buildImageProcess(options: ImageOptimizationOptions): string | null {
	const { width, height } = getProcessDimensions(options)
	if (width === undefined && height === undefined) return null

	try {
		return combineProcesses([
			buildResizeProcess({ w: width, h: height }),
			options.format === "original" ? null : buildFormatProcess({ format: "webp" }),
			buildQualityProcess({ Q: options.quality ?? DEFAULT_QUALITY }),
		])
	} catch {
		// Image optimization is best effort; invalid provider parameters must never block the
		// original image from rendering.
		return null
	}
}

function appendQueryParameter(imageUrl: string, key: string, value: string): string {
	try {
		const url = new URL(imageUrl)
		url.searchParams.set(key, value)
		return url.toString()
	} catch {
		return imageUrl
	}
}

function appendDingTalkSize(imageUrl: string, width: number, height: number): string {
	try {
		const url = new URL(imageUrl)
		const path = url.pathname
		// DingTalk's resize marker is appended to the complete media filename,
		// including files that already contain an `_originalWidth_originalHeight`
		// suffix. Replacing that suffix produces a different media key and commonly
		// returns 404, which makes AvatarImage render its text fallback.
		if (/@\d+w_\d+h$/.test(path)) {
			url.pathname = path.replace(/@\d+w_\d+h$/, `@${width}w_${height}h`)
		} else if (/@\d+w_\d+h(\.[^./]+)$/.test(path)) {
			// Normalize the intermediate form produced by older clients
			// (`avatar@1290w_1290h.jpg`) to DingTalk's suffix form.
			url.pathname = path.replace(/@\d+w_\d+h(\.[^./]+)$/, `$1@${width}w_${height}h`)
		} else {
			url.pathname = `${path}@${width}w_${height}h`
		}
		return url.toString()
	} catch {
		return imageUrl
	}
}

/**
 * Builds a provider-specific image variant without changing download/original paths.
 * The URL API keeps existing query parameters, hashes, and signed URLs intact.
 */
export function getOptimizedImageUrl(imageUrl: string, options: ImageOptimizationOptions): string {
	if (!imageUrl || options.variant === "original") {
		return imageUrl
	}
	let url: URL
	try {
		url = new URL(imageUrl)
	} catch {
		return imageUrl
	}
	if (!/^https?:$/.test(url.protocol)) return imageUrl
	// Changing either the path or a signed query may invalidate provider authorization.
	if (
		[...url.searchParams.keys()].some((key) =>
			/signature|credential|security-token|accesskeyid|^expires$|^x-tos-date$|^x-tos-expires$/i.test(
				key,
			),
		)
	)
		return imageUrl

	const { width, height } = getProcessDimensions(options)
	const targetWidth = width ?? height
	const targetHeight = height ?? width
	if (targetWidth === undefined || targetHeight === undefined) return imageUrl

	if (url.hostname === "static-legacy.dingtalk.com") {
		return appendDingTalkSize(imageUrl, targetWidth, targetHeight)
	}

	const process = buildImageProcess(options)
	if (!process) return imageUrl

	// Resize-only thumbnail URLs can be safely re-targeted. Preserve richer crop/watermark
	// pipelines because replacing those commands could change the image's meaning.
	for (const key of ["x-tos-process", "x-oss-process"]) {
		const existing = url.searchParams.get(key)
		if (existing && !/^image(?:\/(?:resize|format|quality),[^/]+)+$/.test(existing))
			return imageUrl
	}
	if (
		/(^|\.)tos-[a-z0-9-]+\.volces\.com$/.test(url.hostname) ||
		/(^|\.)tos\.volces\.com$/.test(url.hostname)
	) {
		return appendQueryParameter(imageUrl, "x-tos-process", process)
	}

	if (/(^|\.)oss-[a-z0-9-]+\.aliyuncs\.com$/.test(url.hostname)) {
		return appendQueryParameter(imageUrl, "x-oss-process", process)
	}

	return imageUrl
}
