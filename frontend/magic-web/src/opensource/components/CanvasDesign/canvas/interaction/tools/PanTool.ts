import { BaseTool, type ToolOptions } from "./BaseTool"

/**
 * 画布平移工具 - 提供画布拖拽平移功能
 * 使用 Konva 的原生 draggable 功能实现平移
 */
export class PanTool extends BaseTool {
	private wasDraggable = false

	constructor(options: ToolOptions) {
		super(options)

		// 绑定事件处理函数
		this.handleDragEnd = this.handleDragEnd.bind(this)
	}

	/**
	 * 激活工具
	 */
	public activate(): void {
		if (this.isActive) return
		this.isActive = true

		// 保存当前的 draggable 状态
		this.wasDraggable = this.canvas.stage.draggable()

		// 禁用所有元素的拖拽功能
		this.canvas.elementManager.disableElementDragging()

		// 启用 stage 的拖拽功能
		this.canvas.stage.draggable(true)

		// 监听拖拽事件
		this.canvas.stage.on("dragend", this.handleDragEnd)
		this.canvas.stage.on("dragmove", this.handleDragMove)
	}

	/**
	 * 停用工具
	 */
	public deactivate(): void {
		if (!this.isActive) return
		this.isActive = false

		// 移除事件监听
		this.canvas.stage.off("dragend", this.handleDragEnd)
		this.canvas.stage.off("dragmove", this.handleDragMove)

		// 恢复之前的 draggable 状态
		this.canvas.stage.draggable(this.wasDraggable)

		// 恢复所有元素的拖拽功能
		this.canvas.elementManager.enableElementDragging()
	}

	/**
	 * 处理拖拽移动事件
	 */
	private handleDragMove = (): void => {
		const position = this.canvas.stage.position()
		this.canvas.eventEmitter.emit({ type: "viewport:pan", data: position })
	}

	/**
	 * 处理拖拽结束事件
	 */
	private handleDragEnd(): void {
		const position = this.canvas.stage.position()
		this.canvas.eventEmitter.emit({ type: "viewport:pan", data: position })
	}

	/**
	 * 获取工具元数据
	 */
	public getMetadata() {
		return {
			name: "Pan Tool",
			cursor: "grab" as const,
			isTemporary: false,
		}
	}

	/**
	 * 任务完成时的处理
	 * 切换回选择工具（但拖动工具通常不会自动触发任务完成）
	 */
	protected onTaskComplete(): void {
		if (!this.canvas.toolManager) return

		// 切换到选择工具
		this.canvas.toolManager.switchToSelection()
	}

	/**
	 * 销毁工具
	 */
	public destroy(): void {
		this.deactivate()
	}
}
