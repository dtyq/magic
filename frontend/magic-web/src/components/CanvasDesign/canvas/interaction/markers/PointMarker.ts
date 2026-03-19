import Konva from "konva"
import { BaseMarker, type BaseMarkerOptions } from "./BaseMarker"
import { POINT_MARKER_STYLES } from "./markerStyles"

// 绘制水滴形状（使用 SVG 路径）
const DROLET_SVG_PATH =
	"M13.1787 1C19.7855 1 25.1774 6.3051 25.3525 12.9395L25.3574 13.2559C25.3571 16.5024 24.0723 19.6171 21.7842 21.9229L13.1787 30.5811L4.57227 21.9229L4.57129 21.9219L4.16797 21.4961C2.19843 19.3205 1.00001 16.4324 1 13.2549C1 6.47523 6.45692 1 13.1787 1Z"

/**
 * PointMarker 类
 * 点标记，使用水滴形状
 */
export class PointMarker extends BaseMarker {
	constructor(options: BaseMarkerOptions) {
		super(options)
	}

	/**
	 * 创建水滴形状（使用 SVG 路径）
	 */
	private createDropletShape(): Konva.Path {
		// 使用 marker.svg 的路径数据
		// SVG viewBox: 0 0 27 32, 中心点在 13.1787
		// 需要将坐标转换为以中心为原点，并调整到目标尺寸
		const svgPath = DROLET_SVG_PATH

		// SVG 原始尺寸：27 x 32（包含边框）
		// 目标尺寸：26.5 x 32（包含边框）
		const svgWidth = 27
		const svgHeight = 32
		const svgCenterX = 13.1787

		// 计算缩放比例
		const scaleX = POINT_MARKER_STYLES.WIDTH / svgWidth
		const scaleY = POINT_MARKER_STYLES.HEIGHT / svgHeight

		return new Konva.Path({
			data: svgPath,
			// 偏移使中心点对齐
			offsetX: svgCenterX,
			offsetY: svgHeight, // 底部尖角对齐到原点
			scaleX: scaleX,
			scaleY: scaleY,
		})
	}

	/**
	 * 渲染 Marker
	 */
	public render(): void {
		// 计算标记的绝对位置
		const position = this.calculatePosition()
		if (!position) return

		// 创建标记组
		this.group = new Konva.Group({
			x: position.x,
			y: position.y,
			name: "marker",
		})

		// 创建水滴形状背景
		// 使用 SVG 路径，尖角已通过 offsetY 对齐到原点
		const droplet = this.createDropletShape()
		droplet.fill(POINT_MARKER_STYLES.FILL_COLOR)
		droplet.stroke(POINT_MARKER_STYLES.STROKE_COLOR)
		droplet.strokeWidth(POINT_MARKER_STYLES.STROKE_WIDTH)

		// 创建序号文本
		const text = new Konva.Text({
			text: String(this.sequence),
			fontSize: POINT_MARKER_STYLES.TEXT_FONT_SIZE,
			fontFamily: POINT_MARKER_STYLES.TEXT_FONT_FAMILY,
			fontStyle: POINT_MARKER_STYLES.TEXT_FONT_WEIGHT,
			fill: POINT_MARKER_STYLES.TEXT_COLOR,
			align: "center",
			verticalAlign: "middle",
		})

		// 居中文本（水滴的视觉中心）
		text.offsetX(text.width() / 2)
		text.offsetY(text.height() / 2)
		text.y(-POINT_MARKER_STYLES.HEIGHT * 0.55) // 文字位置：在水滴的视觉中心（圆形部分），稍微向下

		this.group.add(droplet)
		this.group.add(text)

		// 设置默认透明度
		this.group.opacity(this.selectedMarkerId === this.marker.id ? 1 : 0.6)

		// 设置反向缩放（保持固定大小）
		this.updateScale()

		// 添加到图层
		this.canvas.markersLayer.add(this.group)
	}

	/**
	 * 在 Canvas 上绘制 Marker（用于图片合成）
	 * @param ctx Canvas 2D 上下文
	 * @param x Marker X 坐标
	 * @param y Marker Y 坐标
	 */
	public drawOnCanvas(ctx: CanvasRenderingContext2D, x: number, y: number): void {
		ctx.save()

		// 移动到标记点位置
		ctx.translate(x, y)

		// SVG 原始尺寸和目标尺寸
		const svgWidth = 27
		const svgHeight = 32
		const svgCenterX = 13.1787
		const targetWidth = POINT_MARKER_STYLES.WIDTH
		const targetHeight = POINT_MARKER_STYLES.HEIGHT

		// 计算缩放比例
		const scaleX = targetWidth / svgWidth
		const scaleY = targetHeight / svgHeight

		// 应用缩放和偏移
		ctx.scale(scaleX, scaleY)
		ctx.translate(-svgCenterX, -svgHeight)

		// 绘制水滴形状
		const path = new Path2D(DROLET_SVG_PATH)
		ctx.fillStyle = POINT_MARKER_STYLES.FILL_COLOR
		ctx.fill(path)
		ctx.strokeStyle = POINT_MARKER_STYLES.STROKE_COLOR
		ctx.lineWidth = POINT_MARKER_STYLES.STROKE_WIDTH
		ctx.stroke(path)

		// 恢复变换以绘制文本
		ctx.restore()
		ctx.save()
		ctx.translate(x, y)

		// 绘制序号文本
		ctx.font = `${POINT_MARKER_STYLES.TEXT_FONT_WEIGHT} ${POINT_MARKER_STYLES.TEXT_FONT_SIZE}px ${POINT_MARKER_STYLES.TEXT_FONT_FAMILY}`
		ctx.fillStyle = POINT_MARKER_STYLES.TEXT_COLOR
		ctx.textAlign = "center"
		ctx.textBaseline = "middle"

		// 文本位置：在水滴的视觉中心
		const textY = -POINT_MARKER_STYLES.HEIGHT * 0.55
		ctx.fillText(String(this.sequence), 0, textY)

		ctx.restore()
	}
}
