/**
 * 视口缩放：统一 raw scale、fit 基线、相对/绝对百分比与步进档位的纯函数。
 * 不包含 Konva 或事件，仅负责数学与语义转换。
 */

export type ViewportZoomMode = "relative-fit" | "absolute-scale"

/** 读取显示用：仅需当前 scale 与 fit 基线 */
export type ViewportZoomReadState = {
	rawScale: number
	fitScale: number
}

/** 计算下一档：需要边界与步长 */
export type ViewportZoomState = ViewportZoomReadState & {
	minScale: number
	maxScale: number
}

export type ViewportZoomView = {
	rawScale: number
	fitScale: number
	/** 相对「适配屏幕 = 100%」的整数百分比（辅助口径） */
	relativePercent: number
	/** 相对 scale=1 的显示百分比（主 UI 口径） */
	absolutePercent: number
}

function roundPercent(percent: number, decimals: number): number {
	const factor = 10 ** decimals
	return Math.round(percent * factor) / factor
}

function getAbsolutePercentDisplayPrecision(percent: number): number {
	if (percent >= 1) {
		return 0
	}
	if (percent >= 0.1) {
		return 1
	}
	return 2
}

export function getFitScaleBaseline(fitScale: number): number {
	return fitScale > 0 ? fitScale : 1
}

export function roundRawScale(scale: number): number {
	return Math.round(scale * 10000) / 10000
}

export function clampScale(scale: number, minScale: number, maxScale: number): number {
	return Math.max(minScale, Math.min(maxScale, roundRawScale(scale)))
}

/** 相对 fit 的显示百分比（与历史 Zoom 显示一致：四舍五入，不设下限） */
export function toRelativePercentDisplay(rawScale: number, fitScale: number): number {
	const baseline = getFitScaleBaseline(fitScale)
	return Math.round((rawScale / baseline) * 100)
}

/** 相对 fit 的离散档位百分比（用于 +/- 步进桶，避免浮点回跳） */
export function toRelativePercentDiscrete(rawScale: number, fitScale: number): number {
	return Math.max(1, Math.round((rawScale / getFitScaleBaseline(fitScale)) * 100))
}

export function toAbsolutePercent(rawScale: number): number {
	const percent = rawScale * 100
	return roundPercent(percent, getAbsolutePercentDisplayPrecision(percent))
}

export function getZoomView(state: ViewportZoomReadState): ViewportZoomView {
	const { rawScale, fitScale } = state
	return {
		rawScale,
		fitScale,
		relativePercent: toRelativePercentDisplay(rawScale, fitScale),
		absolutePercent: toAbsolutePercent(rawScale),
	}
}

/** scale = fitBaseline * percent / 100 */
export function fromRelativePercent(percent: number, fitScale: number): number {
	const baseline = getFitScaleBaseline(fitScale)
	return roundRawScale((baseline * percent) / 100)
}

/** scale = percent / 100（即 scale=1 为 100%） */
export function fromAbsolutePercent(percent: number): number {
	return roundRawScale(percent / 100)
}

/**
 * 菜单「缩放至 50%」等：ratio 为相对 fit 的比例，如 0.5、1、2。
 */
export function scaleFromRelativeMenuRatio(ratio: number, fitScale: number): number {
	return fromRelativePercent(ratio * 100, fitScale)
}

function stepPercentFromScaleStep(scaleStep: number): number {
	return Math.max(1, Math.round(scaleStep * 100))
}

function getAbsolutePercentStep(currentPercent: number, baseStepPercent: number): number {
	if (currentPercent < 0.1) {
		return 0.01
	}
	if (currentPercent < 1) {
		return 0.1
	}
	if (currentPercent < baseStepPercent) {
		return 1
	}
	return baseStepPercent
}

function getStepPrecision(step: number): number {
	if (step < 0.1) {
		return 2
	}
	if (step < 1) {
		return 1
	}
	return 0
}

/**
 * 按语义与离散百分比步进计算下一档 raw scale。
 */
export function getNextZoomScale(options: {
	state: ViewportZoomState
	mode: ViewportZoomMode
	direction: 1 | -1
	scaleStep: number
}): number {
	const { rawScale, fitScale, minScale, maxScale } = options.state
	const stepPercent = stepPercentFromScaleStep(options.scaleStep)
	const direction = options.direction

	if (options.mode === "relative-fit") {
		const baseline = getFitScaleBaseline(fitScale)
		const currentPercent = toRelativePercentDiscrete(rawScale, fitScale)
		const nextPercent =
			direction > 0
				? Math.floor(currentPercent / stepPercent) * stepPercent + stepPercent
				: Math.ceil(currentPercent / stepPercent) * stepPercent - stepPercent
		return clampScale((baseline * nextPercent) / 100, minScale, maxScale)
	}

	const currentPercent = rawScale * 100
	const minPercent = Math.max(0, minScale * 100)
	const absoluteStep = getAbsolutePercentStep(currentPercent, stepPercent)
	const nextPercent =
		direction > 0
			? Math.floor(currentPercent / absoluteStep) * absoluteStep + absoluteStep
			: Math.max(
					minPercent,
					Math.ceil(currentPercent / absoluteStep) * absoluteStep - absoluteStep,
				)
	return clampScale(
		roundPercent(nextPercent / 100, getStepPrecision(absoluteStep) + 2),
		minScale,
		maxScale,
	)
}
