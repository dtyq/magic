import Konva from "konva"
import type { Marker } from "../../types"
import type { Canvas } from "../../Canvas"
import { ToolTypeEnum } from "../../types"

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
	/** 当前选中的 Marker ID */
	selectedMarkerId: string | null
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
	protected selectedMarkerId: string | null
	protected currentTool: string | null

	constructor(options: BaseMarkerOptions) {
		this.marker = options.marker
		this.canvas = options.canvas
		this.sequence = options.sequence
		this.selectedMarkerId = options.selectedMarkerId
		this.currentTool = options.currentTool
	}

	/**
	 * 渲染 Marker（抽象方法，由子类实现）
	 */
	public abstract render(): void

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
	 * 更新选中状态
	 */
	public updateSelection(selectedMarkerId: string | null): void {
		this.selectedMarkerId = selectedMarkerId
		if (!this.group) return

		if (this.selectedMarkerId === this.marker.id) {
			this.group.opacity(1) // 选中时完全不透明
		} else {
			this.group.opacity(0.6) // 未选中时半透明
		}
	}

	/**
	 * 更新当前工具
	 */
	public updateCurrentTool(currentTool: string | null): void {
		this.currentTool = currentTool
	}

	/**
	 * 设置点击事件处理
	 */
	public setupClickHandler(onSelect: (markerId: string) => void, onDeselect: () => void): void {
		if (!this.group) return

		this.group.on("click", (e) => {
			e.cancelBubble = true
			// 只有在选择工具激活时才允许选中标记
			if (this.currentTool === ToolTypeEnum.Select) {
				// 如果点击的是已选中的marker，取消选中
				if (this.selectedMarkerId === this.marker.id) {
					onDeselect()
				} else {
					// 否则选中该marker
					onSelect(this.marker.id)
				}
			}
		})
	}

	/**
	 * 设置 hover 事件处理
	 */
	public setupHoverHandler(): void {
		if (!this.group) return

		this.group.on("mouseenter", () => {
			// 只有在选择工具激活时才显示 pointer 光标
			if (this.currentTool === ToolTypeEnum.Select) {
				this.canvas.cursorManager.setTemporary("pointer")
			}
		})

		this.group.on("mouseleave", () => {
			// 只有在选择工具激活时才恢复光标
			if (this.currentTool === ToolTypeEnum.Select) {
				this.canvas.cursorManager.restoreToolCursor()
			}
		})
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
