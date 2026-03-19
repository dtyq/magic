/**
 * TOS image processing utilities
 * Returns x-tos-process parameter values for image transformation
 */

/**
 * Image resize mode
 */
export type ResizeMode = "lfit" | "mfit" | "fill" | "pad" | "fixed"

/**
 * Supported image formats for format conversion
 * Only jpg/jpeg, png, bmp, gif, webp, tiff and heic formats are supported
 */
export type ImageFormat = "jpg" | "jpeg" | "png" | "webp" | "bmp" | "gif" | "tiff"

/**
 * Quality transformation options
 */
export interface QualityOptions {
	/**
	 * Relative quality: compress image to q% of original quality
	 * Only effective for pjpeg, jpg/jpeg formats
	 * Range: [1, 100]
	 */
	q?: number
	/**
	 * Absolute quality: compress image directly to Q%
	 * Effective for webp, pjpeg, jpg/jpeg, jpeg-2000, avif, heic formats
	 * Range: [1, 100]
	 * If both q and Q are provided, Q takes precedence
	 */
	Q?: number
}

/**
 * Format conversion options
 */
export interface FormatOptions {
	/**
	 * Target image format
	 * - jpg/jpeg: Save as jpg/jpeg format. If original has transparency (png, webp, bmp), transparent areas will be filled with white by default
	 * - png: Save as png format
	 * - webp: Save as webp format
	 * - bmp: Save as bmp format
	 * - gif: Save as gif format. If original is gif, remains gif. If original is not gif, saves in original format
	 * - tiff: Save as tiff format
	 */
	format: ImageFormat
}

/**
 * Resize transformation options
 */
export interface ResizeOptions {
	/**
	 * Resize mode
	 * - lfit: scale to fit within rectangle (default)
	 * - mfit: scale to cover rectangle
	 * - fill: scale and crop to fill rectangle
	 * - pad: scale and pad with color
	 * - fixed: force fixed width and height
	 */
	m?: ResizeMode
	/**
	 * Target width [1, 16384]
	 */
	w?: number
	/**
	 * Target height [1, 16384]
	 */
	h?: number
	/**
	 * Target long side [1, 16384]
	 */
	l?: number
	/**
	 * Target short side [1, 16384]
	 */
	s?: number
	/**
	 * Scale percentage [1, 1000]
	 * Less than 100 for shrink, greater than 100 for enlarge
	 */
	p?: number
	/**
	 * Whether to scale when target is larger than original
	 * - 1 (default): don't scale, return original
	 * - 0: scale according to parameters
	 */
	limit?: 0 | 1
	/**
	 * Fill color for pad mode (hex color code, default: FFFFFF)
	 */
	color?: string
}

/**
 * Build quality transformation parameter string
 * @param options Quality transformation options
 * @returns Parameter string, e.g., "quality,q_60" or "quality,Q_80"
 */
export function buildQualityProcess(options: QualityOptions): string | null {
	const { q, Q } = options

	// Q parameter takes precedence if both are provided
	if (Q !== undefined) {
		if (Q < 1 || Q > 100) {
			throw new Error("Q parameter must be between 1 and 100")
		}
		return `quality,Q_${Q}`
	}

	if (q !== undefined) {
		if (q < 1 || q > 100) {
			throw new Error("q parameter must be between 1 and 100")
		}
		return `quality,q_${q}`
	}

	return null
}

/**
 * Build format conversion parameter string
 * @param options Format conversion options
 * @returns Parameter string, e.g., "format,jpg" or "format,png"
 */
export function buildFormatProcess(options: FormatOptions): string {
	const { format } = options

	// Normalize jpeg to jpg
	const normalizedFormat = format.toLowerCase() === "jpeg" ? "jpg" : format.toLowerCase()

	// Validate format
	const validFormats: ImageFormat[] = ["jpg", "jpeg", "png", "webp", "bmp", "gif", "tiff"]
	if (!validFormats.includes(normalizedFormat as ImageFormat)) {
		throw new Error(
			`Unsupported format: ${format}. Supported formats: jpg, jpeg, png, webp, bmp, gif, tiff`,
		)
	}

	return `format,${normalizedFormat}`
}

/**
 * Build resize transformation parameter string
 * @param options Resize transformation options
 * @returns Parameter string, e.g., "resize,w_100,h_100,m_lfit"
 */
export function buildResizeProcess(options: ResizeOptions): string | null {
	const { m, w, h, l, s, p, limit, color } = options

	// Check if at least one required parameter is provided
	const hasRequiredParam =
		w !== undefined || h !== undefined || l !== undefined || s !== undefined || p !== undefined
	if (!hasRequiredParam) {
		return null
	}

	const params: string[] = []

	// Add mode
	if (m) {
		params.push(`m_${m}`)
	}

	// Add width
	if (w !== undefined) {
		if (w < 1 || w > 16384) {
			throw new Error("w parameter must be between 1 and 16384")
		}
		params.push(`w_${w}`)
	}

	// Add height
	if (h !== undefined) {
		if (h < 1 || h > 16384) {
			throw new Error("h parameter must be between 1 and 16384")
		}
		params.push(`h_${h}`)
	}

	// Add long side
	if (l !== undefined) {
		if (l < 1 || l > 16384) {
			throw new Error("l parameter must be between 1 and 16384")
		}
		params.push(`l_${l}`)
	}

	// Add short side
	if (s !== undefined) {
		if (s < 1 || s > 16384) {
			throw new Error("s parameter must be between 1 and 16384")
		}
		params.push(`s_${s}`)
	}

	// Add percentage
	if (p !== undefined) {
		if (p < 1 || p > 1000) {
			throw new Error("p parameter must be between 1 and 1000")
		}
		params.push(`p_${p}`)
	}

	// Add limit
	if (limit !== undefined) {
		params.push(`limit_${limit}`)
	}

	// Add color
	if (color !== undefined) {
		// Validate hex color code
		if (!/^[0-9A-Fa-f]{6}$/.test(color)) {
			throw new Error("color parameter must be a 6-digit hex color code")
		}
		params.push(`color_${color.toUpperCase()}`)
	}

	if (params.length === 0) {
		return null
	}

	return `resize,${params.join(",")}`
}

/**
 * Combine multiple process parameters
 * Note: When image processing includes resize operations, it's recommended to place format conversion parameter at the end
 * @param processes Array of process parameter strings
 * @returns Combined process string, e.g., "image/resize,w_100/quality,q_60/format,jpg"
 */
export function combineProcesses(processes: (string | null)[]): string | null {
	const validProcesses = processes.filter((p): p is string => p !== null)
	if (validProcesses.length === 0) {
		return null
	}
	return `image/${validProcesses.join("/")}`
}

/**
 * Check if image URL supports TOS processing
 * @param imageUrl Image URL to check
 * @returns True if URL appears to be a TOS-compatible public bucket URL
 */
export function isTosPublicImageUrl(imageUrl: string): boolean {
	if (!imageUrl) return false

	// Exclude private bucket URLs with signature parameters
	const privateBucketIndicators = [
		/X-Tos-Signature=/i,
		/X-Tos-Credential=/i,
		/X-Tos-Security-Token=/i,
		/X-Tos-Date=/i,
		/X-Tos-Expires=/i,
	]

	// If URL contains signature parameters, it's a private bucket
	if (privateBucketIndicators.some((pattern) => pattern.test(imageUrl))) {
		return false
	}

	// Check for public TOS domain patterns or x-tos-process parameter
	const publicTosPatterns = [/tos-cn/i, /tos\.volces\.com/i, /x-tos-process=/i]

	return publicTosPatterns.some((pattern) => pattern.test(imageUrl))
}
