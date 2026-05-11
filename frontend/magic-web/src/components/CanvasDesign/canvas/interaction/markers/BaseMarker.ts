import Konva from "konva"
import type { Marker } from "../../types"
import type { Canvas } from "../../Canvas"

/**
 * BaseMarker 构造函数选项
 */
export interface BaseMarkerOptions {
	/** Marker 数据 */
	marker: Marker
	/** Canvas 实例 */
	canvas: Canvas
	/** 序号（从1开始） */
	sequence: number
	/** 当前工具类型 */
	currentTool: string | null
}

/**
 * BaseMarker 抽象基类
 * 提供 Marker 的通用功能，子类实现具体的渲染逻辑
 */
export abstract class BaseMarker {
	protected marker: Marker
	protected canvas: Canvas
	protected sequence: number
	protected group: Konva.Group | null = null
	protected currentTool: string | null
	protected isHoveringDelete = false
	protected isDeletePressing = false

	constructor(options: BaseMarkerOptions) {
		this.marker = options.marker
		this.canvas = options.canvas
		this.sequence = options.sequence
		this.currentTool = options.currentTool
	}

	/**
	 * 渲染 Marker（抽象方法，由子类实现）
	 */
	public abstract render(): void

	/**
	 * 更新 hover 删除态样式
	 */
	protected abstract updateDeleteHoverState(isHovering: boolean): void

	/**
	 * 获取删除交互的命中节点
	 */
	protected abstract getDeleteInteractionNode(): Konva.Node | null

	/**
	 * 获取删除态文字节点
	 */
	protected abstract getDeleteLabelNode(): Konva.Text | null

	/**
	 * 获取删除态背景节点
	 */
	protected abstract getDeleteBackgroundNode(): Konva.Shape | null

	/**
	 * 获取删除态背景颜色配置
	 */
	protected abstract getDeleteBackgroundColorConfig(): {
		hoverColor: string
		activeColor: string
	}

	/**
	 * 在 Canvas 上绘制 Marker（用于图片合成）
	 * @param ctx Canvas 2D 上下文
	 * @param x Marker X 坐标
	 * @param y Marker Y 坐标
	 */
	public abstract drawOnCanvas(ctx: CanvasRenderingContext2D, x: number, y: number): void

	/**
	 * 获取 Konva Group 节点
	 */
	public getGroup(): Konva.Group | null {
		return this.group
	}

	/**
	 * 计算 Marker 的绝对位置
	 */
	protected calculatePosition(): { x: number; y: number } | null {
		const elementInstance = this.canvas.elementManager.getElementInstance(this.marker.elementId)
		if (!elementInstance) return null

		const boundingRect = elementInstance.getBoundingRect()
		if (!boundingRect) return null

		const elementX = boundingRect.x
		const elementY = boundingRect.y
		const elementWidth = boundingRect.width
		const elementHeight = boundingRect.height

		// 从相对位置计算绝对位置
		const absoluteX = elementX + this.marker.relativeX * elementWidth
		const absoluteY = elementY + this.marker.relativeY * elementHeight

		return { x: absoluteX, y: absoluteY }
	}

	/**
	 * 更新 Marker 位置
	 */
	public updatePosition(): void {
		if (!this.group) return

		const position = this.calculatePosition()
		if (position) {
			this.group.position(position)
		}
	}

	/**
	 * 更新 Marker 缩放（保持固定大小）
	 */
	public updateScale(): void {
		if (!this.group) return

		const viewportScale = this.canvas.stage.scaleX()
		const inverseScale = 1 / viewportScale
		this.group.scale({ x: inverseScale, y: inverseScale })
	}

	/**
	 * 更新当前工具
	 */
	public updateCurrentTool(currentTool: string | null): void {
		this.currentTool = currentTool
	}

	/**
	 * 设置点击事件处理（阻止冒泡，避免点击标记时选中底层元素）
	 */
	public setupClickHandler(onDelete: (markerId: string) => void): void {
		const interactionNode = this.getDeleteInteractionNode()
		if (!interactionNode) return

		interactionNode.on("mousedown touchstart", (e) => {
			e.cancelBubble = true
			if (!this.canDeleteFromInteraction()) return

			this.isDeletePressing = true
			this.updateDeleteActiveState(true)
			this.canvas.markersLayer.batchDraw()
		})

		interactionNode.on("mouseup touchend", (e) => {
			e.cancelBubble = true
			if (!this.isHoveringDelete) return

			this.isDeletePressing = false
			this.updateDeleteActiveState(false)
			this.canvas.markersLayer.batchDraw()
		})

		interactionNode.on("click", (e) => {
			e.cancelBubble = true
			if (!this.canDeleteFromInteraction()) return

			this.isDeletePressing = false
			this.canvas.cursorManager.restoreToolCursor()
			onDelete(this.marker.id)
		})
	}

	/**
	 * 设置 hover 事件处理
	 */
	public setupHoverHandler(): void {
		const interactionNode = this.getDeleteInteractionNode()
		if (!interactionNode) return

		interactionNode.on("mouseenter", () => {
			if (!this.canDeleteFromInteraction()) return

			this.isHoveringDelete = true
			this.isDeletePressing = false
			this.updateDeleteHoverState(true)
			this.updateDeleteActiveState(false)
			this.canvas.cursorManager.setTemporary("pointer")
			this.canvas.markersLayer.batchDraw()
		})

		interactionNode.on("mouseleave", () => {
			if (!this.isHoveringDelete) return

			this.isHoveringDelete = false
			this.isDeletePressing = false
			this.updateDeleteHoverState(false)
			this.updateDeleteActiveState(false)
			this.canvas.cursorManager.restoreToolCursor()
			this.canvas.markersLayer.batchDraw()
		})
	}

	protected updateDeleteActiveState(isActive: boolean): void {
		const backgroundNode = this.getDeleteBackgroundNode()
		if (!backgroundNode) return

		const { activeColor, hoverColor } = this.getDeleteBackgroundColorConfig()
		if (!this.isHoveringDelete) {
			this.updateDeleteHoverState(false)
			return
		}

		backgroundNode.fill(isActive ? activeColor : hoverColor)
	}

	private canDeleteFromInteraction(): boolean {
		if (!this.canvas.permissionManager.canDeleteMarker()) return false
		if (!this.canvas.permissionManager.canUseSelectionToolAffordance()) return false
		return true
	}

	/**
	 * 销毁 Marker
	 */
	public destroy(): void {
		if (this.group) {
			this.group.destroy()
			this.group = null
		}
	}
}
