import Konva from "konva"
import { BaseMarker, type BaseMarkerOptions } from "./BaseMarker"
import type { MarkerArea } from "../../types"
import { AREA_MARKER_STYLES } from "./markerStyles"
import { ImageElement } from "../../element/elements/ImageElement"

/**
 * AreaMarker 类
 * 区域标记，使用矩形框 + 左上角圆圈
 */
export class AreaMarker extends BaseMarker {
	constructor(options: BaseMarkerOptions) {
		super(options)
		// 确保 marker 是 MarkerArea 类型
		if (this.marker.type !== 2) {
			throw new Error("AreaMarker requires a MarkerArea type")
		}
	}

	/**
	 * 获取区域尺寸（绝对像素值）
	 */
	private getAreaSize(): { width: number; height: number } | null {
		const elementInstance = this.canvas.elementManager.getElementInstance(this.marker.elementId)
		if (!elementInstance) return null

		const boundingRect = elementInstance.getBoundingRect()
		if (!boundingRect) return null

		const areaMarker = this.marker as MarkerArea
		const width = areaMarker.areaWidth * boundingRect.width
		const height = areaMarker.areaHeight * boundingRect.height

		return { width, height }
	}

	/**
	 * 渲染 Marker
	 */
	public render(): void {
		// 计算标记的绝对位置
		const position = this.calculatePosition()
		if (!position) return

		// 获取区域尺寸
		const areaSize = this.getAreaSize()
		if (!areaSize) return

		// 创建标记组
		this.group = new Konva.Group({
			x: position.x,
			y: position.y,
			name: "marker",
		})

		// 创建矩形区域的包裹组，使用 clipFunc 在左上角"挖掉"圆圈区域
		const rectGroup = new Konva.Group({
			x: 0,
			y: 0,
			name: "rect-group",
		})

		// 创建矩形区域
		const rect = new Konva.Rect({
			x: 0,
			y: 0,
			width: areaSize.width,
			height: areaSize.height,
			fill: AREA_MARKER_STYLES.AREA_FILL_COLOR,
			stroke: AREA_MARKER_STYLES.AREA_STROKE_COLOR,
			strokeWidth: AREA_MARKER_STYLES.AREA_STROKE_WIDTH,
			cornerRadius: AREA_MARKER_STYLES.AREA_CORNER_RADIUS,
		})

		// 将矩形添加到包裹组
		rectGroup.add(rect)

		// 创建左上角圆圈（圆心对齐左上角顶点）
		const circle = new Konva.Circle({
			x: 0,
			y: 0,
			radius: AREA_MARKER_STYLES.CIRCLE_RADIUS,
			fill: AREA_MARKER_STYLES.FILL_COLOR,
			stroke: AREA_MARKER_STYLES.STROKE_COLOR,
			strokeWidth: AREA_MARKER_STYLES.STROKE_WIDTH,
		})

		// 创建序号文本
		const text = new Konva.Text({
			text: String(this.sequence),
			fontSize: AREA_MARKER_STYLES.TEXT_FONT_SIZE,
			fontFamily: AREA_MARKER_STYLES.TEXT_FONT_FAMILY,
			fontStyle: AREA_MARKER_STYLES.TEXT_FONT_WEIGHT,
			fill: AREA_MARKER_STYLES.TEXT_COLOR,
			align: "center",
			verticalAlign: "middle",
		})

		// 居中文本（在圆圈中心）
		text.x(-text.width() / 2)
		text.y(-text.height() / 2)

		this.group.add(rectGroup)
		this.group.add(circle)
		this.group.add(text)

		// 设置默认透明度
		this.setGroupOpacity()

		// 设置反向缩放（保持固定大小）
		this.updateScale()

		// 添加到图层
		this.canvas.markersLayer.add(this.group)
	}

	/**
	 * 更新 Marker 位置（重写以处理区域尺寸）
	 */
	public updatePosition(): void {
		if (!this.group) return

		const position = this.calculatePosition()
		if (!position) return

		const areaSize = this.getAreaSize()
		if (!areaSize) return

		this.group.position(position)

		// 更新矩形尺寸
		const rectGroup = this.group.findOne(".rect-group") as Konva.Group
		if (rectGroup) {
			const rect = rectGroup.findOne("Rect") as Konva.Rect
			if (rect) {
				rect.width(areaSize.width)
				rect.height(areaSize.height)
			}
		}
	}

	/**
	 * 设置透明度
	 */
	private setGroupOpacity(): void {
		if (!this.group) return
		this.group.opacity(this.selectedMarkerId === this.marker.id ? 1 : 0.6)
	}

	/**
	 * 更新选中状态（重写以同时更新裁剪）
	 */
	public updateSelection(selectedMarkerId: string | null): void {
		this.selectedMarkerId = selectedMarkerId
		if (!this.group) return

		// 更新透明度
		this.setGroupOpacity()

		// 更新裁剪（根据选中状态决定是否应用）
		this.updateRectClip()
	}

	/**
	 * 更新矩形区域的裁剪（只在未选中时应用，避免透明时圆圈透视到矩形）
	 */
	private updateRectClip(): void {
		if (!this.group) return

		const rectGroup = this.group.findOne(".rect-group") as Konva.Group
		if (!rectGroup) return

		const isSelected = this.selectedMarkerId === this.marker.id

		// 只在未选中时应用裁剪，提升性能
		if (isSelected) {
			// 选中时移除裁剪
			rectGroup.clipFunc(null)
		} else {
			// 未选中时应用裁剪，避免圆圈透视到矩形
			const areaSize = this.getAreaSize()
			if (!areaSize) return

			const viewportScale = this.canvas.stage.scaleX()
			const inverseScale = 1 / viewportScale

			// clipRadius = 圆圈半径 + 圆圈描边宽度 + 矩形描边宽度的一半 + 额外间隙
			const circleRadius = AREA_MARKER_STYLES.CIRCLE_RADIUS * inverseScale
			const strokeWidth = AREA_MARKER_STYLES.STROKE_WIDTH * 2 * inverseScale

			rectGroup.clipFunc((ctx) => {
				// 使用 evenodd 填充规则实现"挖洞"效果
				ctx.arc(0, 0, circleRadius, 0, Math.PI * 2, true)
				ctx.rect(
					-1 * inverseScale * AREA_MARKER_STYLES.STROKE_WIDTH,
					-1 * inverseScale * AREA_MARKER_STYLES.STROKE_WIDTH,
					areaSize.width + strokeWidth,
					areaSize.height + strokeWidth,
				)
			})
		}
	}

	/**
	 * 更新 Marker 缩放（重写以只缩放边框、圆圈和文字，不缩放区域尺寸）
	 */
	public updateScale(): void {
		if (!this.group) return

		const viewportScale = this.canvas.stage.scaleX()
		const inverseScale = 1 / viewportScale

		// 更新矩形区域
		const rectGroup = this.group.findOne(".rect-group") as Konva.Group
		if (rectGroup) {
			const rect = rectGroup.findOne("Rect") as Konva.Rect
			if (rect) {
				rect.strokeWidth(AREA_MARKER_STYLES.AREA_STROKE_WIDTH * inverseScale)
				rect.cornerRadius(AREA_MARKER_STYLES.AREA_CORNER_RADIUS * inverseScale)
			}
		}

		// 更新圆圈
		const circle = this.group.findOne("Circle") as Konva.Circle
		if (circle) {
			circle.radius(AREA_MARKER_STYLES.CIRCLE_RADIUS * inverseScale)
			circle.strokeWidth(AREA_MARKER_STYLES.STROKE_WIDTH * inverseScale)
		}

		// 更新文本
		const text = this.group.findOne("Text") as Konva.Text
		if (text) {
			text.fontSize(AREA_MARKER_STYLES.TEXT_FONT_SIZE * inverseScale)
			// 重新居中文本
			text.x(-text.width() / 2)
			text.y(-text.height() / 2)
		}

		// 更新裁剪（根据选中状态决定是否应用）
		this.updateRectClip()
	}

	/**
	 * 在 Canvas 上绘制 Marker（用于图片合成）
	 * @param ctx Canvas 2D 上下文
	 * @param x Marker X 坐标（左上角）
	 * @param y Marker Y 坐标（左上角）
	 */
	public drawOnCanvas(ctx: CanvasRenderingContext2D, x: number, y: number): void {
		ctx.save()

		// 获取图片的自然尺寸来计算区域尺寸
		const elementInstance = this.canvas.elementManager.getElementInstance(this.marker.elementId)
		if (!elementInstance || !(elementInstance instanceof ImageElement)) {
			ctx.restore()
			return
		}

		const imageInfo = elementInstance.getImageInfo()
		if (!imageInfo) {
			ctx.restore()
			return
		}

		const areaMarker = this.marker as MarkerArea
		const areaWidth = areaMarker.areaWidth * imageInfo.naturalWidth
		const areaHeight = areaMarker.areaHeight * imageInfo.naturalHeight

		// 绘制矩形区域
		ctx.fillStyle = AREA_MARKER_STYLES.AREA_FILL_COLOR
		ctx.strokeStyle = AREA_MARKER_STYLES.AREA_STROKE_COLOR
		ctx.lineWidth = AREA_MARKER_STYLES.AREA_STROKE_WIDTH

		// 绘制圆角矩形
		this.drawRoundedRect(
			ctx,
			x,
			y,
			areaWidth,
			areaHeight,
			AREA_MARKER_STYLES.AREA_CORNER_RADIUS,
		)
		ctx.fill()
		ctx.stroke()

		// 绘制左上角圆圈（圆心对齐左上角顶点）
		ctx.beginPath()
		ctx.arc(x, y, AREA_MARKER_STYLES.CIRCLE_RADIUS, 0, Math.PI * 2)
		ctx.fillStyle = AREA_MARKER_STYLES.FILL_COLOR
		ctx.fill()
		ctx.strokeStyle = AREA_MARKER_STYLES.STROKE_COLOR
		ctx.lineWidth = AREA_MARKER_STYLES.STROKE_WIDTH
		ctx.stroke()

		// 绘制序号文本
		ctx.font = `${AREA_MARKER_STYLES.TEXT_FONT_WEIGHT} ${AREA_MARKER_STYLES.TEXT_FONT_SIZE}px ${AREA_MARKER_STYLES.TEXT_FONT_FAMILY}`
		ctx.fillStyle = AREA_MARKER_STYLES.TEXT_COLOR
		ctx.textAlign = "center"
		ctx.textBaseline = "middle"
		ctx.fillText(String(this.sequence), x, y)

		ctx.restore()
	}

	/**
	 * 绘制圆角矩形路径
	 */
	private drawRoundedRect(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		width: number,
		height: number,
		radius: number,
	): void {
		ctx.beginPath()
		ctx.moveTo(x + radius, y)
		ctx.lineTo(x + width - radius, y)
		ctx.arcTo(x + width, y, x + width, y + radius, radius)
		ctx.lineTo(x + width, y + height - radius)
		ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius)
		ctx.lineTo(x + radius, y + height)
		ctx.arcTo(x, y + height, x, y + height - radius, radius)
		ctx.lineTo(x, y + radius)
		ctx.arcTo(x, y, x + radius, y, radius)
		ctx.closePath()
	}
}
