import Konva from "konva"
import { BaseDrawingTool, type BaseDrawingToolOptions } from "./BaseDrawingTool"
import type {
	RectangleElement,
	EllipseElement,
	TriangleElement,
	StarElement,
	ElementType,
} from "../../types"
import { ElementFactory } from "../../element/ElementFactory"

/**
 * ShapeTool 配置接口
 */
export interface ShapeToolOptions extends BaseDrawingToolOptions {
	shapeType: ElementType
}

/**
 * 形状绘制工具
 * 支持绘制矩形、圆形、三角形和星形
 */
export class ShapeTool extends BaseDrawingTool {
	private shapeType: ElementType
	private previewShape: Konva.Shape | null = null

	constructor(options: ShapeToolOptions) {
		super(options)
		this.shapeType = options.shapeType
	}

	/**
	 * 创建预览形状
	 * 绘制工具内部实现预览，不依赖元素系统
	 */
	protected createPreview(x: number, y: number, width: number, height: number): void {
		this.clearPreview()

		const normalizedWidth = Math.abs(width)
		const normalizedHeight = Math.abs(height)

		// 确保最小尺寸
		const minSize = 1
		const safeWidth = Math.max(normalizedWidth, minSize)
		const safeHeight = Math.max(normalizedHeight, minSize)

		// 创建临时元素数据
		const tempElement = this.createTempElement(x, y, safeWidth, safeHeight)

		// 直接创建预览节点
		const node = this.createPreviewNode(tempElement)

		if (node) {
			// 应用预览样式：虚线边框和半透明填充
			const fill = node.fill()
			if (fill) {
				node.fill(this.addAlphaToColor(fill as string, 0.1))
			}
			node.dash([5, 5])
			node.listening(false)

			this.previewShape = node
			this.toolLayer.add(this.previewShape)
			this.toolLayer.batchDraw()
		}
	}

	/**
	 * 更新预览形状
	 */
	protected updatePreview(x: number, y: number, width: number, height: number): void {
		if (!this.previewShape) return

		// 标准化坐标和尺寸
		const normalizedX = width < 0 ? x + width : x
		const normalizedY = height < 0 ? y + height : y
		const normalizedWidth = Math.abs(width)
		const normalizedHeight = Math.abs(height)

		// 确保最小尺寸
		const minSize = 1
		const safeWidth = Math.max(normalizedWidth, minSize)
		const safeHeight = Math.max(normalizedHeight, minSize)

		// 更新预览节点属性
		this.updatePreviewNode(this.previewShape, normalizedX, normalizedY, safeWidth, safeHeight)

		this.toolLayer.batchDraw()
	}

	/**
	 * 清除预览形状
	 */
	protected clearPreview(): void {
		if (this.previewShape) {
			this.previewShape.destroy()
			this.previewShape = null
			this.toolLayer.batchDraw()
		}
	}

	/**
	 * 创建临时元素数据（用于预览）
	 */
	private createTempElement(
		x: number,
		y: number,
		width: number,
		height: number,
	): RectangleElement | EllipseElement | TriangleElement | StarElement {
		return ElementFactory.createElementData(
			this.shapeType,
			"temp-preview",
			x,
			y,
			width,
			height,
			0,
		) as RectangleElement | EllipseElement | TriangleElement | StarElement
	}

	/**
	 * 创建预览节点（绘制工具内部实现）
	 */
	private createPreviewNode(
		element: RectangleElement | EllipseElement | TriangleElement | StarElement,
	): Konva.Shape | null {
		switch (element.type) {
			case "rectangle":
				return new Konva.Rect({
					x: element.x,
					y: element.y,
					width: element.width,
					height: element.height,
					fill: element.fill,
					stroke: element.stroke,
					strokeWidth: element.strokeWidth,
					cornerRadius: element.cornerRadius,
				})

			case "ellipse":
				if (!element.width || !element.height) return null
				return new Konva.Ellipse({
					x: element.x,
					y: element.y,
					radiusX: element.width / 2,
					radiusY: element.height / 2,
					offsetX: -element.width / 2,
					offsetY: -element.height / 2,
					fill: element.fill,
					stroke: element.stroke,
					strokeWidth: element.strokeWidth,
				})

			case "triangle":
				if (!element.width || !element.height) return null
				return new Konva.Line({
					x: element.x,
					y: element.y,
					points: [
						element.width / 2,
						0,
						0,
						element.height,
						element.width,
						element.height,
					],
					closed: true,
					fill: element.fill,
					stroke: element.stroke,
					strokeWidth: element.strokeWidth,
				})

			case "star": {
				const starElement = element as StarElement
				if (
					!starElement.width ||
					!starElement.height ||
					!starElement.sides ||
					!starElement.innerRadiusRatio
				)
					return null
				const radius = Math.min(starElement.width, starElement.height) / 2
				return new Konva.Star({
					x: starElement.x,
					y: starElement.y,
					numPoints: starElement.sides,
					innerRadius: radius * starElement.innerRadiusRatio,
					outerRadius: radius,
					offsetX: -starElement.width / 2,
					offsetY: -starElement.height / 2,
					fill: starElement.fill,
					stroke: starElement.stroke,
					strokeWidth: starElement.strokeWidth,
				})
			}

			default:
				return null
		}
	}

	/**
	 * 更新预览节点（绘制工具内部实现）
	 */
	private updatePreviewNode(
		node: Konva.Shape,
		x: number,
		y: number,
		width: number,
		height: number,
	): void {
		if (node instanceof Konva.Rect) {
			node.setAttrs({ x, y, width, height })
		} else if (node instanceof Konva.Ellipse) {
			node.setAttrs({
				x,
				y,
				radiusX: width / 2,
				radiusY: height / 2,
				offsetX: -width / 2,
				offsetY: -height / 2,
			})
		} else if (node instanceof Konva.Line) {
			node.setAttrs({
				x,
				y,
				points: [width / 2, 0, 0, height, width, height],
			})
		} else if (node instanceof Konva.Star) {
			const radius = Math.min(width, height) / 2
			// 从临时元素获取 sides 和 innerRadiusRatio
			const tempElement = this.createTempElement(x, y, width, height) as StarElement
			node.setAttrs({
				x,
				y,
				numPoints: tempElement.sides ?? 5,
				innerRadius: radius * (tempElement.innerRadiusRatio ?? 0.4),
				outerRadius: radius,
				offsetX: -width / 2,
				offsetY: -height / 2,
			})
		}
	}

	/**
	 * 创建形状元素
	 * @returns 创建的元素 ID
	 */
	protected createElement(x: number, y: number, width: number, height: number): string | null {
		if (!this.currentElementId) return null

		// 获取下一个 zIndex
		const newZIndex = this.getNextZIndex()

		// 创建元素数据（复用 createTempElement 的逻辑）
		const element = this.createTempElement(x, y, width, height)

		// 更新为真实的 ID 和 zIndex
		element.id = this.currentElementId
		element.zIndex = newZIndex

		this.canvas.elementManager.create(element)
		return element.id
	}

	/**
	 * 为颜色添加透明度
	 * @param color - 颜色值（支持 hex、rgb、rgba）
	 * @param alpha - 透明度值（0-1）
	 * @returns 带透明度的颜色值
	 */
	private addAlphaToColor(color: string, alpha: number): string {
		// 如果已经是 rgba 格式，提取 rgb 部分
		if (color.startsWith("rgba")) {
			const match = color.match(/rgba?\(([^)]+)\)/)
			if (match) {
				const rgb = match[1].split(",").slice(0, 3).join(",")
				return `rgba(${rgb}, ${alpha})`
			}
		}

		// 如果是 rgb 格式
		if (color.startsWith("rgb")) {
			const match = color.match(/rgb\(([^)]+)\)/)
			if (match) {
				return `rgba(${match[1]}, ${alpha})`
			}
		}

		// 如果是 hex 格式
		if (color.startsWith("#")) {
			const hex = color.slice(1)
			const r = parseInt(hex.slice(0, 2), 16)
			const g = parseInt(hex.slice(2, 4), 16)
			const b = parseInt(hex.slice(4, 6), 16)
			return `rgba(${r}, ${g}, ${b}, ${alpha})`
		}

		// 默认返回带透明度的颜色
		return `rgba(0, 0, 0, ${alpha})`
	}

	/**
	 * 销毁工具
	 */
	public destroy(): void {
		this.deactivate()
	}
}
