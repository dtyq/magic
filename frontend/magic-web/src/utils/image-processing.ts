/**
 * @Reference 参数文档
 * https://github.com/dtyq/cloudfile/blob/v0.1.24/docs/IMAGE_PROCESSING_API.md
 */

const PARAM_SEPARATOR = ","

export function buildResizeParam(options: ResizeOptions): string {
	const { w, h, l, s, p, m, color } = options
	const hasSize = w !== undefined || h !== undefined
	const hasEdgeLimit = l !== undefined || s !== undefined
	const hasPercentage = p !== undefined

	if (hasSize && hasEdgeLimit) {
		throw new Error("resize cannot mix width/height with long/short edge")
	}

	if (!hasSize && !hasEdgeLimit && !hasPercentage) {
		throw new Error("resize requires one of w, h, l, s or p")
	}

	if (hasPercentage && (hasSize || hasEdgeLimit)) {
		throw new Error("percentage resize cannot be combined with absolute dimensions")
	}

	if (m === "pad" && !color) {
		throw new Error("pad mode requires color")
	}

	if (w !== undefined) validateRange(w, "w", 1, 16384)
	if (h !== undefined) validateRange(h, "h", 1, 16384)
	if (l !== undefined) validateRange(l, "l", 1, 16384)
	if (s !== undefined) validateRange(s, "s", 1, 16384)
	if (p !== undefined) validateRange(p, "p", 1, 1000)
	if (color && !/^[0-9A-Fa-f]{6}$/.test(color)) {
		throw new Error("color must be a 6-digit hex value")
	}

	const segments: string[] = []
	if (w !== undefined) segments.push(`w:${w}`)
	if (h !== undefined) segments.push(`h:${h}`)
	if (m) segments.push(`m:${m}`)
	if (l !== undefined) segments.push(`l:${l}`)
	if (s !== undefined) segments.push(`s:${s}`)
	if (p !== undefined) segments.push(`p:${p}`)
	if (color) segments.push(`color:${color.toUpperCase()}`)

	return `resize=${segments.join(PARAM_SEPARATOR)}`
}

export function buildQualityParam(quality: number): string {
	validateRange(quality, "quality", 1, 100)
	return `quality=${quality}`
}

export function buildFormatParam(format: ImageFormat): string {
	const normalized = format.toLowerCase()
	const allowed: ImageFormat[] = ["jpg", "png", "webp", "bmp", "gif", "tiff"]

	if (!allowed.includes(normalized as ImageFormat)) {
		throw new Error(`format must be one of ${allowed.join(", ")}`)
	}

	return `format=${normalized}`
}

export function buildRotateParam(angle: number): string {
	validateRange(angle, "rotate", 0, 360)
	return `rotate=${angle}`
}

export function buildCropParam(options: CropOptions): string {
	const { x = 0, y = 0, w, h, g } = options

	if (w === undefined || h === undefined) {
		throw new Error("crop requires width and height")
	}

	validateRange(x, "x", 0, Number.MAX_SAFE_INTEGER)
	validateRange(y, "y", 0, Number.MAX_SAFE_INTEGER)
	validateRange(w, "w", 1, 30000)
	validateRange(h, "h", 1, 30000)

	if (g && !GRAVITY_OPTIONS.includes(g)) {
		throw new Error(`g must be one of ${GRAVITY_OPTIONS.join(", ")}`)
	}

	const segments: string[] = [`x:${x}`, `y:${y}`, `w:${w}`, `h:${h}`]
	if (g) segments.push(`g:${g}`)

	return `crop=${segments.join(PARAM_SEPARATOR)}`
}

export function buildCircleParam(radius: number): string {
	validateRange(radius, "circle", 1, 4096)
	return `circle=${radius}`
}

export function buildRoundedCornersParam(radius: number): string {
	validateRange(radius, "roundedCorners", 1, 4096)
	return `roundedCorners=${radius}`
}

export function buildIndexCropParam(options: IndexCropOptions): string {
	const { a, l, i } = options

	if (a !== "x" && a !== "y") {
		throw new Error("indexcrop axis must be x or y")
	}

	validateRange(l, "length", 1, Number.MAX_SAFE_INTEGER)
	validateRange(i, "index", 0, Number.MAX_SAFE_INTEGER)

	return `indexcrop=a:${a},l:${l},i:${i}`
}

export function buildWatermarkParam(options: WatermarkOptions): string {
	const { t, c, p, x, y, tr, s, co, f } = options

	if (t !== "text" && t !== "image") {
		throw new Error("watermark type must be text or image")
	}

	if (!c) {
		throw new Error("watermark content is required")
	}

	if (p && !POSITION_OPTIONS.includes(p)) {
		throw new Error(`watermark position must be one of ${POSITION_OPTIONS.join(", ")}`)
	}

	if (x !== undefined) validateRange(x, "x", 0, 4096)
	if (y !== undefined) validateRange(y, "y", 0, 4096)
	if (tr !== undefined) validateRange(tr, "tr", 0, 100)
	if (s !== undefined) validateRange(s, "s", 1, 1000)
	if (co && !/^([0-9A-Fa-f]{6}|[A-Za-z]+)$/.test(co)) {
		throw new Error("watermark color must be hex or named color")
	}

	const segments: string[] = [`t:${t}`, `c:${c}`]
	if (p) segments.push(`p:${p}`)
	if (x !== undefined) segments.push(`x:${x}`)
	if (y !== undefined) segments.push(`y:${y}`)
	if (tr !== undefined) segments.push(`tr:${tr}`)
	if (s !== undefined) segments.push(`s:${s}`)
	if (co) segments.push(`co:${co}`)
	if (f) segments.push(`f:${f}`)

	return `watermark=${segments.join(PARAM_SEPARATOR)}`
}

export function buildBlurParam(options: BlurOptions): string {
	const { r, s } = options

	validateRange(r, "r", 1, 50)
	validateRange(s, "s", 1, 50)

	return `blur=r:${r},s:${s}`
}

export function buildSharpenParam(sharpen: number): string {
	validateRange(sharpen, "sharpen", 50, 399)
	return `sharpen=${sharpen}`
}

export function buildBrightParam(bright: number): string {
	validateRange(bright, "bright", -100, 100)
	return `bright=${bright}`
}

export function buildContrastParam(contrast: number): string {
	validateRange(contrast, "contrast", -100, 100)
	return `contrast=${contrast}`
}

export function buildInfoParam(value: boolean | 0 | 1): string {
	return `info=${value ? 1 : 0}`
}

export function buildAverageHueParam(value: boolean | 0 | 1): string {
	return `averageHue=${value ? 1 : 0}`
}

export function buildAutoOrientParam(value: boolean | 0 | 1): string {
	return `autoOrient=${normalizeBinaryFlag(value, "autoOrient")}`
}

export function buildInterlaceParam(value: boolean | 0 | 1): string {
	return `interlace=${normalizeBinaryFlag(value, "interlace")}`
}

export function buildRawParam(raw: string): string {
	if (!raw?.trim()) {
		throw new Error("raw parameter cannot be empty")
	}
	return `raw=${raw}`
}

export function buildImageProcessQuery(options: ImageProcessOptions): string {
	if (options.raw) return buildRawParam(options.raw)

	if (!options.format) {
		throw new Error("format is required when image processing is enabled")
	}

	const parts: string[] = []

	if (options.resize) parts.push(buildResizeParam(options.resize))
	if (options.quality !== undefined) parts.push(buildQualityParam(options.quality))
	if (options.format) parts.push(buildFormatParam(options.format))
	if (options.rotate !== undefined) parts.push(buildRotateParam(options.rotate))
	if (options.crop) parts.push(buildCropParam(options.crop))
	if (options.circle !== undefined) parts.push(buildCircleParam(options.circle))
	if (options.roundedCorners !== undefined)
		parts.push(buildRoundedCornersParam(options.roundedCorners))
	if (options.indexcrop) parts.push(buildIndexCropParam(options.indexcrop))
	if (options.watermark) parts.push(buildWatermarkParam(options.watermark))
	if (options.blur) parts.push(buildBlurParam(options.blur))
	if (options.sharpen !== undefined) parts.push(buildSharpenParam(options.sharpen))
	if (options.bright !== undefined) parts.push(buildBrightParam(options.bright))
	if (options.contrast !== undefined) parts.push(buildContrastParam(options.contrast))
	if (options.info !== undefined) parts.push(buildInfoParam(options.info))
	if (options.averageHue !== undefined) parts.push(buildAverageHueParam(options.averageHue))
	if (options.autoOrient !== undefined) parts.push(buildAutoOrientParam(options.autoOrient))
	if (options.interlace !== undefined) parts.push(buildInterlaceParam(options.interlace))

	return parts.join("&")
}

export function buildImageProcessPreset(
	preset: ImageProcessPreset,
	overrides?: ImageProcessOptions,
): string {
	const base = IMAGE_PROCESS_PRESETS[preset]

	if (!base) throw new Error(`unknown preset: ${preset}`)

	const merged = mergeImageProcessOptions(base, overrides)
	return buildImageProcessQuery(merged)
}

function validateRange(value: number, name: string, min: number, max: number): void {
	if (value < min || value > max) {
		throw new Error(`${name} must be between ${min} and ${max}`)
	}
}

function normalizeBinaryFlag(value: boolean | 0 | 1, name: string): 0 | 1 {
	if (value === 0 || value === false) return 0
	if (value === 1 || value === true) return 1
	throw new Error(`${name} must be 0 or 1`)
}

function mergeImageProcessOptions(
	base: ImageProcessOptions,
	overrides?: ImageProcessOptions,
): ImageProcessOptions {
	if (!overrides) return base

	return {
		raw: overrides.raw ?? base.raw,
		resize: mergeNestedOptions(base.resize, overrides.resize),
		quality: overrides.quality ?? base.quality,
		format: overrides.format ?? base.format,
		rotate: overrides.rotate ?? base.rotate,
		crop: mergeNestedOptions(base.crop, overrides.crop),
		circle: overrides.circle ?? base.circle,
		roundedCorners: overrides.roundedCorners ?? base.roundedCorners,
		indexcrop: mergeNestedOptions(base.indexcrop, overrides.indexcrop),
		watermark: mergeNestedOptions(base.watermark, overrides.watermark),
		blur: mergeNestedOptions(base.blur, overrides.blur),
		sharpen: overrides.sharpen ?? base.sharpen,
		bright: overrides.bright ?? base.bright,
		contrast: overrides.contrast ?? base.contrast,
		info: overrides.info ?? base.info,
		averageHue: overrides.averageHue ?? base.averageHue,
		autoOrient: overrides.autoOrient ?? base.autoOrient,
		interlace: overrides.interlace ?? base.interlace,
	}
}

function mergeNestedOptions<T>(base?: T, override?: T): T | undefined {
	if (!base && !override) return undefined
	if (!base) return override
	if (!override) return base
	return { ...base, ...override }
}

const GRAVITY_OPTIONS = [
	"nw",
	"north",
	"ne",
	"west",
	"center",
	"east",
	"sw",
	"south",
	"se",
] as const
const POSITION_OPTIONS = GRAVITY_OPTIONS
const IMAGE_PROCESS_PRESETS: Record<ImageProcessPreset, ImageProcessOptions> = {
	"thumbnail-fixed": {
		resize: { w: 200, h: 200, m: "fill" },
		quality: 80,
		format: "webp",
	},
	"thumbnail-scaled": {
		resize: { w: 200, h: 200, m: "lfit" },
		quality: 80,
		format: "webp",
	},
	"avatar-circle": {
		resize: { w: 150, h: 150, m: "fill" },
		circle: 75,
		format: "png",
	},
	"product-lfit": {
		resize: { w: 800, h: 800, m: "lfit" },
		quality: 85,
		roundedCorners: 20,
		format: "webp",
	},
	"product-with-edge": {
		resize: { w: 1000, h: 1000, m: "lfit", l: 800 },
		quality: 85,
		format: "webp",
	},
	"progressive-preview": {
		resize: { w: 1920, h: 1920, m: "lfit" },
		quality: 90,
		autoOrient: 1,
		interlace: 1,
		format: "webp",
	},
	"mobile-responsive": {
		resize: { w: 750, h: 750, m: "lfit" },
		quality: 85,
		format: "webp",
	},
	"percentage-scale": {
		resize: { p: 50 },
		quality: 85,
		format: "webp",
	},
}

export type ImageFormat = "jpg" | "png" | "webp" | "bmp" | "gif" | "tiff"
export type ResizeMode = "lfit" | "mfit" | "fill" | "pad" | "fixed"
export type Gravity = (typeof GRAVITY_OPTIONS)[number]
export type WatermarkPosition = (typeof POSITION_OPTIONS)[number]
export type ImageProcessPreset =
	| "thumbnail-fixed"
	| "thumbnail-scaled"
	| "avatar-circle"
	| "product-lfit"
	| "product-with-edge"
	| "progressive-preview"
	| "mobile-responsive"
	| "percentage-scale"

export interface ResizeOptions {
	w?: number
	h?: number
	l?: number
	s?: number
	p?: number
	m?: ResizeMode
	color?: string
}

export interface CropOptions {
	x?: number
	y?: number
	w: number
	h: number
	g?: Gravity
}

export interface IndexCropOptions {
	a: "x" | "y"
	l: number
	i: number
}

export interface WatermarkOptions {
	t: "text" | "image"
	c: string
	p?: WatermarkPosition
	x?: number
	y?: number
	tr?: number
	s?: number
	co?: string
	f?: string
}

export interface BlurOptions {
	r: number
	s: number
}

export interface ImageProcessOptions {
	raw?: string
	resize?: ResizeOptions
	quality?: number
	format?: ImageFormat
	rotate?: number
	crop?: CropOptions
	circle?: number
	roundedCorners?: number
	indexcrop?: IndexCropOptions
	watermark?: WatermarkOptions
	blur?: BlurOptions
	sharpen?: number
	bright?: number
	contrast?: number
	info?: boolean | 0 | 1
	averageHue?: boolean | 0 | 1
	autoOrient?: boolean | 0 | 1
	interlace?: boolean | 0 | 1
}
