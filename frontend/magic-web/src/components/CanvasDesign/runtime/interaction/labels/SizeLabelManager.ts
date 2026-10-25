import Konva from "konva"
import type { Canvas } from "../../core/Canvas"
import { ElementTypeEnum } from "../../document/types"
import {
	BaseLabelManager,
	type BaseLabelManagerConfig,
	type LabelLayoutSyncContext,
	type LabelSize,
} from "./BaseLabelManager"
import type { MediaLabelLayout } from "./mediaLabelLayout"

/**
 * 尺寸标签配置
 */
const SIZE_LABEL_CONFIG = {
	/** 字体大小（像素） */
	FONT_SIZE: 12,
	/** 文本颜色 */
	TEXT_COLOR: "#737373",
	/** 字体族 */
	FONT_FAMILY: "Arial, sans-serif",
	/** 标签距离元素右侧的距离（像素） */
	OFFSET_TOP: 5,
	/** 标签右侧对齐偏移（像素） */
	OFFSET_RIGHT: 0,
} as const

/**
 * 尺寸标签管理器
 * 职责：
 * 1. 在独立的 Layer 上渲染所有元素的尺寸标签（width x height）
 * 2. 监听元素变化，同步更新尺寸标签
 * 3. 管理尺寸标签的可见性（媒体标签默认按 hover/选中显示，可通过画布设置常驻）
 * 4. 处理尺寸标签的位置和缩放
 * 5. 标签显示在元素右上角
 */
export class SizeLabelManager extends BaseLabelManager {
	private updatingLabelPositionElementIds = new Set<string>()

	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		// 构建基类配置
		const baseConfig: BaseLabelManagerConfig = {
			canvas,
			labelConfig: {
				fontSize: SIZE_LABEL_CONFIG.FONT_SIZE,
				textColor: SIZE_LABEL_CONFIG.TEXT_COLOR,
				fontFamily: SIZE_LABEL_CONFIG.FONT_FAMILY,
				offsetTop: SIZE_LABEL_CONFIG.OFFSET_TOP,
				offsetLeft: SIZE_LABEL_CONFIG.OFFSET_RIGHT, // 复用 offsetLeft 字段存储 offsetRight
			},
			visibilityConfig: {
				// 只有 Frame、Image 和 Video 元素显示尺寸标签
				elementTypes: new Set([
					ElementTypeEnum.Frame,
					ElementTypeEnum.Image,
					ElementTypeEnum.Video,
				]),
				// Frame 元素一直显示
				alwaysVisibleTypes: new Set([ElementTypeEnum.Frame]),
				// Image / Video 元素在选中或 hover 时显示
				hoverOrSelectTypes: new Set([ElementTypeEnum.Image, ElementTypeEnum.Video]),
			},
		}

		super(baseConfig)
	}

	/**
	 * Name labels reserve the independently eligible size label width. Refresh
	 * that sibling after the size label changes visibility or geometry, while
	 * keeping the coordination out of the per-frame name-label layout path.
	 */
	protected override updateLabelPosition(
		elementId: string,
		skipBatchDraw = false,
		context?: LabelLayoutSyncContext,
	): boolean {
		const previousVisible = this.isLabelVisibleForElement(elementId)
		const previousSize = this.getLabelSizeForElement(elementId)
		let result = false
		this.updatingLabelPositionElementIds.add(elementId)
		try {
			result = super.updateLabelPosition(elementId, skipBatchDraw, context)
		} finally {
			this.updatingLabelPositionElementIds.delete(elementId)
		}

		const nextVisible = this.isLabelVisibleForElement(elementId)
		const nextSize = this.getLabelSizeForElement(elementId)
		const visibilityChanged = previousVisible !== nextVisible
		const sizeChanged = this.hasLabelSizeChanged(previousSize, nextSize)
		if ((previousVisible || nextVisible) && (visibilityChanged || sizeChanged)) {
			this.canvas.nameLabelManager?.refreshLabelLayout(elementId, skipBatchDraw, context)
		}

		return result
	}

	protected override updateLabelVisibility(
		elementId: string,
		skipBatchDraw = false,
		mediaLayout?: MediaLabelLayout | null,
		context?: LabelLayoutSyncContext,
	): boolean {
		const visibilityChanged = super.updateLabelVisibility(
			elementId,
			skipBatchDraw,
			mediaLayout,
			context,
		)
		if (
			visibilityChanged &&
			this.labelMap.has(elementId) &&
			!this.updatingLabelPositionElementIds.has(elementId)
		) {
			this.canvas.nameLabelManager?.refreshLabelLayout(elementId, skipBatchDraw, context)
		}
		return visibilityChanged
	}

	/**
	 * Re-evaluates visibility after the name takes or releases the shared row.
	 * The guard keeps the one-way notification from recursively refreshing name.
	 */
	public refreshVisibilityForNamePriority(
		elementId: string,
		skipBatchDraw = false,
		context?: LabelLayoutSyncContext,
	): boolean {
		if (this.updatingLabelPositionElementIds.has(elementId)) return false

		this.updatingLabelPositionElementIds.add(elementId)
		try {
			return this.updateLabelVisibility(elementId, skipBatchDraw, undefined, context)
		} finally {
			this.updatingLabelPositionElementIds.delete(elementId)
		}
	}

	protected override removeLabel(elementId: string): void {
		const hadLabel = this.labelMap.has(elementId)
		super.removeLabel(elementId)
		if (hadLabel && !this.updatingLabelPositionElementIds.has(elementId)) {
			this.canvas.nameLabelManager?.refreshLabelLayout(elementId)
		}
	}

	private hasLabelSizeChanged(previous: LabelSize | null, next: LabelSize | null): boolean {
		if (previous === next) return false
		if (!previous || !next) return true
		return previous.width !== next.width || previous.height !== next.height
	}

	/**
	 * 尺寸标签只对产品允许展示的元素类型开放，同时要求元素本身支持尺寸编辑。
	 */
	protected override shouldShowLabel(elementId: string): boolean {
		if (!super.shouldShowLabel(elementId)) return false

		const element = this.canvas.elementManager.getElementInstance(elementId)
		return element?.supportsSizeEditing() ?? false
	}

	/**
	 * Reports eligibility without name-priority suppression so a hidden size
	 * label can be restored when the element becomes wide enough again.
	 */
	public isLabelEligibleForNamePriority(elementId: string): boolean {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		const labelGroup = this.labelMap.get(elementId)
		if (!element || !labelGroup || !this.shouldShowLabel(elementId)) return false
		return this.calculateBaseVisibility(elementId, element) === true
	}

	private doesLabelFitElementWidth(
		element: ReturnType<typeof this.canvas.elementManager.getElementInstance>,
		labelGroup: Konva.Group,
	): boolean {
		const boundingRect = element?.getBoundingRect()
		const textNode = labelGroup.findOne("Text") as Konva.Text | null
		if (!boundingRect || !textNode) return false

		const renderedWidth = textNode.width() * Math.abs(labelGroup.scaleX())
		return renderedWidth <= boundingRect.width
	}

	/**
	 * 获取标签文本
	 */
	protected getLabelText(elementId: string): string {
		const element = this.canvas.elementManager.getElementInstance(elementId)
		return element?.getSizeLabelText() || ""
	}

	/**
	 * 计算标签位置（元素右上角上方）
	 */
	protected calculateLabelPosition(
		boundingRect: { x: number; y: number; width: number; height: number },
		labelSize: { width: number; height: number },
		inverseScale: number,
	): { x: number; y: number } {
		const offsetTop = this.labelConfig.offsetTop
		const offsetRight = this.labelConfig.offsetLeft // 复用 offsetLeft 字段

		// 由于标签应用了 inverseScale，在计算位置时需要将尺寸和偏移也应用 inverseScale
		// 这样才能保证在不同缩放级别下，标签的视觉位置保持一致
		const scaledLabelWidth = labelSize.width * inverseScale
		const scaledLabelHeight = labelSize.height * inverseScale
		const scaledOffsetTop = offsetTop * inverseScale

		// 计算标签位置（元素右上角上方）
		// 标签的 x 坐标 = 元素右侧 - 标签宽度 - 右侧偏移
		// 标签的 y 坐标 = 元素顶部 - 间距 - 标签高度
		return {
			x: boundingRect.x + boundingRect.width - scaledLabelWidth - offsetRight,
			y: boundingRect.y - scaledLabelHeight - scaledOffsetTop,
		}
	}

	/**
	 * 计算自定义可见性（检查 size label 是否超出元素宽度）
	 * 图片和视频由统一的整行预算决定；其它元素沿用原有越界协作规则。
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
		const resolvedMediaLayout = mediaLayout ?? this.getMediaRowLayout(elementId)
		if (resolvedMediaLayout)
			return baseVisibility && resolvedMediaLayout.hasSpace && resolvedMediaLayout.showSize
		const elementType = element?.getData().type
		if (
			this.isMediaLabelsAlwaysVisible() &&
			(elementType === ElementTypeEnum.Image || elementType === ElementTypeEnum.Video)
		) {
			return null
		}

		// 如果基础可见性为 false，不需要检查自定义逻辑
		if (!baseVisibility) {
			return null
		}

		// 检查 size label 是否超出元素宽度
		const boundingRect = element?.getBoundingRect()
		if (boundingRect) {
			if (!this.doesLabelFitElementWidth(element, labelGroup)) return false

			// The name can ellipsize, whereas the size is all-or-nothing. Let the
			// complete name (including its status suffix) own the row first.
			if (this.canvas.nameLabelManager?.shouldSuppressSizeLabel(elementId)) {
				return false
			}

			// 保留其他标签的旧有越界协作规则。
			if (this.checkOtherLabelHiddenDueToWidth(elementId, this, boundingRect)) {
				return false
			}
		}

		// 不修改基础可见性
		return null
	}
}
