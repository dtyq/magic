import Konva from "konva"
import { ElementTypeEnum } from "../../document/types"
import {
	getActiveContent,
	getActiveImageContent,
	isImageElementContent,
} from "../../document/elementContent"
import { GenerationStatus } from "../../../public/magic-types"
import {
	BaseLabelManager,
	type BaseLabelManagerConfig,
	type LabelLayoutSyncContext,
	type LabelSize,
} from "./BaseLabelManager"
import {
	NAME_LABEL_COMPLIANCE_HIT_NAME,
	NAME_LABEL_GROUP_PREFIX,
	NAME_LABEL_HIT_NAME,
	NAME_LABEL_ICON_NAME,
	NAME_LABEL_RENAME_HIT_NAME,
	NAME_LABEL_RENAME_ICON_NAME,
	NAME_LABEL_SUFFIX_NAME,
	NAME_LABEL_TEXT_NAME,
} from "./nameLabelNodeUtils"
import type { Canvas } from "../../core/Canvas"
import type { CanvasEventMap } from "../../core/EventEmitter"
import type { NameLabelContent } from "../../elements/core/BaseElement"
import type { NameLabelIconContext, NameLabelIconResolver } from "./nameLabelTypes"
import {
	NameLabelTooltipController,
	type NameLabelTooltipContent,
} from "./NameLabelTooltipController"
import {
	getMediaAssetId,
	resolveMediaComplianceFailedReason,
	resolveMediaComplianceStatus,
	type MediaComplianceContentLike,
} from "../../resources/asset/assetComplianceState"
import { getCanvasResourceFileName } from "../../shared/path/canvasResourcePath"
import type { MediaLabelLayout } from "./mediaLabelLayout"
import { STANDARD_TRANSFORMER_STYLE } from "../frame/FrameEditorShared"

/**
 * 名称标签配置
 */
const NAME_LABEL_CONFIG = {
	/** 字体大小（像素） */
	FONT_SIZE: 12,
	/** 文本颜色 */
	TEXT_COLOR: "#737373",
	/** 字体族 */
	FONT_FAMILY: "Arial, sans-serif",
	/** 标签距离元素顶部的距离（像素） */
	OFFSET_TOP: 5,
	/** 为元素顶部外侧的 Transformer 角点保留视觉安全间距。 */
	CONTROL_CLEARANCE: STANDARD_TRANSFORMER_STYLE.ANCHOR_SIZE / 2,
	/** 标签左侧对齐偏移（像素） */
	OFFSET_LEFT: 0,
	/** 透明命中区相对文字的内边距，避免短名称难以点中 */
	HIT_PADDING: 2,
	/** icon 与文本之间的默认间距（标签局部坐标） */
	ICON_GAP: 2,
	/** 文本宽度变化达到该粒度时才重新布局，避免缩放每帧触发文本重排 */
	TEXT_WIDTH_BUCKET: 2,
	/** 名称标签与右侧尺寸标签之间的最小间距（标签局部坐标） */
	LABEL_GAP: 4,
	/** 让 size label 在边界附近保持稳定，避免缩放时反复切换可见性 */
	SIZE_LABEL_PRIORITY_EPSILON: 2,
	/** 状态后缀与主名称、右侧操作区使用相同的视觉间距。 */
	SUFFIX_GAP: 4,
	STATUS_FONT_RATIO: 5 / 6,
	STATUS_PADDING_X: 4,
	STATUS_PADDING_Y: 2,
	/** 省略后仍保留的最小文本宽度，避免标签节点宽度为 0 */
	MIN_TEXT_WIDTH: 1,
	/** 图片重命名按钮的固定局部宽度，屏幕宽度由媒体行比例统一控制 */
	RENAME_BUTTON_WIDTH: 24,
	/** 名称内容与重命名按钮之间的局部间距，与状态后缀两侧保持一致。 */
	RENAME_GAP: 4,
	/** 按钮总预算包含名称与按钮之间的间距 */
	RENAME_OPERATION_WIDTH: 28,
	/** 铅笔图标的可见尺寸，命中区仍保持 24px */
	RENAME_ICON_SIZE: 14,
	/** hover 时显示的轻量按钮底色；未 hover 时按钮保持透明但仍接收命中 */
	RENAME_BUTTON_HOVER_FILL: "#F2F2F2",
	RENAME_BUTTON_TRANSPARENT_FILL: "rgba(0, 0, 0, 0.001)",
	RENAME_BUTTON_RADIUS: 4,
} as const

interface NameLabelLayoutState {
	iconKey: string | null
	iconWidth: number
	iconHeight: number
	iconGap: number
	iconVisible: boolean
	canRename: boolean
	showOperation: boolean
	textOffsetX: number
	naturalTextWidth: number
	textWidth: number
	/** Width of the text that Konva actually draws after applying ellipsis. */
	renderedTextWidth: number
	complianceFailed: boolean
	complianceFailedReason: string | null
	suffixText: string
	suffixNaturalTextWidth: number
	suffixHeight: number
	suffixOffsetX: number
	sizeLabelSuppressedByName: boolean
	canRenderText: boolean
}

/**
 * 名称标签管理器
 * 职责：
 * 1. 在独立的 Layer 上渲染所有元素的名称标签
 * 2. 监听元素变化，同步更新名称标签
 * 3. 管理名称标签的可见性（媒体标签默认按 hover/选中显示，可通过画布设置常驻）
 * 4. 处理名称标签的位置和缩放
 * 5. 选择工具下命中名称：hover 手势、单击选中；通过 Konva 铅笔按钮进入重命名
 */
export class NameLabelManager extends BaseLabelManager {
	private renamingElementId: string | null = null
	private interactionUnsubscribers: Array<() => void> = []
	private pointerHoverElementId: string | null = null
	private canvasHoverElementId: string | null = null
	private readonly iconResolver?: NameLabelIconResolver
	private readonly labelLayoutStates = new WeakMap<Konva.Group, NameLabelLayoutState>()
	private readonly tooltipController: NameLabelTooltipController
	private renameHoverElementId: string | null = null

	constructor(options: { canvas: Canvas; iconResolver?: NameLabelIconResolver }) {
		const { canvas } = options
		// 构建基类配置
		const baseConfig: BaseLabelManagerConfig = {
			canvas,
			labelConfig: {
				fontSize: NAME_LABEL_CONFIG.FONT_SIZE,
				textColor: NAME_LABEL_CONFIG.TEXT_COLOR,
				fontFamily: NAME_LABEL_CONFIG.FONT_FAMILY,
				offsetTop: NAME_LABEL_CONFIG.OFFSET_TOP,
				offsetLeft: NAME_LABEL_CONFIG.OFFSET_LEFT,
			},
			visibilityConfig: {
				// 菜单允许重命名的元素都提供同一套名称标签入口。常驻标签仍只保留在
				// 原有容器/音频/生成节点上，其余类型只在 hover 或选中时挂载，避免扩大
				// 10k 元素场景下的常驻 Overlay 工作集。
				elementTypes: new Set(Object.values(ElementTypeEnum)),
				// Frame、Audio 和函数型分镜节点始终显示名称。
				alwaysVisibleTypes: new Set([
					ElementTypeEnum.Frame,
					ElementTypeEnum.Audio,
					ElementTypeEnum.Storyboard,
					ElementTypeEnum.VideoEdit,
				]),
				// 图片、视频和普通元素在选中或 hover 时显示。
				hoverOrSelectTypes: new Set([
					ElementTypeEnum.Image,
					ElementTypeEnum.Video,
					ElementTypeEnum.Group,
					ElementTypeEnum.Text,
					ElementTypeEnum.Rectangle,
					ElementTypeEnum.Ellipse,
					ElementTypeEnum.Triangle,
					ElementTypeEnum.Star,
				]),
				// “媒体标签常驻”只影响图片和视频，普通元素不会因该设置批量挂载标签。
				alwaysVisibleWhenMediaLabelsEnabledTypes: new Set([
					ElementTypeEnum.Image,
					ElementTypeEnum.Video,
				]),
			},
		}

		super(baseConfig)
		this.iconResolver = options.iconResolver
		this.tooltipController = new NameLabelTooltipController(canvas)
		this.setupInteractionListeners()
	}

	public setRenamingElementId(elementId: string | null): void {
		const previousElementId = this.renamingElementId
		this.renamingElementId = elementId
		this.hideTooltip()

		if (previousElementId) {
			this.updateLabelVisibility(previousElementId)
		}
		if (elementId) {
			this.updateLabelVisibility(elementId)
		}
	}

	/**
	 * 获取标签文本
	 */
	protected getLabelText(elementId: string): string {
		return this.getLabelContent(elementId).primaryText
	}

	private getLabelContent(elementId: string): NameLabelContent {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) return { primaryText: "" }

		// The fallback keeps lightweight test doubles and older integrations
		// compatible while real elements use the structured runtime content.
		const content = element.getNameLabelContent?.()
		return content ?? { primaryText: element.getNameLabelText?.() || "" }
	}

	protected override createOrUpdateLabel(
		elementId: string,
		options?: {
			skipReorder?: boolean
			skipNotify?: boolean
			skipBatchDraw?: boolean
			forceCreate?: boolean
		},
		context?: LabelLayoutSyncContext,
	): boolean {
		const labelGroup = this.labelMap.get(elementId)
		if (labelGroup) {
			this.syncLabelContent(elementId, labelGroup)
		}
		return super.createOrUpdateLabel(elementId, options, context)
	}

	protected override getLabelGap(): number {
		return NAME_LABEL_CONFIG.LABEL_GAP
	}

	/**
	 * Share the cached icon footprint with the media row calculator. Resolving the icon itself is
	 * intentionally kept out of this method so pan/zoom never invokes a user supplied resolver.
	 */
	protected override getLabelLeadingSize(elementId: string): LabelSize {
		const labelGroup = this.labelMap.get(elementId)
		const state = labelGroup ? this.labelLayoutStates.get(labelGroup) : undefined
		if (!state || state.iconKey === null) return { width: 0, height: 0 }
		return {
			width: state.iconWidth + state.iconGap,
			height: state.iconHeight,
		}
	}

	protected override getLabelOperationScreenWidth(elementId: string): number {
		return (this.canvas.elementRenameManager?.canRename(elementId) ?? false)
			? NAME_LABEL_CONFIG.RENAME_OPERATION_WIDTH
			: 0
	}

	protected override createLabel(elementId: string): Konva.Group {
		const labelGroup = new Konva.Group({
			listening: this.areNameLabelsInteractive(),
			visible: false,
			name: `${NAME_LABEL_GROUP_PREFIX}${elementId}`,
		})
		const textNode = new Konva.Text({
			name: NAME_LABEL_TEXT_NAME,
			text: "",
			fontSize: this.labelConfig.fontSize,
			fontFamily: this.labelConfig.fontFamily,
			fill: this.labelConfig.textColor,
			wrap: "none",
			ellipsis: true,
			listening: false,
		})
		const hitRect = new Konva.Rect({
			name: NAME_LABEL_HIT_NAME,
			fill: "rgba(0, 0, 0, 0.001)",
			listening: this.areNameLabelsInteractive(),
		})
		labelGroup.add(hitRect)
		labelGroup.add(textNode)
		this.labelLayoutStates.set(labelGroup, {
			iconKey: null,
			iconWidth: 0,
			iconHeight: 0,
			iconGap: 0,
			iconVisible: false,
			canRename: false,
			showOperation: false,
			textOffsetX: 0,
			naturalTextWidth: 0,
			textWidth: NAME_LABEL_CONFIG.MIN_TEXT_WIDTH,
			renderedTextWidth: NAME_LABEL_CONFIG.MIN_TEXT_WIDTH,
			complianceFailed: false,
			complianceFailedReason: null,
			suffixText: "",
			suffixNaturalTextWidth: 0,
			suffixHeight: 0,
			suffixOffsetX: 0,
			sizeLabelSuppressedByName: false,
			canRenderText: true,
		})
		this.syncLabelContent(elementId, labelGroup)
		this.syncIcon(elementId, labelGroup)
		this.syncHitRect(labelGroup)
		this.bindLabelInteraction(labelGroup, elementId)
		return labelGroup
	}

	private syncLabelContent(elementId: string, labelGroup: Konva.Group): boolean {
		const textNode = this.getTextNode(labelGroup)
		const state = this.labelLayoutStates.get(labelGroup)
		if (!textNode || !state) return false

		const content = this.getLabelContent(elementId)
		const primaryText = content.primaryText || ""
		const suffixText = content.suffix?.text || ""
		const showSuffixBackground = content.suffix?.showBackground !== false
		let changed = false

		if (textNode.text() !== primaryText) {
			textNode.text(primaryText)
			state.naturalTextWidth = this.measureNaturalTextWidth(textNode)
			state.textWidth = 0
			state.renderedTextWidth = 0
			changed = true
		}

		let suffixNode = this.getSuffixNode(labelGroup)
		let background = labelGroup.findOne<Konva.Rect>(".name-label-status-background")
		if (suffixText) {
			if (!suffixNode) {
				suffixNode = new Konva.Text({
					name: NAME_LABEL_SUFFIX_NAME,
					text: suffixText,
					fontSize: textNode.fontSize() * NAME_LABEL_CONFIG.STATUS_FONT_RATIO,
					fontFamily: this.labelConfig.fontFamily,
					fill: this.labelConfig.textColor,
					wrap: "none",
					listening: false,
				})
				labelGroup.add(suffixNode)
				changed = true
			} else if (suffixNode.text() !== suffixText) {
				suffixNode.text(suffixText)
				changed = true
			}

			if (showSuffixBackground) {
				if (!background) {
					background = new Konva.Rect({
						name: "name-label-status-background",
						cornerRadius: 7,
						listening: false,
					})
					labelGroup.add(background)
					changed = true
				}
				// 进行中的任务使用画布蓝色；终态保留中性色，避免继续传达正在处理。
				const backgroundColor = content.suffix?.inProgress
					? "rgba(59, 130, 246, 0.08)"
					: "rgba(115, 115, 115, 0.08)"
				if (background.fill() !== backgroundColor) {
					background.fill(backgroundColor)
					changed = true
				}
			} else if (background) {
				background.destroy()
				background = null
				changed = true
			}
			suffixNode.moveToTop()

			const statusColor = content.suffix?.inProgress ? "#3B82F6" : this.labelConfig.textColor
			if (suffixNode.fill() !== statusColor) {
				suffixNode.fill(statusColor)
				changed = true
			}

			if (state.suffixText !== suffixText || changed) {
				state.suffixNaturalTextWidth =
					this.measureNaturalTextWidth(suffixNode) +
					(showSuffixBackground ? NAME_LABEL_CONFIG.STATUS_PADDING_X * 2 : 0)
				state.suffixHeight =
					suffixNode.height() +
					(showSuffixBackground ? NAME_LABEL_CONFIG.STATUS_PADDING_Y * 2 : 0)
				changed = true
			}
		} else {
			if (suffixNode) {
				suffixNode.destroy()
				labelGroup.findOne(".name-label-status-background")?.destroy()
				changed = true
			}
			if (state.suffixText || state.suffixNaturalTextWidth || state.suffixHeight) {
				state.suffixNaturalTextWidth = 0
				state.suffixHeight = 0
				state.suffixOffsetX = 0
				changed = true
			}
		}

		if (state.suffixText !== suffixText) {
			state.suffixText = suffixText
			state.textWidth = 0
			state.renderedTextWidth = 0
			changed = true
		}

		if (changed) this.syncHitRect(labelGroup)
		return changed
	}

	/**
	 * Content is synchronized at event boundaries in createOrUpdateLabel and
	 * refreshIcons. Geometry-only updates reuse the cached nodes and widths.
	 */
	protected override updateLabelContent(): boolean {
		return false
	}

	/**
	 * 名称与尺寸共用一行时优先保证名称（含状态后缀）；只有完整名称和尺寸都能容纳时
	 * 才显示尺寸。这里只收窄主名称的渲染宽度，重命名仍读取完整名称。
	 */
	protected override updateLabelLayout(
		elementId: string,
		element: ReturnType<typeof this.canvas.elementManager.getElementInstance>,
		labelGroup: Konva.Group,
		boundingRect: { x: number; y: number; width: number; height: number },
		inverseScale: number,
		mediaLayout?: MediaLabelLayout | null,
		context?: LabelLayoutSyncContext,
	): boolean {
		void boundingRect.x
		void boundingRect.y
		void boundingRect.height
		if (this.renamingElementId === elementId) return false
		const textNode = this.getTextNode(labelGroup)
		const state = this.labelLayoutStates.get(labelGroup)
		if (!textNode || !state) return false

		const naturalTextWidth = state.naturalTextWidth
		const suffixReservation = state.suffixText
			? state.suffixNaturalTextWidth + NAME_LABEL_CONFIG.SUFFIX_GAP
			: 0
		const previousSizeLabelSuppression = state.sizeLabelSuppressedByName
		const safeInverseScale = Math.max(inverseScale, Number.EPSILON)
		const resolvedMediaLayout = mediaLayout ?? this.getMediaRowLayout(elementId)
		const canRename = this.canvas.elementRenameManager?.canRename(elementId) ?? false
		state.canRename = canRename
		const operationScreenWidth = canRename ? NAME_LABEL_CONFIG.RENAME_OPERATION_WIDTH : 0
		const minimumVisibleTextWidth =
			naturalTextWidth > 0
				? Math.min(naturalTextWidth, NAME_LABEL_CONFIG.FONT_SIZE)
				: NAME_LABEL_CONFIG.MIN_TEXT_WIDTH
		let sizeLabelSuppressionChanged = false
		let availableLabelWidth: number
		if (resolvedMediaLayout) {
			availableLabelWidth = Math.max(0, resolvedMediaLayout.nameWidth)
			state.showOperation = resolvedMediaLayout.showOperation
			if (state.sizeLabelSuppressedByName) {
				state.sizeLabelSuppressedByName = false
				sizeLabelSuppressionChanged = true
			}
		} else {
			// getBoundingRect() is layer-relative, while the label uses inverse stage
			// scaling. Convert the element width into the label's local coordinates.
			const elementLabelWidth = Math.max(
				0,
				(boundingRect.width - this.labelConfig.offsetLeft) / safeInverseScale,
			)
			const sizeLabelDecision = this.getSizeLabelPriorityDecision(
				elementId,
				elementLabelWidth,
			)
			sizeLabelSuppressionChanged =
				previousSizeLabelSuppression !== sizeLabelDecision.suppressed
			const sizeLabelReservation = sizeLabelDecision.suppressed
				? 0
				: sizeLabelDecision.reservation
			availableLabelWidth = Math.max(0, elementLabelWidth - sizeLabelReservation)
			// Rename capability is independent from the text budget. Keep the operation area
			// available even when the element is too narrow; the name then ellipsizes and the
			// lower-priority size label yields first. This keeps the label entry consistent with
			// the context menu for every element that can be renamed.
			state.showOperation = operationScreenWidth > 0
			if (state.showOperation) {
				availableLabelWidth = Math.max(
					availableLabelWidth,
					operationScreenWidth + minimumVisibleTextWidth + suffixReservation,
				)
				availableLabelWidth = Math.max(0, availableLabelWidth - operationScreenWidth)
			}
		}
		const hasIcon = state.iconKey !== null
		const fullIconWidth = hasIcon ? state.iconWidth + state.iconGap : 0
		const iconCanFit =
			hasIcon &&
			availableLabelWidth - fullIconWidth - suffixReservation >= minimumVisibleTextWidth
		const textOffsetX = iconCanFit ? fullIconWidth : 0
		const availableTextWidth = Math.max(
			0,
			availableLabelWidth - textOffsetX - suffixReservation,
		)
		const canRenderText = availableTextWidth >= NAME_LABEL_CONFIG.MIN_TEXT_WIDTH
		const targetTextWidth = this.getRenderedTextWidth(naturalTextWidth, availableTextWidth)
		let changed = false

		if (state.textOffsetX !== textOffsetX) {
			state.textOffsetX = textOffsetX
			changed = true
		}
		if (state.iconVisible !== iconCanFit) {
			state.iconVisible = iconCanFit
			changed = true
		}
		if (state.canRenderText !== canRenderText) {
			state.canRenderText = canRenderText
			changed = true
		}
		if (state.textWidth !== targetTextWidth) {
			textNode.width(targetTextWidth)
			state.textWidth = targetTextWidth
			changed = true
		}

		textNode.wrap("none")
		textNode.ellipsis(true)
		const renderedTextWidth = this.getRenderedTextWidthFromNode(textNode, targetTextWidth)
		if (state.renderedTextWidth !== renderedTextWidth) {
			state.renderedTextWidth = renderedTextWidth
			changed = true
		}
		const statusBackground = labelGroup.findOne<Konva.Rect>(".name-label-status-background")
		const suffixOffsetX =
			textOffsetX + renderedTextWidth + (state.suffixText ? NAME_LABEL_CONFIG.SUFFIX_GAP : 0)
		if (state.suffixOffsetX !== suffixOffsetX) {
			state.suffixOffsetX = suffixOffsetX
			changed = true
		}
		const iconNode = this.getIconNode(labelGroup)
		const suffixNode = this.getSuffixNode(labelGroup)
		const labelHeight = Math.max(
			textNode.height(),
			state.suffixText ? state.suffixHeight : 0,
			iconCanFit ? state.iconHeight : 0,
		)
		const iconY = iconCanFit ? Math.max(0, (labelHeight - state.iconHeight) / 2) : 0
		const textY = Math.max(0, (labelHeight - textNode.height()) / 2)
		if (iconNode) {
			// The label group already starts at the element's left edge. Keep the
			// icon slot at x=0 and preserve the resolver's natural drawing geometry.
			if (iconNode.x() !== 0 || iconNode.y() !== iconY) {
				iconNode.position({ x: 0, y: iconY })
				changed = true
			}
			if (iconNode.visible() !== iconCanFit) {
				iconNode.visible(iconCanFit)
				changed = true
			}
		}
		if (textNode.x() !== textOffsetX) {
			textNode.x(textOffsetX)
			changed = true
		}
		if (textNode.y() !== textY) {
			textNode.y(textY)
			changed = true
		}
		if (suffixNode) {
			// 胶囊整体与标题居中，内部文字独立居中；字号较小也不会沿标题底部排列。
			const suffixY = (labelHeight - state.suffixHeight) / 2
			const suffixTextX =
				suffixOffsetX + (statusBackground ? NAME_LABEL_CONFIG.STATUS_PADDING_X : 0)
			const suffixTextY =
				suffixY + (statusBackground ? NAME_LABEL_CONFIG.STATUS_PADDING_Y : 0)
			const backgroundGeometryChanged = statusBackground
				? statusBackground.x() !== suffixOffsetX ||
					statusBackground.y() !== suffixY ||
					statusBackground.width() !== state.suffixNaturalTextWidth ||
					statusBackground.height() !== state.suffixHeight
				: false
			if (
				suffixNode.x() !== suffixTextX ||
				suffixNode.y() !== suffixTextY ||
				backgroundGeometryChanged
			) {
				suffixNode.position({ x: suffixTextX, y: suffixTextY })
				statusBackground?.setAttrs({
					x: suffixOffsetX,
					y: suffixY,
					width: state.suffixNaturalTextWidth,
					height: state.suffixHeight,
				})
				changed = true
			}
			if (suffixNode.visible() !== Boolean(state.suffixText)) {
				suffixNode.visible(Boolean(state.suffixText))
				changed = true
			}
		}
		const interactiveNodesChanged = this.syncInteractiveNodes(
			elementId,
			labelGroup,
			labelHeight,
			iconY,
		)
		changed = interactiveNodesChanged || changed
		if (sizeLabelSuppressionChanged) {
			const refreshSizeVisibility =
				this.canvas.sizeLabelManager?.refreshVisibilityForNamePriority
			const sizeVisibilityChanged = context
				? (refreshSizeVisibility?.(elementId, true, context) ?? false)
				: (refreshSizeVisibility?.(elementId, true) ?? false)
			changed = sizeVisibilityChanged || changed
		}
		if (changed) this.syncHitRect(labelGroup)
		return changed
	}

	protected override getLabelSize(labelGroup: Konva.Group): LabelSize | null {
		const textNode = this.getTextNode(labelGroup)
		if (!textNode) return null

		const state = this.labelLayoutStates.get(labelGroup)
		const operationWidth =
			state?.showOperation && state.canRename ? NAME_LABEL_CONFIG.RENAME_OPERATION_WIDTH : 0
		// The constrained text width is only a layout budget for ellipsis. Once Konva has
		// truncated the text, use the actual drawn content width for the label bounds as well;
		// otherwise the invisible tail would keep the hit area and trailing space wide.
		const contentWidth = state ? this.getLabelContentWidth(textNode, state) : textNode.width()
		return {
			width: contentWidth + operationWidth,
			height: Math.max(
				textNode.height(),
				state?.suffixText ? (state.suffixHeight ?? 0) : 0,
				state?.iconVisible ? state.iconHeight : 0,
			),
		}
	}

	/** Media row budgeting includes the mandatory status suffix in the full name width. */
	protected override getIntrinsicLabelSize(elementId: string): LabelSize {
		const primarySize = super.getIntrinsicLabelSize(elementId)
		const labelGroup = this.labelMap.get(elementId)
		const state = labelGroup ? this.labelLayoutStates.get(labelGroup) : undefined
		if (!state?.suffixText) return primarySize

		return {
			width: primarySize.width + NAME_LABEL_CONFIG.SUFFIX_GAP + state.suffixNaturalTextWidth,
			height: Math.max(primarySize.height, state.suffixHeight),
		}
	}

	private getTextNode(labelGroup: Konva.Group | null | undefined): Konva.Text | null {
		return (labelGroup?.findOne(`.${NAME_LABEL_TEXT_NAME}`) as Konva.Text | undefined) ?? null
	}

	private getSuffixNode(labelGroup: Konva.Group): Konva.Text | null {
		return labelGroup.findOne(`.${NAME_LABEL_SUFFIX_NAME}`) as Konva.Text | null
	}

	private measureNaturalTextWidth(textNode: Konva.Text): number {
		// Measure the full string without changing the constrained render width.
		// This keeps text measurement out of the viewport hot path.
		const naturalWidth = textNode
			.text()
			.split("\n")
			.reduce((maxWidth, line) => Math.max(maxWidth, textNode.measureSize(line).width), 0)
		return Number.isFinite(naturalWidth) ? Math.max(0, naturalWidth) : 0
	}

	/**
	 * Konva keeps the constrained node width separate from the width of each rendered line.
	 * Use the latter for the following suffix and rename action so an ellipsis does not leave
	 * an invisible gap, while retaining the constrained width for the text layout budget.
	 */
	private getRenderedTextWidthFromNode(textNode: Konva.Text, fallbackWidth: number): number {
		const renderedWidth = textNode.textArr.reduce(
			(maxWidth, line) => Math.max(maxWidth, line.width),
			0,
		)
		if (!Number.isFinite(renderedWidth)) return fallbackWidth
		return Math.min(
			Math.max(renderedWidth, NAME_LABEL_CONFIG.MIN_TEXT_WIDTH),
			Math.max(fallbackWidth, NAME_LABEL_CONFIG.MIN_TEXT_WIDTH),
		)
	}

	private getIconNode(labelGroup: Konva.Group): Konva.Shape | Konva.Group | null {
		return labelGroup.findOne(`.${NAME_LABEL_ICON_NAME}`) as Konva.Shape | Konva.Group | null
	}

	private getComplianceHitNode(labelGroup: Konva.Group): Konva.Rect | null {
		return labelGroup.findOne(`.${NAME_LABEL_COMPLIANCE_HIT_NAME}`) as Konva.Rect | null
	}

	private getRenameIconNode(labelGroup: Konva.Group): Konva.Path | null {
		return labelGroup.findOne(`.${NAME_LABEL_RENAME_ICON_NAME}`) as Konva.Path | null
	}

	private getRenameHitNode(labelGroup: Konva.Group): Konva.Rect | null {
		return labelGroup.findOne(`.${NAME_LABEL_RENAME_HIT_NAME}`) as Konva.Rect | null
	}

	private getLabelContentWidth(textNode: Konva.Text, state: NameLabelLayoutState): number {
		return (
			state.textOffsetX +
			(state.renderedTextWidth || textNode.width()) +
			(state.suffixText ? NAME_LABEL_CONFIG.SUFFIX_GAP + state.suffixNaturalTextWidth : 0)
		)
	}

	private syncInteractiveNodes(
		elementId: string,
		labelGroup: Konva.Group,
		labelHeight: number,
		iconY: number,
	): boolean {
		const state = this.labelLayoutStates.get(labelGroup)
		const textNode = this.getTextNode(labelGroup)
		if (!state || !textNode) return false

		let changed = false
		const showComplianceHit = state.complianceFailed && state.iconVisible && state.iconWidth > 0
		let complianceHit = this.getComplianceHitNode(labelGroup)
		if (showComplianceHit) {
			if (!complianceHit) {
				complianceHit = new Konva.Rect({
					name: NAME_LABEL_COMPLIANCE_HIT_NAME,
					fill: "rgba(0, 0, 0, 0.001)",
					listening: true,
				})
				labelGroup.add(complianceHit)
				this.bindComplianceInteraction(complianceHit, elementId)
				changed = true
			}
			const nextComplianceAttrs = {
				x: 0,
				y: iconY,
				width: state.iconWidth,
				height: state.iconHeight,
			}
			if (
				complianceHit.x() !== nextComplianceAttrs.x ||
				complianceHit.y() !== nextComplianceAttrs.y ||
				complianceHit.width() !== nextComplianceAttrs.width ||
				complianceHit.height() !== nextComplianceAttrs.height
			) {
				complianceHit.setAttrs(nextComplianceAttrs)
				changed = true
			}
			if (!complianceHit.visible() || !complianceHit.listening()) {
				complianceHit.visible(true)
				complianceHit.listening(true)
				changed = true
			}
		} else if (complianceHit) {
			complianceHit.destroy()
			changed = true
		}

		const showRename = state.canRename && state.showOperation
		const isRenameButtonHovered = this.renameHoverElementId === elementId
		const shouldShowRenameIcon =
			isRenameButtonHovered ||
			this.pointerHoverElementId === elementId ||
			this.canvasHoverElementId === elementId
		let renameHit = this.getRenameHitNode(labelGroup)
		let renameIcon = this.getRenameIconNode(labelGroup)
		if (showRename) {
			if (!renameHit) {
				renameHit = new Konva.Rect({
					name: NAME_LABEL_RENAME_HIT_NAME,
					fill: NAME_LABEL_CONFIG.RENAME_BUTTON_TRANSPARENT_FILL,
					cornerRadius: NAME_LABEL_CONFIG.RENAME_BUTTON_RADIUS,
					listening: true,
				})
				labelGroup.add(renameHit)
				// The button is added after the full-size label hit area, so it remains
				// the topmost listening node in its own operation region.
				this.bindRenameInteraction(renameHit, elementId)
				changed = true
			}
			if (!renameIcon) {
				renameIcon = new Konva.Path({
					name: NAME_LABEL_RENAME_ICON_NAME,
					data: "M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z",
					scaleX: NAME_LABEL_CONFIG.RENAME_ICON_SIZE / 24,
					scaleY: NAME_LABEL_CONFIG.RENAME_ICON_SIZE / 24,
					stroke: "#737373",
					strokeWidth: 2,
					lineCap: "round",
					lineJoin: "round",
					fillEnabled: false,
					listening: false,
				})
				labelGroup.add(renameIcon)
				changed = true
			}

			const buttonX =
				this.getLabelContentWidth(textNode, state) + NAME_LABEL_CONFIG.RENAME_GAP
			const buttonHeight = labelHeight
			const nextButtonFill = isRenameButtonHovered
				? NAME_LABEL_CONFIG.RENAME_BUTTON_HOVER_FILL
				: NAME_LABEL_CONFIG.RENAME_BUTTON_TRANSPARENT_FILL
			const nextRenameHitAttrs = {
				x: buttonX,
				y: 0,
				width: NAME_LABEL_CONFIG.RENAME_BUTTON_WIDTH,
				height: buttonHeight,
				cornerRadius: NAME_LABEL_CONFIG.RENAME_BUTTON_RADIUS,
			}
			if (
				renameHit.x() !== nextRenameHitAttrs.x ||
				renameHit.y() !== nextRenameHitAttrs.y ||
				renameHit.width() !== nextRenameHitAttrs.width ||
				renameHit.height() !== nextRenameHitAttrs.height ||
				renameHit.cornerRadius() !== nextRenameHitAttrs.cornerRadius
			) {
				renameHit.setAttrs(nextRenameHitAttrs)
				changed = true
			}
			if (renameHit.fill() !== nextButtonFill || !renameHit.visible()) {
				renameHit.fill(nextButtonFill)
				renameHit.visible(true)
				changed = true
			}
			const iconX =
				buttonX +
				(NAME_LABEL_CONFIG.RENAME_BUTTON_WIDTH - NAME_LABEL_CONFIG.RENAME_ICON_SIZE) / 2
			const iconYPosition = Math.max(
				0,
				(labelHeight - NAME_LABEL_CONFIG.RENAME_ICON_SIZE) / 2,
			)
			if (renameIcon.x() !== iconX || renameIcon.y() !== iconYPosition) {
				renameIcon.position({ x: iconX, y: iconYPosition })
				changed = true
			}
			const renameColor = isRenameButtonHovered ? "#262626" : "#737373"
			if (renameIcon.stroke() !== renameColor) {
				renameIcon.stroke(renameColor)
				changed = true
			}
			if (renameIcon.visible() !== shouldShowRenameIcon) {
				renameIcon.visible(shouldShowRenameIcon)
				changed = true
			}
			if (!renameHit.visible() || !renameHit.listening()) {
				renameHit.visible(true)
				renameHit.listening(true)
				changed = true
			}
		} else {
			if (renameHit) {
				renameHit.destroy()
				changed = true
			}
			if (renameIcon) {
				renameIcon.destroy()
				changed = true
			}
			if (this.renameHoverElementId === elementId) this.renameHoverElementId = null
		}

		return changed
	}

	private getRenderedTextWidth(naturalWidth: number, availableWidth: number): number {
		if (naturalWidth <= availableWidth) {
			return Math.max(naturalWidth, NAME_LABEL_CONFIG.MIN_TEXT_WIDTH)
		}

		// Round down so a cached width never makes the label exceed its element.
		const bucketedWidth =
			Math.floor(availableWidth / NAME_LABEL_CONFIG.TEXT_WIDTH_BUCKET) *
			NAME_LABEL_CONFIG.TEXT_WIDTH_BUCKET
		return Math.max(bucketedWidth, NAME_LABEL_CONFIG.MIN_TEXT_WIDTH)
	}

	/**
	 * Reports whether the size label should yield space to this name label.
	 *
	 * The decision deliberately uses the size label's independent eligibility
	 * rather than its current `visible` flag. A size label hidden by this rule
	 * must still be considered when the element grows again, otherwise it could
	 * never recover without an unrelated visibility event.
	 */
	public shouldSuppressSizeLabel(elementId: string): boolean {
		return this.getSizeLabelPriorityDecision(elementId).suppressed
	}

	private getSizeLabelPriorityDecision(
		elementId: string,
		elementLabelWidth?: number,
	): { reservation: number; suppressed: boolean } {
		const labelGroup = this.labelMap.get(elementId)
		const state = labelGroup ? this.labelLayoutStates.get(labelGroup) : undefined
		const sizeLabelManager = this.canvas.sizeLabelManager
		const element = this.canvas.elementManager.getElementInstance(elementId)
		// Keep lightweight integrations and test doubles compatible while the
		// runtime uses the independent eligibility query above the fallback.
		const sizeLabelIsEligible = sizeLabelManager
			? (sizeLabelManager.isLabelEligibleForNamePriority?.(elementId) ??
				sizeLabelManager.isLabelVisibleForElement?.(elementId) ??
				false)
			: false
		if (
			!state ||
			!element ||
			this.renamingElementId === elementId ||
			this.calculateBaseVisibility(elementId, element) !== true ||
			!sizeLabelIsEligible
		) {
			if (state) state.sizeLabelSuppressedByName = false
			return { reservation: 0, suppressed: false }
		}

		const sizeLabelSize = sizeLabelManager.getLabelSizeForElement(elementId)
		if (!sizeLabelSize || !Number.isFinite(sizeLabelSize.width)) {
			state.sizeLabelSuppressedByName = false
			return { reservation: 0, suppressed: false }
		}

		const reservation = Math.max(0, sizeLabelSize.width) + NAME_LABEL_CONFIG.LABEL_GAP
		const availableElementWidth = elementLabelWidth ?? this.getElementLabelWidth(elementId)
		if (sizeLabelSize.width > availableElementWidth) {
			state.sizeLabelSuppressedByName = false
			return { reservation: 0, suppressed: false }
		}
		const primaryNameHasContent = state.naturalTextWidth > 0
		const suffixHasContent = Boolean(state.suffixText)
		if (!primaryNameHasContent && !suffixHasContent) {
			state.sizeLabelSuppressedByName = false
			return { reservation, suppressed: false }
		}

		const availableWithSize = Math.max(0, availableElementWidth - reservation)
		const requiredNameWidth =
			state.naturalTextWidth +
			(state.suffixText ? state.suffixNaturalTextWidth + NAME_LABEL_CONFIG.SUFFIX_GAP : 0) +
			this.getLabelOperationScreenWidth(elementId)
		// The icon is optional; it can yield before the mandatory name and suffix.
		// Use the cached natural width so Konva's ellipsis does not hide the fact
		// that the size label consumed the name's available space.
		const restoreThreshold = state.sizeLabelSuppressedByName
			? requiredNameWidth + NAME_LABEL_CONFIG.SIZE_LABEL_PRIORITY_EPSILON
			: requiredNameWidth
		const suppressed = availableWithSize < restoreThreshold
		state.sizeLabelSuppressedByName = suppressed

		return { reservation, suppressed }
	}

	private getElementLabelWidth(elementId: string): number {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) return 0

		const boundingRect = element.getBoundingRect()
		if (!boundingRect) return 0
		const safeViewportScale = Math.max(this.canvas.stage.scaleX(), Number.EPSILON)
		return Math.max(0, (boundingRect.width - this.labelConfig.offsetLeft) * safeViewportScale)
	}

	private getIconContext(elementId: string): NameLabelIconContext | null {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) return null
		const data = element.getData()
		const content = "contents" in data ? getActiveContent(data) : undefined
		const complianceContent = content as MediaComplianceContentLike | undefined
		const complianceStatus = resolveMediaComplianceStatus(this.canvas, complianceContent)

		return {
			elementId,
			element,
			data,
			selected: this.canvas.selectionManager.isSelected(elementId),
			hovered:
				this.canvas.hoverManager.getHoveredElementId() === elementId ||
				this.pointerHoverElementId === elementId,
			isAssetLibrary: Boolean(getMediaAssetId(complianceContent)),
			complianceStatus,
			complianceFailedReason:
				complianceStatus === "FAILED"
					? resolveMediaComplianceFailedReason(this.canvas, complianceContent)
					: undefined,
		}
	}

	/** Resolve icons only on discrete state changes; pan/scale only reuse this cache. */
	private syncIcon(elementId: string, labelGroup: Konva.Group): boolean {
		if (!this.iconResolver) return false
		const state = this.labelLayoutStates.get(labelGroup)
		if (!state) return false

		const context = this.getIconContext(elementId)
		const descriptor = context ? this.iconResolver(context) : null
		const currentNode = this.getIconNode(labelGroup)
		let changed = false
		const complianceFailed = context?.complianceStatus === "FAILED"
		const complianceFailedReason = complianceFailed
			? (context?.complianceFailedReason ?? null)
			: null
		if (state.complianceFailed !== complianceFailed) {
			state.complianceFailed = complianceFailed
			changed = true
		}
		if (state.complianceFailedReason !== complianceFailedReason) {
			state.complianceFailedReason = complianceFailedReason
			changed = true
		}

		if (!descriptor) {
			if (currentNode) {
				currentNode.destroy()
				changed = true
			}
			if (
				state.iconKey !== null ||
				state.iconWidth !== 0 ||
				state.iconHeight !== 0 ||
				state.iconGap !== 0
			) {
				state.iconKey = null
				state.iconWidth = 0
				state.iconHeight = 0
				state.iconGap = 0
				state.iconVisible = false
				state.textOffsetX = 0
				state.textWidth = 0
				changed = true
			}
			return changed
		}
		if (!context) return false

		const width = this.normalizeIconDimension(descriptor.width)
		const height = this.normalizeIconDimension(descriptor.height)
		const gap = Math.max(0, descriptor.gap ?? NAME_LABEL_CONFIG.ICON_GAP)
		const needsNewNode = !currentNode || state.iconKey !== descriptor.key
		let iconNode = currentNode

		if (needsNewNode) {
			currentNode?.destroy()
			iconNode = descriptor.create(context)
			if (!iconNode) {
				state.iconKey = null
				state.iconWidth = 0
				state.iconHeight = 0
				state.iconGap = 0
				state.iconVisible = false
				state.textOffsetX = 0
				state.textWidth = 0
				return true
			}
			iconNode.addName(NAME_LABEL_ICON_NAME)
			iconNode.listening(false)
			iconNode.visible(true)
			labelGroup.add(iconNode)
			changed = true
		} else {
			if (!iconNode) return false
			descriptor.update?.(iconNode, context)
			changed = descriptor.update !== undefined
		}

		const dimensionsChanged =
			state.iconKey !== descriptor.key ||
			state.iconWidth !== width ||
			state.iconHeight !== height ||
			state.iconGap !== gap
		changed = dimensionsChanged || changed
		state.iconKey = descriptor.key
		state.iconWidth = width
		state.iconHeight = height
		state.iconGap = gap
		if (dimensionsChanged) state.textWidth = 0
		return changed
	}

	private normalizeIconDimension(value: number): number {
		return Number.isFinite(value) ? Math.max(0, value) : 0
	}

	/** Konva returns the transformed rect in Stage coordinates, which is the DOM tooltip host's space. */
	private getStageAnchor(node: Konva.Node): {
		x: number
		y: number
		width: number
		height: number
	} {
		const rect = node.getClientRect({ skipShadow: true })
		return {
			x: rect.x,
			y: rect.y,
			width: rect.width,
			height: rect.height,
		}
	}

	private scheduleTooltip(content: NameLabelTooltipContent | null, node: Konva.Node): void {
		if (!content || !node.getParent()?.visible() || !this.areNameLabelsInteractive()) {
			this.hideTooltip()
			return
		}
		this.tooltipController.schedule(content, this.getStageAnchor(node))
	}

	private hideTooltip(): void {
		this.tooltipController.hide()
	}

	private getImageNameTooltipContent(elementId: string): NameLabelTooltipContent | null {
		const data = this.canvas.elementManager.getElementData(elementId)
		if (!isImageElementContent(data)) return null

		const content = getActiveImageContent(data)
		const runtime = this.canvas.generationRuntimeManager?.getTargetState(
			elementId,
			content.contentId,
		)
		const expectedName =
			runtime?.generateImageRequest?.name || content.generateImageRequest?.name
		const processing =
			Boolean(runtime) ||
			content.status === GenerationStatus.Pending ||
			content.status === GenerationStatus.Processing
		const methods = this.canvas.magicConfigManager.config?.methods?.imageRename
		const fileName =
			!processing && content.src
				? methods?.resolveImageRenameFile(content.src)?.fileName ||
					getCanvasResourceFileName(content.src)
				: undefined
		const text = fileName || expectedName
		if (!text) return null

		return {
			key: `name:${elementId}:${content.contentId}:${text}`,
			title: fileName
				? this.canvas.t?.("rename.fileNameLabel", "文件名")
				: this.canvas.t?.("rename.expectedFile", "预计文件名"),
			text,
		}
	}

	private getComplianceTooltipContent(elementId: string): NameLabelTooltipContent | null {
		const labelGroup = this.labelMap.get(elementId)
		const state = labelGroup ? this.labelLayoutStates.get(labelGroup) : undefined
		if (!state?.complianceFailed) return null
		const reason = state.complianceFailedReason
		const text = reason
			? (this.canvas.t?.("seedanceCompliance.failedWithReason", {
					defaultValue: "合规校验未通过：{{reason}}",
					reason,
				}) ?? `合规校验未通过：${reason}`)
			: (this.canvas.t?.("seedanceCompliance.failed", "合规校验未通过") ?? "合规校验未通过")
		return {
			key: `compliance:${elementId}:${reason ?? ""}`,
			text,
		}
	}

	private getRenameTooltipContent(): NameLabelTooltipContent {
		return {
			key: "rename-action",
			text: this.canvas.t?.("contextMenu.rename", "重命名") ?? "重命名",
		}
	}

	private bindComplianceInteraction(hitNode: Konva.Rect, elementId: string): void {
		const stopPointerEvent = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
			event.cancelBubble = true
			event.evt?.stopPropagation()
		}
		hitNode.on("mousedown touchstart", (event) => {
			stopPointerEvent(event)
			this.selectElementFromLabel(elementId, false)
		})
		hitNode.on("click tap", (event) => stopPointerEvent(event))
		hitNode.on("mouseenter", () => {
			this.scheduleTooltip(this.getComplianceTooltipContent(elementId), hitNode)
		})
		hitNode.on("mouseleave", () => this.hideTooltip())
	}

	private bindRenameInteraction(hitNode: Konva.Rect, elementId: string): void {
		const stopPointerEvent = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
			event.cancelBubble = true
			event.evt?.stopPropagation()
		}
		hitNode.on("mousedown touchstart", (event) => {
			stopPointerEvent(event)
			this.selectElementFromLabel(elementId, false)
		})
		hitNode.on("click tap", (event) => {
			stopPointerEvent(event)
			this.hideTooltip()
			this.canvas.elementRenameManager.startRename(elementId)
		})
		hitNode.on("mouseenter", () => {
			this.renameHoverElementId = elementId
			this.canvas.cursorManager.setTemporary("pointer")
			this.syncInteractiveNodesForElement(elementId)
			this.scheduleTooltip(this.getRenameTooltipContent(), hitNode)
		})
		hitNode.on("mouseleave", () => {
			if (this.renameHoverElementId === elementId) this.renameHoverElementId = null
			this.canvas.cursorManager.restoreToolCursor()
			this.syncInteractiveNodesForElement(elementId)
			this.hideTooltip()
		})
	}

	private syncInteractiveNodesForElement(elementId: string): void {
		this.syncInteractiveNodesForElements([elementId])
	}

	private syncInteractiveNodesForElements(
		elementIds: readonly (string | null | undefined)[],
	): void {
		let changed = false
		const uniqueElementIds = new Set(
			elementIds.filter((elementId): elementId is string => Boolean(elementId)),
		)

		for (const elementId of uniqueElementIds) {
			const labelGroup = this.labelMap.get(elementId)
			if (!labelGroup) continue
			const state = this.labelLayoutStates.get(labelGroup)
			const textNode = this.getTextNode(labelGroup)
			if (!state || !textNode) continue
			const labelHeight = this.getLabelSize(labelGroup)?.height ?? textNode.height()
			const iconY = state.iconVisible ? Math.max(0, (labelHeight - state.iconHeight) / 2) : 0
			const elementChanged = this.syncInteractiveNodes(
				elementId,
				labelGroup,
				labelHeight,
				iconY,
			)
			if (elementChanged) {
				this.syncHitRect(labelGroup)
				changed = true
			}
		}

		if (changed) this.requestOverlayDraw("name-label-interaction")
	}

	/** Refreshes cached icon and runtime text state for discrete label changes. */
	public refreshIcons(elementIds?: readonly string[]): void {
		const ids = elementIds ? Array.from(new Set(elementIds)) : Array.from(this.labelMap.keys())
		const layoutContext = BaseLabelManager.createLabelLayoutSyncContext()
		let requiresDraw = false

		for (const elementId of ids) {
			const labelGroup = this.labelMap.get(elementId)
			if (!labelGroup) continue
			const contentChanged = this.syncLabelContent(elementId, labelGroup)
			const iconChanged = this.syncIcon(elementId, labelGroup)
			requiresDraw = contentChanged || iconChanged || requiresDraw
			// Compliance text can change while the shield icon keeps the same shape;
			// only changed content needs a layout pass.
			if (contentChanged || iconChanged) {
				requiresDraw =
					this.updateLabelPosition(elementId, true, layoutContext) || requiresDraw
			}
		}

		if (requiresDraw)
			this.canvas.runtimeScheduler.requestLayerDraw("overlay", {
				source: "NameLabelManager",
				reason: "name-label-icons",
				priority: "input",
			})
	}

	public override refreshAfterLocaleChange(): void {
		this.hideTooltip()
		for (const [elementId, labelGroup] of this.labelMap) {
			this.syncLabelContent(elementId, labelGroup)
		}
		super.refreshAfterLocaleChange()
	}

	protected override shouldRetainHiddenLabel(elementId: string): boolean {
		return this.renamingElementId === elementId
	}

	public override destroy(): void {
		this.clearPointerHover(false)
		this.canvasHoverElementId = null
		this.renameHoverElementId = null
		this.tooltipController.destroy()
		for (const unsubscribe of this.interactionUnsubscribers) {
			unsubscribe()
		}
		this.interactionUnsubscribers = []
		super.destroy()
	}

	/**
	 * 计算标签位置（元素左上角上方）
	 */
	protected calculateLabelPosition(
		boundingRect: { x: number; y: number; width: number; height: number },
		labelSize: { width: number; height: number },
		inverseScale: number,
	): { x: number; y: number } {
		const offsetTop = this.labelConfig.offsetTop
		const offsetLeft = this.labelConfig.offsetLeft
		const controlClearance = NAME_LABEL_CONFIG.CONTROL_CLEARANCE

		// 由于标签应用了 inverseScale，在计算位置时需要将 labelHeight 和 offsetTop 也应用 inverseScale
		// 这样才能保证在不同缩放级别下，标签的视觉位置保持一致
		const scaledLabelHeight = labelSize.height * inverseScale
		const scaledOffsetTop = offsetTop * inverseScale
		const scaledControlClearance = controlClearance * inverseScale

		// 计算标签位置（元素左上角上方）
		// 标签的 y 坐标 = 元素顶部 - 间距 - 标签高度
		// 这样标签的底部会距离元素顶部 offsetTop 的距离
		return {
			x: boundingRect.x + offsetLeft,
			y: boundingRect.y - scaledLabelHeight - scaledOffsetTop - scaledControlClearance,
		}
	}

	/**
	 * 计算自定义可见性（检查 name label 是否超出元素宽度）
	 * @param elementId - 元素 ID
	 * @param element - 元素实例
	 * @param labelGroup - 标签组
	 * @param baseVisibility - 基础可见性
	 * @returns 自定义可见性
	 */
	protected calculateCustomVisibility(
		elementId: string,
		element: ReturnType<typeof this.canvas.elementManager.getElementInstance>,
		labelGroup: Konva.Group,
		baseVisibility: boolean,
		mediaLayout?: MediaLabelLayout | null,
	): boolean | null {
		void mediaLayout
		const elementType = element?.getData().type
		if (
			this.isMediaLabelsAlwaysVisible() &&
			(elementType === ElementTypeEnum.Image || elementType === ElementTypeEnum.Video)
		) {
			return null
		}

		if (this.renamingElementId === elementId) return false

		// 如果基础可见性为 false，不需要检查自定义逻辑
		if (!baseVisibility) {
			return null
		}

		// 文本已经按可用宽度设置 ellipsis；只有连最小文本宽度都没有时才隐藏。
		const state = this.labelLayoutStates.get(labelGroup)
		if (state && !state.canRenderText) return false
		// Keep the defensive path for callers that provide a label group created by
		// another implementation or a test double without layout state.
		if (!state) {
			const boundingRect = element?.getBoundingRect()
			const textNode = labelGroup.findOne("Text") as Konva.Text | null
			if (boundingRect && textNode) {
				const labelWidth = textNode.width() * labelGroup.scaleX()
				if (
					this.checkLabelExceedsElementWidth(
						{ x: labelGroup.x(), width: labelWidth },
						boundingRect,
					)
				)
					return false
			}
		}

		return null
	}

	private setupInteractionListeners(): void {
		this.listenInteraction("tool:change")
		this.listenInteraction("crop:enter")
		this.listenInteraction("crop:exit")
		this.listenInteraction("extend:enter")
		this.listenInteraction("extend:exit")
		this.listenInteraction("eraser:enter")
		this.listenInteraction("eraser:exit")
		this.listenInteraction("text:editing-state-change")

		this.interactionUnsubscribers.push(
			this.canvas.eventEmitter.on("permission:changed", () => {
				this.syncLabelListening()
				this.refreshRenameActions()
			}),
			this.canvas.eventEmitter.on("element:select", ({ data }) => {
				this.refreshIcons(data.elementIds)
			}),
			this.canvas.eventEmitter.on("element:deselect", ({ data }) => {
				this.refreshIcons(data?.elementIds)
			}),
			this.canvas.eventEmitter.on("element:hover", ({ data }) => {
				const previousHoveredElementId = this.canvasHoverElementId
				this.canvasHoverElementId = data.elementId
				this.refreshIcons(
					[previousHoveredElementId, data.elementId].filter(Boolean) as string[],
				)
				this.syncInteractiveNodesForElements([previousHoveredElementId, data.elementId])
			}),
			this.canvas.eventEmitter.on("element:updated", ({ data }) => {
				this.refreshIcons([data.elementId])
			}),
			this.canvas.eventEmitter.on("document:restored", () => {
				this.refreshIcons()
			}),
			this.canvas.eventEmitter.on("canvas:resize", () => this.hideTooltip()),
			this.canvas.eventEmitter.on("viewport:scale", () => this.hideTooltip()),
			this.canvas.eventEmitter.on("viewport:pan", () => this.hideTooltip()),
			this.canvas.eventEmitter.on("viewport:changed", () => this.hideTooltip()),
			this.canvas.eventEmitter.on("elements:transform:dragmove", () => this.hideTooltip()),
			this.canvas.eventEmitter.on("elements:transform:anchorDragmove", () =>
				this.hideTooltip(),
			),
		)
	}

	private listenInteraction<K extends keyof CanvasEventMap>(eventType: K): void {
		this.interactionUnsubscribers.push(
			this.canvas.eventEmitter.on(eventType, () => {
				this.syncLabelListening()
			}),
		)
	}

	/**
	 * 仅在选择工具且无独占编辑会话时接收命中。
	 * 平移/形状/裁剪等工具下必须关闭，避免挡住落笔或手柄。
	 */
	private areNameLabelsInteractive(): boolean {
		const { toolManager, cropManager, extendManager, eraserManager, textEditingManager } =
			this.canvas
		if (!toolManager?.getSelectionTool) return false
		if (toolManager.getActiveTool() !== toolManager.getSelectionTool()) return false
		if (cropManager?.getCroppingElementId()) return false
		if (extendManager?.getExtendingElementId()) return false
		if (eraserManager?.getErasingElementId()) return false
		if (textEditingManager?.isEditing()) return false
		return true
	}

	private syncLabelListening(): void {
		const listening = this.areNameLabelsInteractive()
		for (const labelGroup of this.labelMap.values()) {
			labelGroup.listening(listening)
		}
		if (
			this.pointerHoverElementId &&
			(!listening || !this.canvas.elementRenameManager?.canRename(this.pointerHoverElementId))
		) {
			this.clearPointerHover()
		}
		if (!listening) this.hideTooltip()
	}

	/** Permission changes can add or remove the rename action without changing label content. */
	private refreshRenameActions(): void {
		const layoutContext = BaseLabelManager.createLabelLayoutSyncContext()
		let requiresDraw = false
		for (const elementId of this.labelMap.keys()) {
			requiresDraw = this.updateLabelPosition(elementId, true, layoutContext) || requiresDraw
		}
		if (requiresDraw) this.requestOverlayDraw("name-label-permission")
	}

	private syncHitRect(labelGroup: Konva.Group): void {
		const labelSize = this.getLabelSize(labelGroup)
		const hitRect = labelGroup.findOne(`.${NAME_LABEL_HIT_NAME}`) as Konva.Rect | null
		if (!labelSize || !hitRect) return

		const padding = NAME_LABEL_CONFIG.HIT_PADDING
		const attrs = {
			x: -padding,
			y: -padding,
			width: Math.max(labelSize.width + padding * 2, padding * 2),
			height: Math.max(labelSize.height + padding * 2, padding * 2),
		}
		if (
			hitRect.x() !== attrs.x ||
			hitRect.y() !== attrs.y ||
			hitRect.width() !== attrs.width ||
			hitRect.height() !== attrs.height
		) {
			hitRect.setAttrs(attrs)
		}
	}

	private bindLabelInteraction(labelGroup: Konva.Group, elementId: string): void {
		const stopPointerEvent = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
			e.cancelBubble = true
			e.evt?.stopPropagation()
		}

		labelGroup.on("mousedown touchstart", (e) => {
			stopPointerEvent(e)
			this.selectElementFromLabel(elementId)
		})
		labelGroup.on("mouseup", (event) => {
			// 只截断 Konva 冒泡；原生 mouseup 必须到达 window，Konva 才能派发 dragend。
			event.cancelBubble = true
		})
		labelGroup.on("click tap", (e) => {
			stopPointerEvent(e)
		})
		const hitRect = labelGroup.findOne(`.${NAME_LABEL_HIT_NAME}`) as Konva.Rect | null
		hitRect?.on("mouseenter", () => {
			this.scheduleTooltip(this.getImageNameTooltipContent(elementId), hitRect)
		})
		hitRect?.on("mouseleave", () => this.hideTooltip())
		labelGroup.on("contextmenu", (e) => {
			e.evt.preventDefault()
			stopPointerEvent(e)
			this.selectElementFromLabel(elementId)
			this.canvas.eventEmitter.emit({
				type: "element:contextmenu",
				data: {
					elementId,
					x: e.evt.clientX,
					y: e.evt.clientY,
				},
			})
		})
		labelGroup.on("mouseenter", () => {
			const previousElementId = this.pointerHoverElementId
			this.pointerHoverElementId = elementId
			if (this.canvas.elementRenameManager?.canRename(elementId)) {
				this.canvas.cursorManager.setTemporary("pointer")
			}
			this.syncInteractiveNodesForElements([previousElementId, elementId])
		})
		labelGroup.on("mouseleave", () => {
			if (this.pointerHoverElementId === elementId) {
				this.clearPointerHover()
			}
		})
	}

	public isLabelPointerHovered(elementId: string): boolean {
		return this.pointerHoverElementId === elementId
	}

	public selectElementFromLabel(elementId: string, autoFocus = true): void {
		const elementData = this.canvas.elementManager.getElementData(elementId)
		if (!this.canvas.permissionManager.canSelect(elementData)) {
			return
		}
		if (this.canvas.selectionManager.isSelected(elementId)) {
			if (this.canvas.selectionManager.getSelectionCount() > 1) {
				this.canvas.selectionManager.replaceSelection([elementId], autoFocus)
			}
			return
		}
		this.canvas.connectionManager?.deselectConnection()
		this.canvas.selectionManager.replaceSelection([elementId], autoFocus)
	}

	private clearPointerHover(refreshVisibility = true): void {
		const previousElementId = this.pointerHoverElementId
		this.pointerHoverElementId = null
		this.canvas.cursorManager?.restoreToolCursor()
		this.hideTooltip()
		this.syncInteractiveNodesForElements([previousElementId])
		if (refreshVisibility && previousElementId) {
			this.updateLabelVisibility(previousElementId)
		}
	}
}
