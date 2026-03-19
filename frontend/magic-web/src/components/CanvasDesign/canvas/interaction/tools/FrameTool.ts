import Konva from "konva"
import { BaseDrawingTool, type BaseDrawingToolOptions } from "./BaseDrawingTool"
import type { FrameElement } from "../../types"
import { ElementTypeEnum } from "../../types"
import { ElementFactory } from "../../element/ElementFactory"

/**
 * FrameTool 配置接口
 */
export interface FrameToolOptions extends BaseDrawingToolOptions {}

/**
 * 画框绘制工具
 * 用于绘制 Frame 元素
 */
export class FrameTool extends BaseDrawingTool {
	private previewFrame: Konva.Rect | null = null

	constructor(options: FrameToolOptions) {
		super(options)
	}

	/**
	 * 创建预览画框
	 */
	protected createPreview(x: number, y: number, width: number, height: number): void {
		this.clearPreview()

		this.previewFrame = new Konva.Rect({
			x,
			y,
			width: Math.abs(width),
			height: Math.abs(height),
			fill: "#FFFFFF",
			stroke: "#E5E5E5",
			strokeWidth: 1,
			listening: false,
		})

		this.toolLayer.add(this.previewFrame)
		this.toolLayer.batchDraw()
	}

	/**
	 * 更新预览画框
	 */
	protected updatePreview(x: number, y: number, width: number, height: number): void {
		if (!this.previewFrame) return

		// 标准化坐标和尺寸
		const normalizedX = width < 0 ? x + width : x
		const normalizedY = height < 0 ? y + height : y
		const normalizedWidth = Math.abs(width)
		const normalizedHeight = Math.abs(height)

		this.previewFrame.setAttrs({
			x: normalizedX,
			y: normalizedY,
			width: normalizedWidth,
			height: normalizedHeight,
		})

		this.toolLayer.batchDraw()
	}

	/**
	 * 清除预览画框
	 */
	protected clearPreview(): void {
		if (this.previewFrame) {
			this.previewFrame.destroy()
			this.previewFrame = null
			this.toolLayer.batchDraw()
		}
	}

	/**
	 * 创建画框元素
	 * @returns 创建的元素 ID
	 */
	protected createElement(x: number, y: number, width: number, height: number): string | null {
		if (!this.currentElementId) return null

		// 获取下一个 zIndex
		const newZIndex = this.getNextZIndex()

		// 使用 ElementFactory 创建元素数据
		const element = ElementFactory.createElementData(
			ElementTypeEnum.Frame,
			this.currentElementId,
			x,
			y,
			width,
			height,
			newZIndex,
		) as FrameElement

		// 禁用历史记录，避免创建时立即记录历史
		const historyManager = this.canvas.historyManager

		historyManager?.disable()

		try {
			this.canvas.elementManager.create(element)
			// 触发 frame:created 事件，保持与 FrameManager.createFrame() 的一致性
			this.canvas.eventEmitter.emit({ type: "frame:created", data: { frameId: element.id } })

			// 重新启用历史记录并立即记录一次
			if (historyManager) {
				historyManager.enable()
				historyManager.recordHistoryImmediate()
			}

			return element.id
		} catch (error) {
			// 发生错误时也要重新启用历史记录
			historyManager?.enable()
			throw error
		}
	}

	/**
	 * 销毁工具
	 */
	public destroy(): void {
		this.deactivate()
	}
}
