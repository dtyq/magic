import Konva from "konva"
import type { Canvas } from "../Canvas"
import { ElementTypeEnum } from "../types"
import { BaseLabelManager, type BaseLabelManagerConfig } from "./BaseLabelManager"

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
 * 3. 管理尺寸标签的可见性（Frame 一直显示，Image 只在 hover 时显示）
 * 4. 处理尺寸标签的位置和缩放
 * 5. 标签显示在元素右上角
 */
export class SizeLabelManager extends BaseLabelManager {
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
				// 只有 Frame 和 Image 元素显示尺寸标签
				elementTypes: new Set([ElementTypeEnum.Frame, ElementTypeEnum.Image]),
				// Frame 元素一直显示
				alwaysVisibleTypes: new Set([ElementTypeEnum.Frame]),
				// Image 元素在选中或 hover 时显示
				hoverOrSelectTypes: new Set([ElementTypeEnum.Image]),
			},
		}

		super(baseConfig)
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
	 * 更新标签可见性（重写以添加智能隐藏逻辑）
	 * 当标签重叠时，优先隐藏 size label
	 * @param elementId - 元素 ID
	 * @param skipBatchDraw - 是否跳过 batchDraw（用于批量更新时统一调用）
	 */
	protected updateLabelVisibility(elementId: string, skipBatchDraw = false): void {
		const labelGroup = this.labelMap.get(elementId)
		if (!labelGroup) {
			return
		}

		const element = this.canvas.elementManager.getElementInstance(elementId)
		if (!element) {
			labelGroup.visible(false)
			if (!skipBatchDraw) {
				this.canvas.overlayLayer.batchDraw()
			}
			return
		}

		const elementData = element.getData()
		const elementType = elementData.type

		let shouldShow = false

		// 检查是否为一直显示的类型
		if (this.visibilityConfig.alwaysVisibleTypes.has(elementType)) {
			shouldShow = true
		}
		// 检查是否为选中或 hover 时显示的类型
		else if (this.visibilityConfig.hoverOrSelectTypes.has(elementType)) {
			const isSelected = this.canvas.selectionManager.isSelected(elementId)
			const hoveredId = this.canvas.hoverManager.getHoveredElementId()
			const isHovered = hoveredId === elementId
			shouldShow = isHovered || isSelected
		}

		// 如果基础可见性为 false，直接隐藏
		if (!shouldShow) {
			labelGroup.visible(false)
			if (!skipBatchDraw) {
				this.canvas.overlayLayer.batchDraw()
			}
			return
		}

		// 检查 size label 是否超出元素宽度或与其他标签重叠
		const boundingRect = element.getBoundingRect()
		const textNode = labelGroup.findOne("Text") as Konva.Text
		if (textNode && boundingRect) {
			const scaleX = labelGroup.scaleX()
			const scaleY = labelGroup.scaleY()
			const sizeLabelBounds = {
				x: labelGroup.x(),
				y: labelGroup.y(),
				width: textNode.width() * scaleX,
				height: textNode.height() * scaleY,
			}

			// 检查 size label 是否超出元素宽度（从右侧超出）
			// size label 是从右侧对齐的，如果元素宽度太小，size label 可能会超出左侧边界
			if (sizeLabelBounds.x < boundingRect.x) {
				shouldShow = false
			}

			// 如果还没有被隐藏，检查其他标签是否因为超出元素宽度而隐藏
			// 如果 name label 存在但不可见，且会超出元素宽度，说明空间太小，size label 也应该隐藏
			if (shouldShow && this.checkOtherLabelHiddenDueToWidth(elementId, this, boundingRect)) {
				// 其他标签因为超出元素宽度而隐藏，说明空间太小，size label 也应该隐藏
				shouldShow = false
			}

			// 如果还没有被隐藏，检查是否与其他可见标签重叠
			if (shouldShow) {
				// 获取其他标签的位置信息
				const otherLabelBounds = this.getOtherLabelBounds(elementId, this)

				// 检查是否与其他标签重叠
				for (const otherBounds of otherLabelBounds) {
					if (this.checkRectOverlap(sizeLabelBounds, otherBounds)) {
						// 如果重叠，隐藏 size label
						shouldShow = false
						break
					}
				}
			}
		}

		labelGroup.visible(shouldShow)

		// 触发重绘（批量更新时跳过，由调用方统一调用）
		if (!skipBatchDraw) {
			this.canvas.overlayLayer.batchDraw()
		}
	}
}
