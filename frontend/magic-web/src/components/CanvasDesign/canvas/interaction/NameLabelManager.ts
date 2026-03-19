import Konva from "konva"
import { ElementTypeEnum } from "../types"
import { BaseLabelManager, type BaseLabelManagerConfig } from "./BaseLabelManager"
import type { Canvas } from "../Canvas"

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
	/** 标签左侧对齐偏移（像素） */
	OFFSET_LEFT: 0,
} as const

/**
 * 名称标签管理器
 * 职责：
 * 1. 在独立的 Layer 上渲染所有元素的名称标签
 * 2. 监听元素变化，同步更新名称标签
 * 3. 管理名称标签的可见性（Frame 一直显示，Image 只在 hover 时显示）
 * 4. 处理名称标签的位置和缩放
 */
export class NameLabelManager extends BaseLabelManager {
	constructor(options: { canvas: Canvas }) {
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
				// 只有 Frame 和 Image 元素显示名称标签
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
		return element?.getNameLabelText() || ""
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

		// 由于标签应用了 inverseScale，在计算位置时需要将 labelHeight 和 offsetTop 也应用 inverseScale
		// 这样才能保证在不同缩放级别下，标签的视觉位置保持一致
		const scaledLabelHeight = labelSize.height * inverseScale
		const scaledOffsetTop = offsetTop * inverseScale

		// 计算标签位置（元素左上角上方）
		// 标签的 y 坐标 = 元素顶部 - 间距 - 标签高度
		// 这样标签的底部会距离元素顶部 offsetTop 的距离
		return {
			x: boundingRect.x + offsetLeft,
			y: boundingRect.y - scaledLabelHeight - scaledOffsetTop,
		}
	}

	/**
	 * 更新标签可见性（重写以添加智能隐藏逻辑）
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

		// 检查 name label 是否超出元素宽度
		const boundingRect = element.getBoundingRect()
		if (boundingRect) {
			const textNode = labelGroup.findOne("Text") as Konva.Text
			if (textNode) {
				// 获取标签的实际显示尺寸（考虑缩放）
				const scaleX = labelGroup.scaleX()
				const labelWidth = textNode.width() * scaleX
				const labelX = labelGroup.x()

				// 检测 name label 是否超出元素宽度
				if (
					this.checkLabelExceedsElementWidth(
						{ x: labelX, width: labelWidth },
						boundingRect,
					)
				) {
					shouldShow = false
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
