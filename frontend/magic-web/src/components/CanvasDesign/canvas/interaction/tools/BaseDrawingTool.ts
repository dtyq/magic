import Konva from "konva"
import { BaseTool, type ToolOptions } from "./BaseTool"
import { generateElementId } from "../../utils/utils"

/**
 * 基础绘制工具配置接口
 */
export interface BaseDrawingToolOptions extends ToolOptions {}

/**
 * 基础绘制工具抽象类
 * 提供绘制工具的通用逻辑，包括鼠标事件处理、键盘事件处理等
 */
export abstract class BaseDrawingTool extends BaseTool {
	protected isDrawing = false
	protected startPoint: { x: number; y: number } | null = null
	protected currentElementId: string | null = null
	protected previewNode: Konva.Node | null = null

	constructor(options: BaseDrawingToolOptions) {
		super(options)
	}

	/**
	 * 激活工具
	 */
	public activate(): void {
		this.isActive = true

		// 绑定事件
		this.canvas.stage.on("mousedown", this.handleMouseDown)
		this.canvas.stage.on("mousemove", this.handleMouseMove)
		this.canvas.stage.on("mouseup", this.handleMouseUp)
		window.addEventListener("keydown", this.handleKeyDown)
	}

	/**
	 * 停用工具
	 */
	public deactivate(): void {
		this.isActive = false

		// 清理预览
		this.clearPreview()

		// 解绑事件
		this.canvas.stage.off("mousedown", this.handleMouseDown)
		this.canvas.stage.off("mousemove", this.handleMouseMove)
		this.canvas.stage.off("mouseup", this.handleMouseUp)
		window.removeEventListener("keydown", this.handleKeyDown)

		// 重置状态
		this.resetDrawingState()
	}

	/**
	 * 处理鼠标按下事件
	 */
	private handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>): void => {
		// 只处理左键点击
		if (e.evt.button !== 0) return

		// 如果点击在已有元素上，不开始绘制
		const target = e.target
		if (target !== this.canvas.stage) return

		const pos = this.canvas.stage.getPointerPosition()
		if (!pos) return

		// 转换为画布坐标（考虑视口缩放和平移）
		const transform = this.canvas.stage.getAbsoluteTransform().copy().invert()
		const canvasPos = transform.point(pos)

		// 取消所有元素的选中状态
		this.canvas.selectionManager.deselectAll()

		// 开始绘制
		this.startDrawing(canvasPos)
	}

	/**
	 * 处理鼠标移动事件
	 */
	private handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>): void => {
		if (!this.isDrawing || !this.startPoint) return

		const pos = this.canvas.stage.getPointerPosition()
		if (!pos) return

		// 转换为画布坐标（考虑视口缩放和平移）
		const transform = this.canvas.stage.getAbsoluteTransform().copy().invert()
		const canvasPos = transform.point(pos)

		const width = canvasPos.x - this.startPoint.x
		const height = canvasPos.y - this.startPoint.y

		// 更新预览
		this.updatePreview(this.startPoint.x, this.startPoint.y, width, height)
	}

	/**
	 * 处理鼠标释放事件
	 */
	private handleMouseUp = (e: Konva.KonvaEventObject<MouseEvent>): void => {
		if (!this.isDrawing || !this.startPoint || !this.currentElementId) return

		const pos = this.canvas.stage.getPointerPosition()
		if (!pos) return

		// 转换为画布坐标（考虑视口缩放和平移）
		const transform = this.canvas.stage.getAbsoluteTransform().copy().invert()
		const canvasPos = transform.point(pos)

		const width = canvasPos.x - this.startPoint.x
		const height = canvasPos.y - this.startPoint.y

		// 只有当尺寸大于最小阈值时才创建元素
		const minSize = 5
		if (Math.abs(width) > minSize && Math.abs(height) > minSize) {
			// 标准化坐标和尺寸（处理负值情况）
			const x = width < 0 ? this.startPoint.x + width : this.startPoint.x
			const y = height < 0 ? this.startPoint.y + height : this.startPoint.y
			// 将宽高转换为整数
			const normalizedWidth = Math.round(Math.abs(width))
			const normalizedHeight = Math.round(Math.abs(height))

			// 创建元素
			const elementId = this.createElement(x, y, normalizedWidth, normalizedHeight)

			// 选中新创建的元素
			if (elementId) {
				this.canvas.selectionManager.selectMultiple([elementId])
				// 绘制完成后切回选择工具
				this.onTaskComplete()
			}
		}

		// 清理状态
		this.finishDrawing()
	}

	/**
	 * 处理键盘按下事件
	 */
	private handleKeyDown = (e: KeyboardEvent): void => {
		// 如果正在绘制且按下 ESC 键，取消绘制
		if (this.isDrawing && e.key === "Escape") {
			e.preventDefault()
			this.cancelDrawing()
		}
	}

	/**
	 * 开始绘制
	 */
	protected startDrawing(canvasPos: { x: number; y: number }): void {
		this.isDrawing = true
		this.startPoint = canvasPos
		this.currentElementId = generateElementId()

		// 创建预览
		this.createPreview(canvasPos.x, canvasPos.y, 0, 0)
	}

	/**
	 * 完成绘制
	 */
	protected finishDrawing(): void {
		this.clearPreview()
		this.resetDrawingState()
	}

	/**
	 * 取消绘制
	 */
	protected cancelDrawing(): void {
		this.clearPreview()
		this.resetDrawingState()
	}

	/**
	 * 重置绘制状态
	 */
	protected resetDrawingState(): void {
		this.isDrawing = false
		this.startPoint = null
		this.currentElementId = null
	}

	/**
	 * 获取当前最大的 zIndex（顶层元素的下一个 zIndex）
	 * 因为新元素总是创建在顶层，所以使用顶层元素的下一个 zIndex
	 */
	protected getNextZIndex(): number {
		return this.canvas.elementManager.getNextZIndexInLevel()
	}

	/**
	 * 创建预览（子类实现）
	 */
	protected abstract createPreview(x: number, y: number, width: number, height: number): void

	/**
	 * 更新预览（子类实现）
	 */
	protected abstract updatePreview(x: number, y: number, width: number, height: number): void

	/**
	 * 清除预览（子类实现）
	 */
	protected abstract clearPreview(): void

	/**
	 * 获取工具元数据
	 */
	public getMetadata() {
		return {
			name: "Drawing Tool",
			cursor: "crosshair" as const,
			isTemporary: false,
		}
	}

	/**
	 * 创建元素（子类实现）
	 * @returns 创建的元素 ID
	 */
	protected abstract createElement(
		x: number,
		y: number,
		width: number,
		height: number,
	): string | null
}
