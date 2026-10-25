import type { User } from "@/types/user"
import type { PlatformWatermarkConfig, PlatformWatermarkField } from "@/apis/types"
import { env } from "@/utils/env"

/** Watermark is disabled by default; only the exact string "true" enables it. */
export function isWatermarkEnabled() {
	const runtimeValue =
		typeof window !== "undefined" ? window.CONFIG?.MAGIC_WATERMARK_ENABLED : undefined
	return (runtimeValue ?? import.meta.env.MAGIC_WATERMARK_ENABLED) === "true"
}
/**
 * A single extracted watermark view for display.
 * The image URL can be used directly as an image source.
 */
export type WatermarkContrastView = {
	label: string
	dataUrl: string
}

/**
 * A single extraction can produce multiple views for comparing enhancement modes.
 */
export type WatermarkContrastResult = {
	viewDataUrl: string | null
	views: WatermarkContrastView[]
	viewDataUrls: string[]
	viewCount: number
}

export type LocalDifferenceWatermarkResult = WatermarkContrastView | null

export type WatermarkContrastMode = "reverse-layer" | "local-difference" | "dark-ink" | "bright-ink"

export type WatermarkImageSource = File | Blob | string

/**
 * Information reported when the observer detects watermark removal or attribute changes.
 */
export type TamperInfo = { kind: "removed" } | { kind: "attr"; attr: string }

/**
 * Options used to mount an invisible page watermark.
 * The config is passed through to the canvas tile generator.
 */
export type InvisibleWatermarkOptions = {
	container: HTMLElement
	text: string
	id?: string
	config?: WatermarkDataUrlOptions
	// Called after the watermark is embedded.
	onEmbedded?: () => void
	// Called after the mutation observer is ready.
	onObserverReady?: () => void
	// Called after the watermark is tampered with.
	onTamper?: (info: TamperInfo) => void
}

/** Default watermark identifier mounted on the page. Can be overridden by options.id. */
export const WATERMARK_DOM_ID = "magic-watermark"

/** Default watermark tile config. Very low opacity may not render on some iPhones. */
export const WATERMARK_CONFIG = {
	fontSize: 18,
	/** 文字颜色 */
	// Keep the watermark visible through translucent modal masks by strengthening
	// the text itself instead of drawing a contrasting rectangle behind every label.
	textColor: "rgba(0, 0, 0, 0.05)",
	/** 仅供显式开启底衬的特殊场景使用；页面水印默认不绘制 */
	backgroundColor: "rgba(255, 255, 255, 0.015)",
	rotate: -12,
	gapX: 60,
	gapY: 140,
	patchPaddingX: 3,
	patchPaddingY: 3,
	patchRadius: 4,
	/** 文字底衬默认关闭，避免在 modal 遮罩下出现矩形背景块。 */
	useBackground: false,
	/** @deprecated 请使用 textColor */
	color: "rgba(0, 0, 0, 0.05)",
}

/**
 * 环境变量开启的调试水印（`MAGIC_WATERMARK_ENABLED`）文字色：接近透明，肉眼几乎不可见。
 * 它只做隐性溯源标记，不应干扰成员阅读；个人组织与团队/企业组织统一使用。
 */
const USER_ID_WATERMARK_TEXT_COLOR = "rgba(0, 0, 0, 0.01)"

/**
 * 环境变量开启的 user_id 调试水印配置，各组织类型共用。
 * 与 {@link WATERMARK_CONFIG} 的区别只在文字颜色：调试水印几乎透明。
 */
export const USER_ID_WATERMARK_CONFIG = {
	...WATERMARK_CONFIG,
	textColor: USER_ID_WATERMARK_TEXT_COLOR,
	/** @deprecated 请使用 textColor */
	color: USER_ID_WATERMARK_TEXT_COLOR,
}

/** Visual strength used by the organization watermark configuration. */
const WATERMARK_DEPTH_CONFIG: Record<PlatformWatermarkConfig["depth"], WatermarkDataUrlOptions> = {
	light: {
		textColor: "rgba(0, 0, 0, 0.03)",
		useBackground: false,
	},
	standard: {
		textColor: "rgba(0, 0, 0, 0.045)",
		useBackground: false,
	},
	strong: {
		textColor: "rgba(0, 0, 0, 0.06)",
		useBackground: false,
	},
}

/** Global platform watermark layout, kept separate from the legacy user ID watermark. */
const PLATFORM_WATERMARK_LAYOUT_CONFIG = {
	desktop: {
		fontSize: 16,
		gapX: 52,
		gapY: 120,
	},
	mobile: {
		fontSize: 13,
		gapX: 26,
		gapY: 52,
	},
} as const

/** 窄屏（≤ {@link WATERMARK_MOBILE_MAX_WIDTH}）挂载时合并的间距/字号，挂载时判定一次，不监听 resize。 */
export const WATERMARK_MOBILE_CONFIG = {
	gapX: 30,
	gapY: 60,
	fontSize: 14,
} as const

/** Viewport width at or below this value uses {@link WATERMARK_MOBILE_CONFIG}. */
export const WATERMARK_MOBILE_MAX_WIDTH = 768

/** Gain for dark-ink / bright-ink / local-difference modes. */
export const WATERMARK_CONTRAST_RANGE = {
	big: 80,
	middle: 50,
	small: 60,
}

/** Tunables for config-channel extract (`reverse-layer`). */
export const WATERMARK_EXTRACT_CONFIG = {
	/**
	 * 背景半径 bgRadius（px）
	 * 用矩形邻域均值估计每个像素的「局部背景」，再与当前像素做通道差分。
	 * 越小越保留细笔画/淡纹，但页面纹理也会被增强；越大差分更平滑，淡字易被抹进背景。
	 * 建议：16～28。
	 */
	bgRadius: 22,
	/**
	 * 通道增益 gain
	 * 将 RGB 方向差分（黑字变暗、红底偏 R 等）乘以该系数后再合成。
	 * 宜偏小（1～6）：后续还有分位归一化；过大易 clamp 到 255，淡纹反而发糊、发白。
	 */
	gain: 2,
	greenInkGain: 10,
	/**
	 * 噪声底分位 noisePercentile（0～1）
	 * 出图前取全图残差的该分位数作为噪声底，低于它的信号会被压暗。
	 * 越低越能显出淡纹，背景噪点也会变多；越高只留强对比区域。
	 * 建议：0.35～0.55。
	 */
	noisePercentile: 0.42,
	noiseCeilingPercentile: 0.985,
	noiseStretch: 3.2,
	/**
	 * 弱信号提升 signalGamma
	 * 残差归一化后的幂次曲线：小于 1 时抬高弱信号、压缩强纹理峰值。
	 * 越小淡纹越显，噪点也更明显；等于 1 为线性。
	 * 建议：0.35～0.65。
	 */
	signalGamma: 0.48,
	directionSoftness: 8,
}

export type WatermarkExtractTuneOptions = Partial<typeof WATERMARK_EXTRACT_CONFIG>

/** 解析侧颜色配置：背景 / 文字 / 叠加（仅 RGB 方向，α 不参与通道提取）。 */
export type WatermarkExtractOptions = WatermarkExtractTuneOptions & {
	/** 底衬背景色，对应生成 backgroundColor */
	backgroundColor?: string
	/** 文字颜色，对应生成 textColor */
	textColor?: string
	/** 叠加色：文字叠在底衬上的合成方向，可手调；未传则只用背景 + 文字两路 */
	overlayColor?: string
	/** 是否启用底衬通道解析，默认开启；仅 `false` 时关闭 */
	useBackground?: boolean
}

export type WatermarkDataUrlOptions = Partial<typeof WATERMARK_CONFIG> & {
	/** 窄屏时合并 {@link WATERMARK_MOBILE_CONFIG}，默认 true。 */
	denseOnMobile?: boolean
}

/** 当前视口是否使用移动端水印密度。 */
export function isMobileWatermarkViewport() {
	if (typeof window === "undefined") return false
	return window.innerWidth <= WATERMARK_MOBILE_MAX_WIDTH
}

/**
 * 挂载前解析水印配置：窄屏且 denseOnMobile 为 true 时合并 {@link WATERMARK_MOBILE_CONFIG}。
 * 调用方显式传入的字段会覆盖移动端默认值。
 */
export function resolveWatermarkConfig(config: WatermarkDataUrlOptions = {}) {
	const { denseOnMobile = true, ...rest } = config
	if (!denseOnMobile || !isMobileWatermarkViewport()) {
		return rest
	}
	return { ...WATERMARK_MOBILE_CONFIG, ...rest }
}

const MAX_SIDE = 1700
const BACKGROUND_RADII = [9, 18, 32]

/** Clamp any value into the 0-255 pixel channel range. */
function clampByte(value: number) {
	return Math.max(0, Math.min(255, Math.round(value)))
}

/** Create a canvas optimized for frequent pixel reads. */
function createCanvas(width: number, height: number) {
	const canvas = document.createElement("canvas")
	canvas.width = width
	canvas.height = height
	const ctx = canvas.getContext("2d", { willReadFrequently: true })
	if (!ctx) throw new Error("当前浏览器不支持 Canvas 2D")
	return { canvas, ctx }
}

/** Convert RGBA image data into a single-channel grayscale array. */
function toGray(imageData: ImageData) {
	const { data } = imageData
	const gray = new Uint8Array(data.length / 4)
	for (let i = 0, j = 0; i < data.length; i += 4, j++) {
		gray[j] = clampByte(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
	}
	return gray
}

/**
 * Build an integral image so rectangular mean queries run in constant time.
 * Local background estimation calls this repeatedly, so we precompute it.
 */
function buildIntegral(values: Uint8Array, width: number, height: number) {
	const integral = new Float64Array((width + 1) * (height + 1))
	for (let y = 1; y <= height; y++) {
		let rowSum = 0
		for (let x = 1; x <= width; x++) {
			rowSum += values[(y - 1) * width + (x - 1)]
			integral[y * (width + 1) + x] = integral[(y - 1) * (width + 1) + x] + rowSum
		}
	}
	return integral
}

/** Query the local background mean around a pixel within the given radius. */
function boxMean(
	integral: Float64Array,
	width: number,
	height: number,
	x: number,
	y: number,
	radius: number,
) {
	const x1 = Math.max(0, x - radius)
	const y1 = Math.max(0, y - radius)
	const x2 = Math.min(width - 1, x + radius)
	const y2 = Math.min(height - 1, y + radius)
	const stride = width + 1
	const sum =
		integral[(y2 + 1) * stride + (x2 + 1)] -
		integral[y1 * stride + (x2 + 1)] -
		integral[(y2 + 1) * stride + x1] +
		integral[y1 * stride + x1]
	return sum / ((x2 - x1 + 1) * (y2 - y1 + 1))
}

/** Read a percentile from a grayscale distribution for noise floor or stretch range estimation. */
function percentile(values: Uint8Array, ratio: number) {
	const hist = new Uint32Array(256)
	for (let i = 0; i < values.length; i++) hist[values[i]]++

	const target = Math.max(0, Math.min(values.length - 1, Math.floor(values.length * ratio)))
	let seen = 0
	for (let i = 0; i < hist.length; i++) {
		seen += hist[i]
		if (seen >= target) return i
	}
	return 255
}

function parseRgbaColor(input: string) {
	const match = input.match(/rgba?\(\s*([^)]+)\s*\)/i)
	if (!match) {
		return { r: 0, g: 0, b: 0, a: 1 }
	}
	const parts = match[1].split(",").map((part) => part.trim())
	return {
		r: clampByte(Number(parts[0])),
		g: clampByte(Number(parts[1])),
		b: clampByte(Number(parts[2])),
		a: parts[3] !== undefined ? Math.max(0, Math.min(1, Number(parts[3]))) : 1,
	}
}

/** 文字叠在底衬上的 RGBA，供解析默认「叠加颜色」参考。 */
export function blendWatermarkColors(textColor: string, backgroundColor: string) {
	const top = parseRgbaColor(textColor)
	const bottom = parseRgbaColor(backgroundColor)
	const alpha = top.a + bottom.a * (1 - top.a)
	if (alpha <= 0) return "rgba(0, 0, 0, 0)"

	const r = (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / alpha
	const g = (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / alpha
	const b = (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / alpha
	return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha.toFixed(3)})`
}

function resolveTextColor(config: WatermarkDataUrlOptions) {
	return config.textColor ?? config.color ?? WATERMARK_CONFIG.textColor
}

/** 是否绘制文字底衬；未传时沿用全局默认配置。 */
function resolveUseBackground(config: { useBackground?: boolean } = {}) {
	return config.useBackground ?? WATERMARK_CONFIG.useBackground
}

function resolveWatermarkDrawConfig(config: WatermarkDataUrlOptions = {}) {
	const resolved = resolveWatermarkConfig(config)
	const textColor = resolveTextColor(resolved)
	const backgroundColor = resolved.backgroundColor ?? WATERMARK_CONFIG.backgroundColor
	return {
		fontSize: resolved.fontSize ?? WATERMARK_CONFIG.fontSize,
		textColor,
		backgroundColor,
		rotate: resolved.rotate ?? WATERMARK_CONFIG.rotate,
		gapX: resolved.gapX ?? WATERMARK_CONFIG.gapX,
		gapY: resolved.gapY ?? WATERMARK_CONFIG.gapY,
		useBackground: resolveUseBackground(resolved),
		patchPaddingX: resolved.patchPaddingX ?? WATERMARK_CONFIG.patchPaddingX,
		patchPaddingY: resolved.patchPaddingY ?? WATERMARK_CONFIG.patchPaddingY,
		patchRadius: resolved.patchRadius ?? WATERMARK_CONFIG.patchRadius,
	}
}

function defaultExtractOptions(config: WatermarkDataUrlOptions = {}): WatermarkExtractOptions {
	const textColor = resolveTextColor(config)
	const backgroundColor = config.backgroundColor ?? WATERMARK_CONFIG.backgroundColor
	return {
		textColor,
		backgroundColor,
		overlayColor: blendWatermarkColors(textColor, backgroundColor),
		useBackground: resolveUseBackground(config),
		...WATERMARK_EXTRACT_CONFIG,
	}
}

function resolveExtractTune(embed: WatermarkExtractOptions = {}) {
	return { ...WATERMARK_EXTRACT_CONFIG, ...embed }
}

type ConfigChannelRgb = { r: number; g: number; b: number }

function embedColorLuminance(color: ConfigChannelRgb) {
	return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b
}

function directionAttenuation(delta: number, softness: number) {
	if (delta <= 0) return 1
	if (delta >= softness) return 0
	return 1 - delta / softness
}

function configColorChannelResidual(
	outR: number,
	outG: number,
	outB: number,
	gray: number,
	bgR: number,
	bgG: number,
	bgB: number,
	bgGray: number,
	embed: ConfigChannelRgb,
	gain: number,
	greenInkGain: number,
	directionSoftness: number,
) {
	if (embed.r > embed.g + 8 && embed.r > embed.b + 8) {
		const rBump = Math.max(0, outR - bgR)
		const greenCue = Math.max(0, outG - (outR + outB) / 2)
		const score = Math.max(rBump * gain, greenCue * greenInkGain)
		return score * directionAttenuation(Math.max(0, bgR - outR), directionSoftness)
	}

	if (embedColorLuminance(embed) > 140) {
		const bright = Math.max(0, gray - bgGray)
		return bright * gain * directionAttenuation(Math.max(0, bgGray - gray), directionSoftness)
	}

	const darkInk = Math.max(0, bgGray - gray)
	const channelDark = Math.max(
		Math.max(0, bgR - outR),
		Math.max(0, bgG - outG),
		Math.max(0, bgB - outB),
	)
	const score = Math.max(darkInk * gain, channelDark * gain * 0.5)
	return score * directionAttenuation(Math.max(0, gray - bgGray), directionSoftness)
}

function channelIntegral(imageData: ImageData, channel: 0 | 1 | 2) {
	const { width, height, data } = imageData
	const plane = new Uint8Array(width * height)
	for (let i = channel, j = 0; i < data.length; i += 4, j++) {
		plane[j] = data[i]
	}
	return buildIntegral(plane, width, height)
}

function computeConfigChannelResidualField(
	imageData: ImageData,
	embed: WatermarkExtractOptions,
	bgRadius: number,
	tune: typeof WATERMARK_EXTRACT_CONFIG,
) {
	const { width, height, data } = imageData
	const text = parseRgbaColor(embed.textColor ?? WATERMARK_CONFIG.textColor)
	const patch =
		resolveUseBackground(embed) && embed.backgroundColor
			? parseRgbaColor(embed.backgroundColor)
			: null
	const overlay = embed.overlayColor ? parseRgbaColor(embed.overlayColor) : null

	const gray = toGray(imageData)
	const integralGray = buildIntegral(gray, width, height)
	const integralR = channelIntegral(imageData, 0)
	const integralG = channelIntegral(imageData, 1)
	const integralB = channelIntegral(imageData, 2)
	const diff = new Uint8Array(width * height)

	for (let i = 0, j = 0; i < data.length; i += 4, j++) {
		const x = j % width
		const y = Math.floor(j / width)
		const bgR = boxMean(integralR, width, height, x, y, bgRadius)
		const bgG = boxMean(integralG, width, height, x, y, bgRadius)
		const bgB = boxMean(integralB, width, height, x, y, bgRadius)
		const bgGray = boxMean(integralGray, width, height, x, y, bgRadius)

		const outR = data[i]
		const outG = data[i + 1]
		const outB = data[i + 2]

		let score = configColorChannelResidual(
			outR,
			outG,
			outB,
			gray[j],
			bgR,
			bgG,
			bgB,
			bgGray,
			text,
			tune.gain,
			tune.greenInkGain,
			tune.directionSoftness,
		)

		if (patch) {
			score = Math.max(
				score,
				configColorChannelResidual(
					outR,
					outG,
					outB,
					gray[j],
					bgR,
					bgG,
					bgB,
					bgGray,
					patch,
					tune.gain,
					tune.greenInkGain,
					tune.directionSoftness,
				),
			)
		}

		if (overlay) {
			score = Math.max(
				score,
				configColorChannelResidual(
					outR,
					outG,
					outB,
					gray[j],
					bgR,
					bgG,
					bgB,
					bgGray,
					overlay,
					tune.gain,
					tune.greenInkGain,
					tune.directionSoftness,
				),
			)
		}

		diff[j] = clampByte(score)
	}

	return { width, height, diff }
}

type InkResidualTune = Pick<
	typeof WATERMARK_EXTRACT_CONFIG,
	"noisePercentile" | "noiseCeilingPercentile" | "noiseStretch" | "signalGamma"
>

function inkResidualToImageData(
	residual: Uint8Array,
	width: number,
	height: number,
	tune: Partial<InkResidualTune> = WATERMARK_EXTRACT_CONFIG,
) {
	const t = { ...WATERMARK_EXTRACT_CONFIG, ...tune }
	const noiseFloor = percentile(residual, t.noisePercentile)
	const noiseCeil = Math.max(noiseFloor + 1, percentile(residual, t.noiseCeilingPercentile))
	const span = noiseCeil - noiseFloor
	const out = new ImageData(width, height)

	for (let i = 0, j = 0; j < residual.length; i += 4, j++) {
		const norm = Math.min(1, Math.max(0, (residual[j] - noiseFloor) / span))
		const ink = clampByte(Math.pow(norm, t.signalGamma) * 255 * t.noiseStretch)
		const value = 255 - ink
		out.data[i] = out.data[i + 1] = out.data[i + 2] = value
		out.data[i + 3] = 255
	}
	return out
}

function configReverseWatermarkLayerFromImageData(
	imageData: ImageData,
	embed: WatermarkExtractOptions = {},
) {
	const tune = resolveExtractTune(embed)
	const { width, height, diff } = computeConfigChannelResidualField(
		imageData,
		embed,
		tune.bgRadius,
		tune,
	)
	return inkResidualToImageData(diff, width, height, tune)
}

/**
 * Dark-ink enhancement: extract pixels darker than their local background.
 * Best for gray or dark transparent watermarks on light backgrounds.
 */
function watermarkResidualFromImageData(imageData: ImageData, radius: number, gain: number) {
	const { width, height, data } = imageData
	const gray = toGray(imageData)
	const integral = buildIntegral(gray, width, height)
	const residual = new Uint8Array(width * height)

	for (let i = 0, j = 0; i < data.length; i += 4, j++) {
		const x = j % width
		const y = Math.floor(j / width)
		const background = boxMean(integral, width, height, x, y, radius)
		const darkInk = Math.max(0, background - gray[j])
		const greenInk = Math.max(0, data[i + 1] - (data[i] + data[i + 2]) / 2)
		residual[j] = clampByte(Math.max(darkInk * gain, greenInk * 34))
	}

	const noiseFloor = percentile(residual, 0.68)
	const out = new ImageData(width, height)
	for (let i = 0, j = 0; j < residual.length; i += 4, j++) {
		const value = 255 - clampByte((residual[j] - noiseFloor) * 2.8)
		out.data[i] = out.data[i + 1] = out.data[i + 2] = value
		out.data[i + 3] = 255
	}
	return out
}

/**
 * Bright-ink enhancement: extract pixels brighter than their local background.
 * Best for light transparent watermarks on dark backgrounds.
 */
function brightWatermarkResidualFromImageData(imageData: ImageData, radius: number, gain: number) {
	const { width, height } = imageData
	const gray = toGray(imageData)
	const integral = buildIntegral(gray, width, height)
	const residual = new Uint8Array(width * height)

	for (let j = 0; j < gray.length; j++) {
		const x = j % width
		const y = Math.floor(j / width)
		const background = boxMean(integral, width, height, x, y, radius)
		residual[j] = clampByte(Math.max(0, gray[j] - background) * gain)
	}

	const noiseFloor = percentile(residual, 0.68)
	const out = new ImageData(width, height)
	for (let i = 0, j = 0; j < residual.length; i += 4, j++) {
		const value = 255 - clampByte((residual[j] - noiseFloor) * 2.8)
		out.data[i] = out.data[i + 1] = out.data[i + 2] = value
		out.data[i + 3] = 255
	}
	return out
}

/**
 * Local difference enhancement: use the absolute difference from local background.
 * It responds to both dark and bright marks, but may also enhance complex textures.
 */
function adaptiveResidualFromImageData(imageData: ImageData, radius: number, gain: number) {
	const { width, height } = imageData
	const gray = toGray(imageData)
	const integral = buildIntegral(gray, width, height)
	const residual = new Uint8Array(width * height)

	for (let j = 0; j < gray.length; j++) {
		const x = j % width
		const y = Math.floor(j / width)
		const background = boxMean(integral, width, height, x, y, radius)
		residual[j] = clampByte(Math.abs(gray[j] - background) * gain)
	}

	const low = percentile(residual, 0.72)
	const high = Math.max(low + 1, percentile(residual, 0.998))
	const out = new ImageData(width, height)

	for (let i = 0, j = 0; j < residual.length; i += 4, j++) {
		const ink = clampByte(((residual[j] - low) * 255) / (high - low))
		const value = 255 - ink
		out.data[i] = out.data[i + 1] = out.data[i + 2] = value
		out.data[i + 3] = 255
	}

	return out
}

/** Convert processed pixel data into a displayable image URL. */
function imageDataToDataUrl(imageData: ImageData) {
	const { canvas, ctx } = createCanvas(imageData.width, imageData.height)
	ctx.putImageData(imageData, 0, 0)
	return canvas.toDataURL("image/png")
}

function normalizeBase64DataUrl(value: string) {
	return value.startsWith("data:image/") ? value : `data:image/png;base64,${value}`
}

async function base64ToBlob(value: string) {
	const response = await fetch(normalizeBase64DataUrl(value))
	return response.blob()
}

async function createImageBitmapFromSource(source: WatermarkImageSource) {
	if (typeof source === "string") {
		return createImageBitmap(await base64ToBlob(source))
	}

	return createImageBitmap(source)
}

function createModeContrastView(
	bitmap: ImageBitmap,
	mode: WatermarkContrastMode,
	extractOptions: WatermarkExtractOptions = defaultExtractOptions(),
): WatermarkContrastView {
	const maxSide = Math.max(bitmap.width, bitmap.height)
	const baseScale = Math.min(1, MAX_SIDE / Math.max(1, maxSide))
	const width = Math.max(1, Math.round(bitmap.width * baseScale))
	const height = Math.max(1, Math.round(bitmap.height * baseScale))
	const { ctx } = createCanvas(width, height)
	ctx.imageSmoothingEnabled = true
	ctx.imageSmoothingQuality = "high"
	ctx.drawImage(bitmap, 0, 0, width, height)

	const imageData = ctx.getImageData(0, 0, width, height)

	if (mode === "reverse-layer") {
		return {
			label: "配置通道提取（背景 / 文字 / 叠加）",
			dataUrl: imageDataToDataUrl(
				configReverseWatermarkLayerFromImageData(imageData, extractOptions),
			),
		}
	}

	if (mode === "dark-ink") {
		return {
			label: "暗纹增强（大范围）",
			dataUrl: imageDataToDataUrl(
				watermarkResidualFromImageData(
					imageData,
					BACKGROUND_RADII[2],
					WATERMARK_CONTRAST_RANGE.big,
				),
			),
		}
	}

	if (mode === "bright-ink") {
		return {
			label: "亮纹增强（大范围）",
			dataUrl: imageDataToDataUrl(
				brightWatermarkResidualFromImageData(
					imageData,
					BACKGROUND_RADII[2],
					WATERMARK_CONTRAST_RANGE.big,
				),
			),
		}
	}

	return {
		label: "明暗通用（局部差分）",
		dataUrl: imageDataToDataUrl(
			adaptiveResidualFromImageData(
				imageData,
				BACKGROUND_RADII[2],
				WATERMARK_CONTRAST_RANGE.small,
			),
		),
	}
}

/** Read an image source and produce all contrast-enhanced extraction views. */
async function extractHighContrastWatermarkFromFile(
	file: WatermarkImageSource,
	extractOptions: WatermarkExtractOptions = defaultExtractOptions(),
): Promise<WatermarkContrastResult> {
	const bitmap = await createImageBitmapFromSource(file)
	try {
		const views: WatermarkContrastView[] = [
			createModeContrastView(bitmap, "reverse-layer", extractOptions),
			createModeContrastView(bitmap, "local-difference"),
			createModeContrastView(bitmap, "dark-ink"),
			createModeContrastView(bitmap, "bright-ink"),
		]
		const viewDataUrls = views.map((view) => view.dataUrl)
		return {
			viewDataUrl: views[0]?.dataUrl ?? null,
			views,
			viewDataUrls,
			viewCount: views.length,
		}
	} finally {
		bitmap.close()
	}
}

/** Read an image source and produce only the requested enhancement view. */
async function extractWatermarkContrastViewFromFile(
	file: WatermarkImageSource,
	mode: WatermarkContrastMode,
	extractOptions: WatermarkExtractOptions = defaultExtractOptions(),
): Promise<WatermarkContrastView> {
	const bitmap = await createImageBitmapFromSource(file)
	try {
		return createModeContrastView(bitmap, mode, extractOptions)
	} finally {
		bitmap.close()
	}
}

function drawWatermarkTile(
	ctx: CanvasRenderingContext2D,
	text: string,
	textW: number,
	textH: number,
	centerX: number,
	centerY: number,
	rotate: number,
	font: string,
	draw: ReturnType<typeof resolveWatermarkDrawConfig>,
) {
	ctx.save()
	ctx.font = font
	ctx.textBaseline = "middle"
	ctx.translate(centerX, centerY)
	ctx.rotate((rotate * Math.PI) / 180)

	if (draw.useBackground && draw.backgroundColor) {
		const patchW = textW + draw.patchPaddingX * 2
		const patchH = textH + draw.patchPaddingY * 2
		const x = -patchW / 2
		const y = -patchH / 2
		ctx.fillStyle = draw.backgroundColor
		if (typeof ctx.roundRect === "function") {
			ctx.beginPath()
			ctx.roundRect(x, y, patchW, patchH, draw.patchRadius)
			ctx.fill()
		} else {
			ctx.fillRect(x, y, patchW, patchH)
		}
	}

	ctx.fillStyle = draw.textColor
	ctx.fillText(text, -textW / 2, 0)
	ctx.restore()
}

/**
 * Generate a repeatable invisible watermark tile from text.
 * The returned image URL can be used as a CSS background or preview image.
 */
function createWatermarkDataURL(text: string, config: WatermarkDataUrlOptions = {}) {
	const draw = resolveWatermarkDrawConfig(config)

	const canvas = document.createElement("canvas")
	const ctx = canvas.getContext("2d")
	if (!ctx) throw new Error("当前浏览器不支持 Canvas 2D")

	const font = `${draw.fontSize}px -apple-system, "Segoe UI", sans-serif`
	ctx.font = font
	const metrics = ctx.measureText(text)
	const textW = metrics.width
	const textH = draw.fontSize * 1.2

	const canvasW = textW + draw.gapX
	const canvasH = textH + draw.gapY
	canvas.width = canvasW * 2
	canvas.height = canvasH * 2

	drawWatermarkTile(ctx, text, textW, textH, canvasW / 2, canvasH / 2, draw.rotate, font, draw)
	drawWatermarkTile(
		ctx,
		text,
		textW,
		textH,
		canvasW / 2 + canvasW,
		canvasH / 2 + canvasH,
		draw.rotate,
		font,
		draw,
	)

	return canvas.toDataURL("image/png")
}

/** Create the fullscreen invisible watermark layer that is mounted onto the page. */
function createWatermarkElement(text: string, wmId: string, config: WatermarkDataUrlOptions = {}) {
	const el = document.createElement("div")
	el.setAttribute("data-wm-id", wmId)
	const dataURL = createWatermarkDataURL(text, config)
	Object.assign(el.style, {
		position: "fixed",
		top: "0",
		left: "0",
		right: "0",
		bottom: "0",
		width: "100vw",
		height: "100dvh",
		backgroundImage: `url(${dataURL})`,
		backgroundRepeat: "repeat",
		pointerEvents: "none",
		zIndex: "9999",
		opacity: "1",
		visibility: "visible",
		display: "block",
	})
	return el
}

/** Unified class entry exposed by the watermark module. */
export class WatermarkService {
	private wmId = WATERMARK_DOM_ID
	private observer: MutationObserver | null = null
	private options: InvisibleWatermarkOptions | null = null

	/** Generate a watermark tile image URL. */
	createDataUrl(text: string, options: WatermarkDataUrlOptions = {}) {
		return createWatermarkDataURL(text, options)
	}

	/** Create a watermark page element. Most business code should call mount instead. */
	createElement(text: string, wmId: string, config: WatermarkDataUrlOptions = {}) {
		return createWatermarkElement(text, wmId, config)
	}

	/** Mount the watermark and start tamper observation. */
	mount(options: InvisibleWatermarkOptions) {
		this.options = options
		this.wmId = options.id ?? WATERMARK_DOM_ID
		this.mountWatermark()
		this.setupObserver()
		options.onEmbedded?.()
	}

	/** Update the watermark text and optionally override the generation config. */
	updateText(text: string, config = this.options?.config) {
		if (!this.options) return
		this.options = { ...this.options, text, config }
		this.mountWatermark()
	}

	/** Remove the watermark and stop observing. */
	destroy() {
		this.observer?.disconnect()
		this.observer = null
		this.removeWatermark()
		this.options = null
	}

	/** Rebuild the watermark node so this service keeps only one managed node. */
	private mountWatermark() {
		if (!this.options) return
		const { container, text, config } = this.options
		const existing = container.querySelector(`[data-wm-id="${this.wmId}"]`)
		if (existing) existing.remove()

		const wmEl = createWatermarkElement(text, this.wmId, config)
		container.appendChild(wmEl)
		return wmEl
	}

	/** Observe watermark removal or key attribute changes and restore it automatically. */
	private setupObserver() {
		if (!this.options) return
		const { container } = this.options
		this.observer?.disconnect()
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === "childList") {
					const isWatermarkRemoved = Array.from(mutation.removedNodes).some((node) => {
						if (
							node.nodeType === 1 &&
							(node as Element).getAttribute("data-wm-id") === this.wmId
						) {
							this.options?.onTamper?.({ kind: "removed" })
							setTimeout(() => this.mountWatermark(), 0)
							return true
						}
						return false
					})
					if (isWatermarkRemoved) return
				}
				if (mutation.type === "attributes") {
					const target = mutation.target as Node
					if (target.nodeType !== Node.ELEMENT_NODE) continue
					const el = target as Element
					if (el.getAttribute("data-wm-id") === this.wmId) {
						const attr = mutation.attributeName
						if (attr === "style" || attr === "class") {
							this.options?.onTamper?.({
								kind: "attr",
								attr,
							})
							el.remove()
							setTimeout(() => this.mountWatermark(), 0)
							return
						}
					}
				}
			}
		})

		observer.observe(container, {
			childList: true,
			attributes: true,
			subtree: true,
			attributeFilter: ["style", "class"],
		})

		this.observer = observer
		this.options.onObserverReady?.()
	}

	/** Remove the watermark node managed by this service. */
	private removeWatermark() {
		this.options?.container.querySelector(`[data-wm-id="${this.wmId}"]`)?.remove()
	}

	/** Return all enhancement views, useful for debugging or batch display. */
	async extractContrastViews(
		file: WatermarkImageSource,
		extractOptions?: WatermarkExtractOptions,
	): Promise<WatermarkContrastResult> {
		return extractHighContrastWatermarkFromFile(file, extractOptions)
	}

	/** Extract the default config-channel view. */
	async extractLocalDifferenceView(
		file: WatermarkImageSource,
		extractOptions?: WatermarkExtractOptions,
	): Promise<LocalDifferenceWatermarkResult> {
		return extractWatermarkContrastViewFromFile(file, "reverse-layer", extractOptions)
	}

	/** Return the enhancement view matching the selected page mode. */
	async extractContrastViewByMode(
		file: WatermarkImageSource,
		mode: WatermarkContrastMode,
		extractOptions?: WatermarkExtractOptions,
	): Promise<LocalDifferenceWatermarkResult> {
		return extractWatermarkContrastViewFromFile(file, mode, extractOptions)
	}
}
const watermarkService = new WatermarkService()
let currentUserWatermarkRenderKey = ""
let currentUserWatermarkInfo: User.UserInfo | null = null
let platformWatermarkConfig: PlatformWatermarkConfig | undefined
let currentIsPersonalOrganization = false

export type UserWatermarkMode = "platform" | "legacy" | "disabled"

/** Resolve the active policy without coupling organization rules to DOM rendering. */
export function resolveUserWatermarkMode({
	isPersonalOrganization,
	platformConfig,
	isLegacyEnabled,
}: {
	isPersonalOrganization: boolean
	platformConfig?: PlatformWatermarkConfig
	isLegacyEnabled: boolean
}): UserWatermarkMode {
	if (!isPersonalOrganization && platformConfig?.enabled === true) return "platform"
	return isLegacyEnabled ? "legacy" : "disabled"
}

/** Update the platform watermark policy received from the public platform settings response. */
export function setPlatformWatermarkConfig(config?: PlatformWatermarkConfig) {
	platformWatermarkConfig = config
	if (currentUserWatermarkInfo) syncUserWatermark(currentUserWatermarkInfo)
}

/**
 * Keep the runtime watermark policy aligned with the active organization.
 * Personal organizations intentionally ignore the organization-level policy.
 */
export function setWatermarkOrganizationType(isPersonalOrganization: boolean) {
	currentIsPersonalOrganization = isPersonalOrganization
	if (currentUserWatermarkInfo) syncUserWatermark(currentUserWatermarkInfo)
}

export function syncUserWatermark(userInfo: User.UserInfo | null) {
	currentUserWatermarkInfo = userInfo
	if (typeof document === "undefined" || !document.body) return

	// Organization watermarks are only meaningful for shared organizations.
	// Personal organizations retain the legacy environment-controlled user ID watermark.
	const watermarkMode = resolveUserWatermarkMode({
		isPersonalOrganization: currentIsPersonalOrganization,
		platformConfig: platformWatermarkConfig,
		isLegacyEnabled: isWatermarkEnabled(),
	})
	if (!userInfo || watermarkMode === "disabled") {
		currentUserWatermarkRenderKey = ""
		watermarkService.destroy()
		return
	}

	const usesPlatformWatermark = watermarkMode === "platform"
	const text = usesPlatformWatermark
		? getPlatformWatermarkText(userInfo, platformWatermarkConfig)
		: getUserWatermarkText(userInfo)
	if (!text) {
		currentUserWatermarkRenderKey = ""
		watermarkService.destroy()
		return
	}

	const { config, key } = resolveUserWatermarkRenderConfig(watermarkMode)
	const renderKey = `${key}:${text}`
	if (currentUserWatermarkRenderKey === renderKey) return

	currentUserWatermarkRenderKey = renderKey
	watermarkService.mount({
		container: document.body,
		text,
		config,
	})
}

/**
 * 解析当前策略对应的渲染配置与渲染缓存键。
 * 渲染键必须带上渲染配置的变体，否则同一用户在两套配置之间切换时
 * （例如从共享组织切到个人组织）会命中缓存而沿用旧颜色。
 */
export function resolveUserWatermarkRenderConfig(mode: UserWatermarkMode): {
	key: string
	config: WatermarkDataUrlOptions
} {
	if (mode === "platform") {
		const depth = platformWatermarkConfig?.depth ?? "light"
		return {
			key: depth,
			config: {
				...WATERMARK_DEPTH_CONFIG[depth],
				...(isMobileWatermarkViewport()
					? PLATFORM_WATERMARK_LAYOUT_CONFIG.mobile
					: PLATFORM_WATERMARK_LAYOUT_CONFIG.desktop),
			},
		}
	}

	// 环境变量开启的调试水印只做隐性溯源，个人组织与团队/企业组织统一用近乎透明的颜色。
	// 保留不同的渲染键，避免切换组织时命中缓存而沿用旧节点。
	return {
		key: currentIsPersonalOrganization ? "user-id" : "legacy",
		config: USER_ID_WATERMARK_CONFIG,
	}
}

if (typeof window !== "undefined") {
	;(window as any).watermarkService = watermarkService
}
function getUserWatermarkText(userInfo: User.UserInfo) {
	const id = userInfo.magic_id || userInfo.user_id
	const deploymentId = env("MAGIC_DEPLOYMENT_ID")
	if (!deploymentId) return id
	return `${id}-${deploymentId}`
}

function getPlatformWatermarkText(userInfo: User.UserInfo, config?: PlatformWatermarkConfig) {
	if (!config?.enabled) return ""
	const values: Partial<Record<PlatformWatermarkField, string>> = {
		real_name: userInfo.real_name || userInfo.nickname,
		employee_no: userInfo.employee_no,
		visit_time: formatWatermarkTime(new Date()),
		department: userInfo.department,
		phone: userInfo.phone,
		email: userInfo.email,
	}
	return config.fields
		.map((field) => values[field])
		.filter(Boolean)
		.join(" · ")
}

function formatWatermarkTime(date: Date) {
	const pad = (value: number) => String(value).padStart(2, "0")
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
		date.getHours(),
	)}:${pad(date.getMinutes())}`
}
export { watermarkService, defaultExtractOptions }
