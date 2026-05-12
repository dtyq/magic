import Konva from "konva"
import type { Canvas } from "../Canvas"
import { ElementTypeEnum } from "../types"

const ERASER_CURSOR_GROUP_NAME = "eraser-cursor-overlay"

const ERASER_CURSOR_CONFIG = {
	STROKE: "rgba(255, 255, 255, 0.95)",
	FILL: "rgba(147, 51, 234, 0.35)",
	STROKE_WIDTH: 1.5,
} as const

/**
 * 橡皮擦光标渲染器
 * 仅负责圆形橡皮 cursor 的 Konva 绘制与节点同步。
 */
export class EraserCursorRenderer {
	private canvas: Canvas
	private elementId: string
	private cursorGroup?: Konva.Group
	private cursorCircle?: Konva.Circle

	constructor(options: { canvas: Canvas; elementId: string }) {
		this.canvas = options.canvas
		this.elementId = options.elementId
	}

	public ensure(options?: { radius?: number }): void {
		const metrics = this.getElementMetrics()
		if (!metrics) return
		const { width, height } = metrics
		if (width <= 0 || height <= 0) return

		if (!this.cursorGroup) {
			this.cursorGroup = new Konva.Group({
				name: ERASER_CURSOR_GROUP_NAME,
				listening: false,
			})
			this.cursorCircle = new Konva.Circle({
				x: width / 2,
				y: height / 2,
				radius: options?.radius ?? 0,
				stroke: ERASER_CURSOR_CONFIG.STROKE,
				strokeWidth: ERASER_CURSOR_CONFIG.STROKE_WIDTH,
				fill: ERASER_CURSOR_CONFIG.FILL,
				visible: false,
				listening: false,
			})
			this.cursorGroup.add(this.cursorCircle)
			this.canvas.controlsLayer.add(this.cursorGroup)
		}

		this.syncTransform()
		if (typeof options?.radius === "number") {
			this.updateRadius(options.radius)
		}
	}

	public updatePositionFromStagePointer(): void {
		this.ensure()
		if (!this.cursorCircle) return

		const metrics = this.getElementMetrics()
		const pointer = this.canvas.stage.getPointerPosition()
		if (!metrics || !pointer) return

		const localPoint = metrics.elementNode.getAbsoluteTransform().copy().invert().point(pointer)

		this.updatePosition(localPoint)
	}

	public show(): void {
		this.ensure()
		if (!this.cursorGroup || !this.cursorCircle) return
		this.cursorCircle.visible(true)
		this.cursorGroup.moveToTop()
		this.canvas.controlsLayer.batchDraw()
	}

	public hide(): void {
		if (!this.cursorCircle) return
		this.cursorCircle.visible(false)
		this.canvas.controlsLayer.batchDraw()
	}

	public updatePosition(point: { x: number; y: number }): void {
		this.ensure()
		if (!this.cursorCircle) return
		this.cursorCircle.position(point)
		this.canvas.controlsLayer.batchDraw()
	}

	public syncTransform(): void {
		if (!this.cursorGroup) return

		const elementData = this.canvas.elementManager.getElementData(this.elementId)
		if (!elementData || elementData.type !== ElementTypeEnum.Image) return

		const elementInstance = this.canvas.elementManager.getElementInstance(this.elementId)
		const elementNode = elementInstance?.getNode()
		if (!elementNode) return

		const width = elementNode.width() ?? elementData.width ?? 0
		const height = elementNode.height() ?? elementData.height ?? 0
		if (width <= 0 || height <= 0) return

		this.cursorGroup.setAttrs({
			x: elementNode.x(),
			y: elementNode.y(),
			scaleX: elementNode.scaleX(),
			scaleY: elementNode.scaleY(),
			rotation: elementNode.rotation(),
			offset: { x: 0, y: 0 },
		})
		this.cursorGroup.moveToTop()
		this.canvas.controlsLayer.batchDraw()
	}

	public updateRadius(radius: number): void {
		if (!this.cursorCircle) return
		this.cursorCircle.radius(radius)
		this.canvas.controlsLayer.batchDraw()
	}

	public destroy(): void {
		if (this.cursorGroup) {
			this.cursorGroup.destroy()
			this.cursorGroup = undefined
			this.cursorCircle = undefined
			this.canvas.controlsLayer.batchDraw()
		}
	}

	private getElementMetrics(): { elementNode: Konva.Node; width: number; height: number } | null {
		const elementData = this.canvas.elementManager.getElementData(this.elementId)
		if (!elementData || elementData.type !== ElementTypeEnum.Image) return null

		const elementInstance = this.canvas.elementManager.getElementInstance(this.elementId)
		const elementNode = elementInstance?.getNode()
		if (!elementNode) return null

		return {
			elementNode,
			width: elementNode.width() ?? elementData.width ?? 0,
			height: elementNode.height() ?? elementData.height ?? 0,
		}
	}
}
