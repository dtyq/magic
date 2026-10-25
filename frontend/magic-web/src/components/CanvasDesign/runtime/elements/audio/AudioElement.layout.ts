import {
	resolveResponsiveElementLayout,
	type LayoutRect,
	type ResponsiveLayoutMode,
} from "../../shared/layout/ResponsiveElementLayout"

export const AUDIO_PLAYER_DESIGN = {
	width: 1280,
	height: 720,
	baseRem: 16,
	waveformHeight: 224,
	waveformHorizontalPaddingRatio: 0.05,
	progressHorizontalPaddingRatio: 0.0375,
	waveformTopPadding: 32,
	waveformToControlsGap: 36,
	controlStackWidth: 304,
	controlStackHeight: 154,
	controlStackLift: 24,
	progressHeight: 14,
	progressThumbRadius: 11,
	progressHitOffsetY: 12,
	progressHitHeight: 32,
	progressToTimeOffset: 24,
	timeToOperationsOffset: 74,
	operationButtonSize: 80,
	operationGap: 32,
	errorToProgressGap: 32,
	bottomPadding: 40,
	waveformBarWidth: 8,
	waveformBarPitch: 16,
	waveformMinBarHeight: 4,
	waveformPlayheadWidth: 4,
	waveformPlayheadTriangleWidth: 16,
	waveformPlayheadTriangleHeight: 10,
	operationIconReferenceButtonSize: 44,
	statusSpinnerRadius: 20,
	statusSpinnerStrokeWidth: 4,
	statusSpinnerToTextGap: 20,
	statusTextLineHeight: 1.3,
} as const

export interface AudioPlayerLayout {
	mode: ResponsiveLayoutMode
	rootScale: number
	waveform: LayoutRect
	progress: LayoutRect
	progressThumbRadius: number
	progressHit: LayoutRect
	time: { x: number; y: number; width: number; fontSize: number }
	error: { x: number; y: number; width: number; fontSize: number }
	operations: LayoutRect & { buttonSize: number; gap: number; scale: number }
	waveformStyle: {
		barWidth: number
		barPitch: number
		minBarHeight: number
		playheadWidth: number
		playheadTriangleWidth: number
		playheadTriangleHeight: number
	}
}

export interface AudioStatusPlaceholderLayout {
	group: LayoutRect
	spinner: { x: number; y: number; radius: number; strokeWidth: number }
	text: { x: number; y: number; width: number; fontSize: number; lineHeight: number }
}

const AUDIO_LAYOUT_SPEC = {
	designSize: { width: AUDIO_PLAYER_DESIGN.width, height: AUDIO_PLAYER_DESIGN.height },
	baseRem: AUDIO_PLAYER_DESIGN.baseRem,
	scale: {
		strategy: { type: "weighted" as const, inlineWeight: 0.25 },
		min: 0.6,
		max: 1.35,
	},
	mode: {
		compactBelow: 0.8,
		condensedBelow: 0.5,
	},
} as const

/** Audio 的排版规则只使用元素逻辑宽高；画布 zoom 不参与计算。 */
export function resolveAudioPlayerLayout(width: number, height: number): AudioPlayerLayout {
	const layout = resolveResponsiveElementLayout({ width, height }, AUDIO_LAYOUT_SPEC)
	const waveformPadding = layout.clamp(
		layout.rem(1.5),
		layout.width * AUDIO_PLAYER_DESIGN.waveformHorizontalPaddingRatio,
		layout.rem(4),
	)
	const progressPadding = layout.clamp(
		layout.rem(1.5),
		layout.width * AUDIO_PLAYER_DESIGN.progressHorizontalPaddingRatio,
		layout.rem(3),
	)
	const bottomPadding = layout.designPx(AUDIO_PLAYER_DESIGN.bottomPadding)
	const controlContainer = {
		x: progressPadding,
		y: 0,
		width: Math.max(0, layout.width - progressPadding * 2),
		height: Math.max(0, layout.height - bottomPadding),
	}
	const controlFit = layout.fitUniform(
		{
			width: AUDIO_PLAYER_DESIGN.controlStackWidth,
			height: AUDIO_PLAYER_DESIGN.controlStackHeight,
		},
		controlContainer,
		{ preferredScale: layout.scale, inline: "center", block: "end" },
	)
	const controlScale = controlFit.scale
	const controlStackLift = AUDIO_PLAYER_DESIGN.controlStackLift * controlScale
	const progressY = Math.max(0, controlFit.rect.y - controlStackLift)
	const progressHeight = AUDIO_PLAYER_DESIGN.progressHeight * controlScale
	const progressRect = {
		x: progressPadding,
		y: progressY,
		width: Math.max(0, layout.width - progressPadding * 2),
		height: progressHeight,
	}
	const progressHitHeight = AUDIO_PLAYER_DESIGN.progressHitHeight * controlScale
	const progressHitY = progressY - AUDIO_PLAYER_DESIGN.progressHitOffsetY * controlScale
	const operationButtonSize = AUDIO_PLAYER_DESIGN.operationButtonSize * controlScale
	const operationGap = AUDIO_PLAYER_DESIGN.operationGap * controlScale
	const operationsWidth = operationButtonSize * 3 + operationGap * 2
	const operationsY = progressY + AUDIO_PLAYER_DESIGN.timeToOperationsOffset * controlScale
	const timeY = progressY + AUDIO_PLAYER_DESIGN.progressToTimeOffset * controlScale
	const errorY = Math.max(0, progressY - AUDIO_PLAYER_DESIGN.errorToProgressGap * controlScale)

	const waveformTopPadding = layout.designPx(AUDIO_PLAYER_DESIGN.waveformTopPadding)
	const waveformGap = layout.designPx(AUDIO_PLAYER_DESIGN.waveformToControlsGap)
	// 控件组可独立小幅上移，但不改变波形区域的垂直排版。
	const waveformBottom = Math.max(waveformTopPadding, controlFit.rect.y - waveformGap)
	const waveformContainer = {
		x: waveformPadding,
		y: waveformTopPadding,
		width: Math.max(0, layout.width - waveformPadding * 2),
		height: Math.max(0, waveformBottom - waveformTopPadding),
	}
	const desiredWaveformHeight = layout.designPx(AUDIO_PLAYER_DESIGN.waveformHeight)
	const centeredWaveform = layout.alignRect(
		{
			width: waveformContainer.width,
			height: Math.min(desiredWaveformHeight, waveformContainer.height),
		},
		waveformContainer,
		{ inline: "center", block: "center" },
	)
	const waveformRect = layout.constrainRect(centeredWaveform, waveformContainer)
	const waveformScale =
		AUDIO_PLAYER_DESIGN.waveformHeight > 0
			? Math.min(layout.scale, waveformRect.height / AUDIO_PLAYER_DESIGN.waveformHeight)
			: layout.scale

	return {
		mode: layout.mode,
		rootScale: layout.scale,
		waveform: waveformRect,
		progress: progressRect,
		progressThumbRadius: AUDIO_PLAYER_DESIGN.progressThumbRadius * controlScale,
		progressHit: {
			x: progressRect.x,
			y: progressHitY,
			width: progressRect.width,
			height: progressHitHeight,
		},
		time: {
			x: progressRect.x,
			y: timeY,
			width: progressRect.width,
			// 时长比 display 小一档用 title，且不低于 caption，避免被 controlScale 压没。
			fontSize: layout.design.minType(
				layout.design.type.title * (controlScale / Math.max(layout.scale, 0.0001)),
				"caption",
			),
		},
		error: {
			x: progressRect.x,
			y: errorY,
			width: progressRect.width,
			fontSize: layout.design.minType(
				layout.design.type.caption * (controlScale / Math.max(layout.scale, 0.0001)),
				"caption",
			),
		},
		operations: {
			x: (layout.width - operationsWidth) / 2,
			y: operationsY,
			width: operationsWidth,
			height: operationButtonSize,
			buttonSize: operationButtonSize,
			gap: operationGap,
			scale: controlScale,
		},
		waveformStyle: {
			barWidth: AUDIO_PLAYER_DESIGN.waveformBarWidth * waveformScale,
			barPitch: AUDIO_PLAYER_DESIGN.waveformBarPitch * waveformScale,
			minBarHeight: AUDIO_PLAYER_DESIGN.waveformMinBarHeight * waveformScale,
			playheadWidth: AUDIO_PLAYER_DESIGN.waveformPlayheadWidth * waveformScale,
			playheadTriangleWidth:
				AUDIO_PLAYER_DESIGN.waveformPlayheadTriangleWidth * waveformScale,
			playheadTriangleHeight:
				AUDIO_PLAYER_DESIGN.waveformPlayheadTriangleHeight * waveformScale,
		},
	}
}

export function resolveAudioStatusPlaceholderLayout(
	width: number,
	height: number,
	options?: { showSpinner?: boolean },
): AudioStatusPlaceholderLayout {
	const layout = resolveResponsiveElementLayout({ width, height }, AUDIO_LAYOUT_SPEC)
	const scale = layout.scale
	const showSpinner = options?.showSpinner ?? true
	const radius = AUDIO_PLAYER_DESIGN.statusSpinnerRadius * scale
	const strokeWidth = AUDIO_PLAYER_DESIGN.statusSpinnerStrokeWidth * scale
	const gap = AUDIO_PLAYER_DESIGN.statusSpinnerToTextGap * scale
	const fontSize = layout.design.type.display
	const lineHeight = AUDIO_PLAYER_DESIGN.statusTextLineHeight
	const textHeight = fontSize * lineHeight
	const contentHeight = showSpinner ? radius * 2 + gap + textHeight : textHeight

	return {
		group: {
			x: 0,
			y: Math.max(0, (height - contentHeight) / 2),
			width,
			height: Math.min(height, contentHeight),
		},
		spinner: {
			x: width / 2,
			y: radius,
			radius,
			strokeWidth,
		},
		text: {
			x: 0,
			y: showSpinner ? radius * 2 + gap : 0,
			width,
			fontSize,
			lineHeight,
		},
	}
}
