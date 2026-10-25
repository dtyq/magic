import {
	resolveResponsiveElementLayout,
	type LayoutRect,
	type ResponsiveElementLayoutMetrics,
	type ResponsiveLayoutMode,
} from "../../shared/layout/ResponsiveElementLayout"

/**
 * Storyboard 的逻辑设计尺寸。
 *
 * 这些值只描述元素坐标系内的排版，不包含 viewport zoom。Konva 在元素外层
 * 统一缩放最终内容，列表和输入区域则直接使用 resolver 计算出的真实 rect。
 */
/**
 * 分镜特有尺寸；间距 / 字阶 / 圆角走 ResponsiveElementLayout.design（ElementDesignTokens）。
 */
export const STORYBOARD_LAYOUT_DESIGN = {
	width: 1440,
	height: 2040,
	baseRem: 16,
	/** 对齐 title/body≈40 字阶；扣上下 inset 后仍够单行。 */
	parameterRowHeight: 92,
	parameterLabelWidth: 180,
	resolutionLabelWidth: 150,
	/** 与视频编辑底部控件左右 padding 同级。 */
	parameterHorizontalPadding: 20,
	parameterSuffixIconSize: 20,
	modelIconSize: 32,
	/** 参考图区固定单行高度；参考图数量通过横向滚动消化，不增加节点高度。 */
	referenceSectionHeight: 228,
	referenceThumbnailSize: 144,
	referenceScrollbarHeight: 8,
	addShotHeight: 92,
	footerButtonWidth: 220,
	footerButtonHeight: 84,
	// 分镜卡片固定内容高度：头区 + 描述区按大字阶留足输入空间。
	shotMinimumHeight: 400,
	shotHeaderHeight: 76,
	shotGenerateWidth: 220,
	/** 删除是轻量幽灵图标；命中区仍由交互层扩至 32/44。 */
	shotDeleteSize: 48,
	shotControlHeight: 68,
	/** 对齐视频编辑“主标题 + 次信息”的紧凑固定标题列。 */
	shotTitleWidth: 160,
	shotStatusWidth: 160,
	fontFamily: "Arial, PingFang SC, sans-serif",
} as const

const STORYBOARD_LAYOUT_SPEC = {
	designSize: {
		width: STORYBOARD_LAYOUT_DESIGN.width,
		height: STORYBOARD_LAYOUT_DESIGN.height,
	},
	baseRem: STORYBOARD_LAYOUT_DESIGN.baseRem,
	scale: {
		// Both axes participate in the preferred scale, while extra width/height is
		// intentionally left to the flexible regions instead of stretching controls.
		strategy: { type: "contain" as const },
		min: 0.6,
		max: 1.25,
	},
	mode: {
		compactBelow: 0.84,
		condensedBelow: 0.64,
	},
} as const

export interface StoryboardParameterLayout {
	rect: LayoutRect
	backgroundRect: LayoutRect
	labelRect: LayoutRect
	triggerRect: LayoutRect
	valueTextRect: LayoutRect
	suffixRect: LayoutRect
	modelIconRect?: LayoutRect
	modelIconGap: number
	showLabel: boolean
	horizontalPadding: number
	suffixGap: number
	suffixIconSize: number
	fontSize: number
	labelFontSize: number
	cornerRadius: number
}

export interface StoryboardShotControlsLayout {
	rect: LayoutRect
	scale: number
	generateRect: LayoutRect
	deleteRect: LayoutRect
}

export interface StoryboardShotLayout {
	rect: LayoutRect
	headerRect: LayoutRect
	titleRect: LayoutRect
	statusRect: LayoutRect
	headingGap: number
	descriptionRect: LayoutRect
	descriptionTextRect: LayoutRect
	controls: StoryboardShotControlsLayout
	fontSize: number
	smallFontSize: number
	cornerRadius: number
	strokeWidth: number
}

export interface StoryboardFooterLayout {
	rect: LayoutRect
	addShotRect: LayoutRect
	actionsRect: LayoutRect
	generateAllRect: LayoutRect
	generateAllScale: number
	buttonHeight: number
	cornerRadius: number
	strokeWidth: number
}

export interface StoryboardReferenceLayout {
	rect: LayoutRect
	titleRect: LayoutRect
	countRect: LayoutRect
	titleCountGap: number
	viewport: LayoutRect
	scrollbar: LayoutRect
	thumbnail: {
		width: number
		height: number
		gap: number
		cornerRadius: number
	}
}

export interface StoryboardElementLayout {
	width: number
	height: number
	mode: ResponsiveLayoutMode
	rootScale: number
	scale: number
	padding: number
	contentRect: LayoutRect
	settingsRect: LayoutRect
	parameterRows: {
		model: StoryboardParameterLayout
		aspectRatio: StoryboardParameterLayout
		resolution: StoryboardParameterLayout
		stacked: boolean
	}
	reference?: StoryboardReferenceLayout
	titleRect: LayoutRect
	showShotListTitle: boolean
	shotListRect: LayoutRect
	shotRowGap: number
	shotMinimumHeight: number
	shotLayouts: StoryboardShotLayout[]
	visibleShotCount: number
	footer: StoryboardFooterLayout
	fontFamily: string
	valueFontSize: number
	labelFontSize: number
	titleFontSize: number
	shotFontSize: number
	shotSmallFontSize: number
	parameterCornerRadius: number
}

/** compact/condensed 优先缩字号与控件，不再压 gap（避免间距尺度碎掉）。 */
function resolveControlDensity(mode: ResponsiveLayoutMode): number {
	switch (mode) {
		case "condensed":
			return 0.86
		case "compact":
			return 0.93
		default:
			return 1
	}
}

function resolveDimension(value: number): number {
	return Number.isFinite(value) ? Math.max(0, value) : 0
}

function resolveParameterLayout(options: {
	row: LayoutRect
	labelWidth: number
	showLabel: boolean
	modelIcon: boolean
	valueFontSize: number
	labelFontSize: number
	rootScale: number
	responsive: ResponsiveElementLayoutMetrics
}): StoryboardParameterLayout {
	const {
		row,
		labelWidth,
		showLabel,
		modelIcon,
		valueFontSize,
		labelFontSize,
		rootScale,
		responsive,
	} = options
	const { design } = responsive
	const horizontalPadding = STORYBOARD_LAYOUT_DESIGN.parameterHorizontalPadding * rootScale
	const suffixGap = design.gap.control
	const suffixIconSize = STORYBOARD_LAYOUT_DESIGN.parameterSuffixIconSize * rootScale
	const modelIconSize = STORYBOARD_LAYOUT_DESIGN.modelIconSize * rootScale
	const modelIconGap = design.gap.control
	const backgroundRect = responsive.insetRect(row, {
		top: design.space.xs,
		bottom: design.space.xs,
	})
	const contentRect = responsive.insetRect(row, {
		left: horizontalPadding,
		right: horizontalPadding,
	})
	const resolvedLabelWidth = showLabel ? Math.min(labelWidth, contentRect.width * 0.42) : 0
	const labelRect = {
		x: contentRect.x,
		y: contentRect.y,
		width: resolvedLabelWidth,
		height: contentRect.height,
	}
	const triggerRect = {
		x: contentRect.x + resolvedLabelWidth,
		y: contentRect.y,
		width: Math.max(1, contentRect.width - resolvedLabelWidth),
		height: contentRect.height,
	}
	const triggerContent = responsive.insetRect(triggerRect, {
		left: horizontalPadding,
		right: horizontalPadding,
	})
	const suffixRect = responsive.alignRect(
		{ width: suffixIconSize, height: suffixIconSize },
		triggerContent,
		{ inline: "end", block: "center" },
	)
	const iconRect = modelIcon
		? responsive.alignRect({ width: modelIconSize, height: modelIconSize }, triggerContent, {
				inline: "start",
				block: "center",
			})
		: undefined
	const textStart = iconRect ? iconRect.x + iconRect.width + modelIconGap : triggerContent.x
	const valueTextRect = responsive.constrainRect(
		{
			x: textStart,
			y: triggerContent.y + Math.max(0, (triggerContent.height - valueFontSize) / 2),
			width: Math.max(1, suffixRect.x - suffixGap - textStart),
			height: Math.min(triggerContent.height, Math.max(1, valueFontSize * 1.35)),
		},
		triggerContent,
	)

	return {
		rect: row,
		backgroundRect,
		labelRect,
		triggerRect,
		valueTextRect,
		suffixRect,
		modelIconRect: iconRect,
		modelIconGap,
		showLabel,
		horizontalPadding,
		suffixGap,
		suffixIconSize,
		fontSize: valueFontSize,
		labelFontSize,
		cornerRadius: design.radius.control,
	}
}

function resolveShotLayout(options: {
	card: LayoutRect
	rootScale: number
	fontSize: number
	smallFontSize: number
	showStatus: boolean
	responsive: ResponsiveElementLayoutMetrics
}): StoryboardShotLayout {
	const { card, rootScale, fontSize, smallFontSize, showStatus, responsive } = options
	const { design } = responsive
	const cardPadding = design.space.md
	const shotControlGapDesign = design.space.sm / Math.max(rootScale, 0.0001)
	const inner = responsive.insetRect(card, cardPadding)
	const headerHeight = Math.min(
		STORYBOARD_LAYOUT_DESIGN.shotHeaderHeight * rootScale,
		Math.max(1, inner.height * 0.4),
	)
	const headerRect = { ...inner, height: headerHeight }
	const controlsStart = inner.x + Math.min(inner.width * 0.34, 232 * rootScale)
	const controlsContainer = {
		x: controlsStart,
		y: headerRect.y,
		width: Math.max(1, inner.x + inner.width - controlsStart),
		height: headerRect.height,
	}
	const controlsFit = responsive.fitUniform(
		{
			width:
				STORYBOARD_LAYOUT_DESIGN.shotGenerateWidth +
				STORYBOARD_LAYOUT_DESIGN.shotDeleteSize +
				shotControlGapDesign,
			height: STORYBOARD_LAYOUT_DESIGN.shotControlHeight,
		},
		controlsContainer,
		{ preferredScale: rootScale, inline: "end", block: "center" },
	)
	const controlsScale = Math.max(0.01, controlsFit.scale)
	const controlsRect = controlsFit.rect
	const controlGap = shotControlGapDesign * controlsScale
	const generateWidth = STORYBOARD_LAYOUT_DESIGN.shotGenerateWidth * controlsScale
	const deleteSize = STORYBOARD_LAYOUT_DESIGN.shotDeleteSize * controlsScale
	const controlHeight = STORYBOARD_LAYOUT_DESIGN.shotControlHeight * controlsScale
	const generateRect = {
		x: controlsRect.x,
		y: controlsRect.y,
		width: generateWidth,
		height: controlHeight,
	}
	const deleteRect = {
		x: generateRect.x + generateRect.width + controlGap,
		y: controlsRect.y + (controlHeight - deleteSize) / 2,
		width: deleteSize,
		height: deleteSize,
	}
	const titleAvailableWidth = Math.max(1, controlsRect.x - inner.x - design.space.sm)
	const titleRect = {
		x: inner.x,
		y: headerRect.y + Math.max(0, (headerRect.height - fontSize) / 2),
		width: Math.min(STORYBOARD_LAYOUT_DESIGN.shotTitleWidth * rootScale, titleAvailableWidth),
		height: Math.min(headerRect.height, Math.max(1, fontSize * 1.35)),
	}
	// 渲染时按标题实际内容宽度 + content gap 放置状态文本。
	const statusStart = titleRect.x + titleRect.width
	const statusRect = showStatus
		? {
				x: statusStart,
				y: headerRect.y + Math.max(0, (headerRect.height - smallFontSize) / 2),
				width: Math.max(
					0,
					Math.min(
						STORYBOARD_LAYOUT_DESIGN.shotStatusWidth * rootScale,
						controlsRect.x - statusStart,
					),
				),
				height: Math.min(headerRect.height, Math.max(1, smallFontSize * 1.35)),
			}
		: { x: statusStart, y: headerRect.y, width: 0, height: 0 }
	const descriptionGap = design.space.sm
	const descriptionRect = {
		x: inner.x,
		y: headerRect.y + headerRect.height + descriptionGap,
		width: inner.width,
		height: Math.max(
			0,
			inner.y + inner.height - (headerRect.y + headerRect.height + descriptionGap),
		),
	}
	const descriptionHorizontalInset = Math.min(design.space.md, descriptionRect.width / 2)
	const descriptionVerticalInset = Math.min(design.space.sm, descriptionRect.height / 2)
	const descriptionTextRect = responsive.insetRect(descriptionRect, {
		left: descriptionHorizontalInset,
		right: descriptionHorizontalInset,
		top: descriptionVerticalInset,
		bottom: descriptionVerticalInset,
	})

	return {
		rect: card,
		headerRect,
		titleRect,
		statusRect,
		headingGap: design.gap.content,
		descriptionRect,
		descriptionTextRect,
		controls: {
			rect: controlsRect,
			scale: controlsScale,
			generateRect,
			deleteRect,
		},
		fontSize,
		smallFontSize,
		cornerRadius: design.radius.card,
		strokeWidth: Math.max(1, rootScale),
	}
}

/**
 * 解析 Storyboard 的完整逻辑坐标布局。
 *
 * 设置区和底部操作区是固定区，分镜列表占据二者之间的真实可用 rect。
 * Storyboard 的持久化高度应由 resolveStoryboardRequiredHeight 预先归一化；
 * visibleShotCount 仅作为旧数据尚未归一化时的安全裁剪，不再渲染溢出提示。
 */
export function resolveStoryboardElementLayout(
	width: number,
	height: number,
	shotCount: number,
	referenceCount = 0,
): StoryboardElementLayout {
	const responsive = resolveResponsiveElementLayout(
		{ width: resolveDimension(width), height: resolveDimension(height) },
		STORYBOARD_LAYOUT_SPEC,
	)
	const widthValue = responsive.width
	const heightValue = responsive.height
	const controlDensity = resolveControlDensity(responsive.mode)
	const scale = responsive.scale
	const { design } = responsive
	const px = (value: number) => value * scale
	const bounds = responsive.bounds
	const padding = responsive.clamp(
		design.pad.section,
		Math.min(widthValue, heightValue) * 0.03,
		design.pad.sectionInline,
	)
	const contentRect = responsive.insetRect(bounds, padding)
	const showParameterLabels = responsive.mode !== "condensed"
	// label / value 同档 caption，与视频编辑底部参数控件对齐。
	const valueFontSize = design.type.caption * controlDensity
	const labelFontSize = valueFontSize
	// 分镜区标题、item 标题与右侧状态统一对齐视频编辑区块标题层级。
	const titleFontSize = design.type.caption * controlDensity
	const shotFontSize = design.type.caption * controlDensity
	const shotSmallFontSize = design.type.caption * controlDensity
	const parameterRowHeight = px(STORYBOARD_LAYOUT_DESIGN.parameterRowHeight) * controlDensity
	// 参数行距跟共享 control gap，匹配大字阶行高；不再乘 density。
	const parameterGap = design.gap.control
	const parameterColumnGap = design.pad.sectionInline
	const modelLabelWidth = px(STORYBOARD_LAYOUT_DESIGN.parameterLabelWidth)
	const resolutionLabelWidth = px(STORYBOARD_LAYOUT_DESIGN.resolutionLabelWidth)
	const modelRow: LayoutRect = {
		x: contentRect.x,
		y: contentRect.y,
		width: contentRect.width,
		height: parameterRowHeight,
	}
	const detailStartY = modelRow.y + modelRow.height + parameterGap
	const useStackedParameters = contentRect.width < px(600)
	const detailWidth = useStackedParameters
		? contentRect.width
		: Math.max(1, (contentRect.width - parameterColumnGap) / 2)
	const aspectRow: LayoutRect = {
		x: contentRect.x,
		y: detailStartY,
		width: detailWidth,
		height: parameterRowHeight,
	}
	const resolutionRow: LayoutRect = useStackedParameters
		? {
				x: contentRect.x,
				y: detailStartY + parameterRowHeight + parameterGap,
				width: detailWidth,
				height: parameterRowHeight,
			}
		: {
				x: contentRect.x + detailWidth + parameterColumnGap,
				y: detailStartY,
				width: detailWidth,
				height: parameterRowHeight,
			}
	const detailBottom = resolutionRow.y + resolutionRow.height
	const normalizedReferenceCount = Math.max(0, Math.floor(referenceCount))
	const showReference = normalizedReferenceCount > 0
	const referenceTitleHeight = Math.min(contentRect.height, titleFontSize * 1.4)
	const referenceThumbnailSize = Math.min(
		px(STORYBOARD_LAYOUT_DESIGN.referenceThumbnailSize),
		Math.max(1, contentRect.width),
	)
	const referenceScrollbarHeight = px(STORYBOARD_LAYOUT_DESIGN.referenceScrollbarHeight)
	const referenceContentGap = design.gap.content
	const referenceScrollbarGap = design.gap.control
	const referenceSectionHeight = showReference
		? Math.max(
				px(STORYBOARD_LAYOUT_DESIGN.referenceSectionHeight),
				referenceTitleHeight +
					referenceContentGap +
					referenceThumbnailSize +
					referenceScrollbarGap +
					referenceScrollbarHeight,
			)
		: 0
	const referenceRect = showReference
		? {
				x: contentRect.x,
				y: detailBottom + design.gap.section,
				width: contentRect.width,
				height: referenceSectionHeight,
			}
		: undefined
	const reference: StoryboardReferenceLayout | undefined = referenceRect
		? {
				rect: referenceRect,
				titleRect: {
					x: referenceRect.x,
					y: referenceRect.y,
					width: Math.max(0, referenceRect.width * 0.55),
					height: referenceTitleHeight,
				},
				countRect: {
					x: referenceRect.x + referenceRect.width * 0.55,
					y: referenceRect.y,
					width: Math.max(0, referenceRect.width * 0.45),
					height: referenceTitleHeight,
				},
				titleCountGap: design.gap.content,
				viewport: {
					x: referenceRect.x,
					y: referenceRect.y + referenceTitleHeight + referenceContentGap,
					width: referenceRect.width,
					height: referenceThumbnailSize,
				},
				scrollbar: {
					x: referenceRect.x,
					y:
						referenceRect.y +
						referenceTitleHeight +
						referenceContentGap +
						referenceThumbnailSize +
						referenceScrollbarGap,
					width: referenceRect.width,
					height: referenceScrollbarHeight,
				},
				thumbnail: {
					width: referenceThumbnailSize,
					height: referenceThumbnailSize,
					gap: design.space.md,
					cornerRadius: design.radius.card,
				},
			}
		: undefined
	// 参数区 / 参考图区 → 标题只保留一个 section gap；不再用分割线叠加两段留白。
	const titleTop =
		(referenceRect ? referenceRect.y + referenceRect.height : detailBottom) + design.gap.section
	const titleRect = {
		x: contentRect.x,
		y: titleTop,
		width: contentRect.width,
		height: Math.min(contentRect.height, titleFontSize * 1.4),
	}
	const titleToListGap = design.gap.content
	const shotListTop = titleRect.y + titleRect.height + titleToListGap

	const footerButtonHeight = px(STORYBOARD_LAYOUT_DESIGN.footerButtonHeight) * controlDensity
	const addShotHeight = px(STORYBOARD_LAYOUT_DESIGN.addShotHeight) * controlDensity
	// 全部生成贴 contentRect 底；与添加分镜的间距等于元素 padding，
	// 这样按钮到元素底边不再多叠一段 gap。
	const footerGap = padding
	const footerHeight = addShotHeight + footerGap + footerButtonHeight
	const footerContainerY = Math.min(shotListTop, contentRect.y + contentRect.height)
	const footerContainer = {
		x: contentRect.x,
		y: footerContainerY,
		width: contentRect.width,
		height: Math.max(0, contentRect.y + contentRect.height - footerContainerY),
	}
	const footerFit = responsive.fitUniform(
		{
			// The footer stretches across the content width. Its height is the only
			// dimension that needs to shrink when an old/invalid document is too short.
			width: contentRect.width / Math.max(scale, 0.0001),
			height: footerHeight / Math.max(scale, 0.0001),
		},
		footerContainer,
		{ preferredScale: scale, inline: "start", block: "end" },
	)
	const footerScaleRatio = scale > 0 ? footerFit.scale / scale : 0
	const footerRect = footerFit.rect
	const resolvedFooterButtonHeight = footerButtonHeight * footerScaleRatio
	const resolvedAddShotHeight = addShotHeight * footerScaleRatio
	const resolvedFooterGap = footerGap * footerScaleRatio
	const addShotRect = {
		x: footerRect.x,
		y: footerRect.y,
		width: footerRect.width,
		height: resolvedAddShotHeight,
	}
	const actionsRect = {
		x: footerRect.x,
		y: footerRect.y + resolvedAddShotHeight + resolvedFooterGap,
		width: footerRect.width,
		height: resolvedFooterButtonHeight,
	}
	const generateFit = responsive.fitUniform(
		{
			width: STORYBOARD_LAYOUT_DESIGN.footerButtonWidth,
			height: STORYBOARD_LAYOUT_DESIGN.footerButtonHeight,
		},
		actionsRect,
		{ preferredScale: footerFit.scale, inline: "end", block: "center" },
	)
	const generateAllRect = responsive.constrainRect(generateFit.rect, actionsRect)
	const footer: StoryboardFooterLayout = {
		rect: footerRect,
		addShotRect,
		actionsRect,
		generateAllRect,
		generateAllScale: generateFit.scale,
		buttonHeight: generateAllRect.height,
		cornerRadius: design.radius.control * (generateFit.scale / Math.max(scale, 0.0001)),
		strokeWidth: Math.max(1, scale),
	}

	const shotListRect = responsive.constrainRect(
		{
			x: contentRect.x,
			y: shotListTop,
			width: contentRect.width,
			height: Math.max(0, footerRect.y - titleToListGap - shotListTop),
		},
		contentRect,
	)
	const shotRowGap = design.gap.section
	const shotMinimumHeight = px(STORYBOARD_LAYOUT_DESIGN.shotMinimumHeight)
	const normalizedShotCount = Math.max(0, Math.floor(shotCount))
	const canRenderShots = shotListRect.height > 0
	const maxVisibleShotCount = canRenderShots
		? Math.max(
				1,
				Math.floor((shotListRect.height + shotRowGap) / (shotMinimumHeight + shotRowGap)),
			)
		: 0
	const visibleShotCount = Math.min(normalizedShotCount, maxVisibleShotCount)
	const cardsHeight = shotListRect.height
	const cardHeight = visibleShotCount
		? Math.min(
				shotMinimumHeight,
				Math.max(0, cardsHeight - shotRowGap * Math.max(0, visibleShotCount - 1)),
			)
		: 0
	const shotLayouts: StoryboardShotLayout[] = []
	for (let index = 0; index < visibleShotCount; index += 1) {
		const card = {
			x: shotListRect.x,
			y: shotListRect.y + index * (cardHeight + shotRowGap),
			width: shotListRect.width,
			height: cardHeight,
		}
		shotLayouts.push(
			resolveShotLayout({
				card,
				rootScale: scale,
				fontSize: shotFontSize,
				smallFontSize: shotSmallFontSize,
				showStatus: responsive.mode === "regular",
				responsive,
			}),
		)
	}
	return {
		width: widthValue,
		height: heightValue,
		mode: responsive.mode,
		rootScale: responsive.scale,
		scale,
		padding,
		contentRect,
		settingsRect: {
			x: contentRect.x,
			y: contentRect.y,
			width: contentRect.width,
			height: Math.max(0, titleRect.y + titleRect.height - contentRect.y),
		},
		parameterRows: {
			model: resolveParameterLayout({
				row: modelRow,
				labelWidth: modelLabelWidth,
				showLabel: showParameterLabels,
				modelIcon: true,
				valueFontSize,
				labelFontSize,
				rootScale: scale,
				responsive,
			}),
			aspectRatio: resolveParameterLayout({
				row: aspectRow,
				labelWidth: modelLabelWidth,
				showLabel: showParameterLabels,
				modelIcon: false,
				valueFontSize,
				labelFontSize,
				rootScale: scale,
				responsive,
			}),
			resolution: resolveParameterLayout({
				row: resolutionRow,
				labelWidth: resolutionLabelWidth,
				showLabel: showParameterLabels,
				modelIcon: false,
				valueFontSize,
				labelFontSize,
				rootScale: scale,
				responsive,
			}),
			stacked: useStackedParameters,
		},
		reference,
		titleRect,
		showShotListTitle: titleRect.height > 0,
		shotListRect,
		shotRowGap,
		shotMinimumHeight,
		shotLayouts,
		visibleShotCount,
		footer,
		fontFamily: STORYBOARD_LAYOUT_DESIGN.fontFamily,
		valueFontSize,
		labelFontSize,
		titleFontSize,
		shotFontSize,
		shotSmallFontSize,
		parameterCornerRadius: design.radius.control,
	}
}

/**
 * 根据 Storyboard 宽度和镜头数量计算确定性的内容高度。
 *
 * 默认设计高度始终作为下限。由于现有响应式 scale 同时受 width/height 影响，
 * 这里通过单调容量搜索找到能够完整容纳全部固定高度卡片的最小整数高度，避免
 * 使用 `currentHeight += step` 造成重复执行、历史恢复或旧数据加载后的累计漂移。
 */
export function resolveStoryboardRequiredHeight(
	width: number,
	shotCount: number,
	referenceCount = 0,
): number {
	const minimumHeight: number = STORYBOARD_LAYOUT_DESIGN.height
	const normalizedShotCount = Math.max(0, Math.floor(shotCount))
	if (normalizedShotCount === 0) return minimumHeight

	const fits = (height: number): boolean =>
		resolveStoryboardElementLayout(width, height, normalizedShotCount, referenceCount)
			.visibleShotCount >= normalizedShotCount

	if (fits(minimumHeight)) return minimumHeight

	let lower: number = minimumHeight
	let upper: number = minimumHeight
	for (let index = 0; index < 32 && !fits(upper); index += 1) {
		lower = upper
		upper = Math.max(upper + 1, upper * 2)
	}

	while (lower + 1 < upper) {
		const middle = Math.floor((lower + upper) / 2)
		if (fits(middle)) upper = middle
		else lower = middle
	}

	return Math.ceil(upper)
}
