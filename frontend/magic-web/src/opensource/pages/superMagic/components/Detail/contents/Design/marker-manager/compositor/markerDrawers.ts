import type { Marker, MarkerArea } from "@/opensource/components/CanvasDesign/canvas/types"
import { MarkerTypeEnum } from "@/opensource/components/CanvasDesign/canvas/types"
import {
	POINT_MARKER_STYLES,
	AREA_MARKER_STYLES,
} from "@/opensource/components/CanvasDesign/canvas/interaction/markers/markerStyles"

/** 用于绘制的最小图片信息（仅需宽高） */
export interface ImageInfoForDraw {
	naturalWidth: number
	naturalHeight: number
}

// 绘制水滴形状（使用 SVG 路径，与 PointMarker 一致）
const DROLET_SVG_PATH =
	"M13.1787 1C19.7855 1 25.1774 6.3051 25.3525 12.9395L25.3574 13.2559C25.3571 16.5024 24.0723 19.6171 21.7842 21.9229L13.1787 30.5811L4.57227 21.9229L4.57129 21.9219L4.16797 21.4961C2.19843 19.3205 1.00001 16.4324 1 13.2549C1 6.47523 6.45692 1 13.1787 1Z"

function drawRoundedRect(
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

/**
 * 在 Canvas 上绘制点标记（用于图片合成）
 */
export function drawPointMarker(
	ctx: CanvasRenderingContext2D,
	marker: Marker,
	imageInfo: ImageInfoForDraw,
	sequence: number,
): void {
	const x = marker.relativeX * imageInfo.naturalWidth
	const y = marker.relativeY * imageInfo.naturalHeight

	ctx.save()

	ctx.translate(x, y)

	const svgWidth = 27
	const svgHeight = 32
	const svgCenterX = 13.1787
	const targetWidth = POINT_MARKER_STYLES.WIDTH
	const targetHeight = POINT_MARKER_STYLES.HEIGHT

	const scaleX = targetWidth / svgWidth
	const scaleY = targetHeight / svgHeight

	ctx.scale(scaleX, scaleY)
	ctx.translate(-svgCenterX, -svgHeight)

	const path = new Path2D(DROLET_SVG_PATH)
	ctx.fillStyle = POINT_MARKER_STYLES.FILL_COLOR
	ctx.fill(path)
	ctx.strokeStyle = POINT_MARKER_STYLES.STROKE_COLOR
	ctx.lineWidth = POINT_MARKER_STYLES.STROKE_WIDTH
	ctx.stroke(path)

	ctx.restore()
	ctx.save()
	ctx.translate(x, y)

	ctx.font = `${POINT_MARKER_STYLES.TEXT_FONT_WEIGHT} ${POINT_MARKER_STYLES.TEXT_FONT_SIZE}px ${POINT_MARKER_STYLES.TEXT_FONT_FAMILY}`
	ctx.fillStyle = POINT_MARKER_STYLES.TEXT_COLOR
	ctx.textAlign = "center"
	ctx.textBaseline = "middle"

	const textY = -POINT_MARKER_STYLES.HEIGHT * 0.55
	ctx.fillText(String(sequence), 0, textY)

	ctx.restore()
}

/**
 * 在 Canvas 上绘制区域标记（用于图片合成）
 */
export function drawAreaMarker(
	ctx: CanvasRenderingContext2D,
	marker: Marker,
	imageInfo: ImageInfoForDraw,
	sequence: number,
): void {
	const areaMarker = marker as MarkerArea
	const x = areaMarker.relativeX * imageInfo.naturalWidth
	const y = areaMarker.relativeY * imageInfo.naturalHeight
	const areaWidth = areaMarker.areaWidth * imageInfo.naturalWidth
	const areaHeight = areaMarker.areaHeight * imageInfo.naturalHeight

	ctx.save()

	ctx.fillStyle = AREA_MARKER_STYLES.AREA_FILL_COLOR
	ctx.strokeStyle = AREA_MARKER_STYLES.AREA_STROKE_COLOR
	ctx.lineWidth = AREA_MARKER_STYLES.AREA_STROKE_WIDTH

	drawRoundedRect(ctx, x, y, areaWidth, areaHeight, AREA_MARKER_STYLES.AREA_CORNER_RADIUS)
	ctx.fill()
	ctx.stroke()

	ctx.beginPath()
	ctx.arc(x, y, AREA_MARKER_STYLES.CIRCLE_RADIUS, 0, Math.PI * 2)
	ctx.fillStyle = AREA_MARKER_STYLES.FILL_COLOR
	ctx.fill()
	ctx.strokeStyle = AREA_MARKER_STYLES.STROKE_COLOR
	ctx.lineWidth = AREA_MARKER_STYLES.STROKE_WIDTH
	ctx.stroke()

	ctx.font = `${AREA_MARKER_STYLES.TEXT_FONT_WEIGHT} ${AREA_MARKER_STYLES.TEXT_FONT_SIZE}px ${AREA_MARKER_STYLES.TEXT_FONT_FAMILY}`
	ctx.fillStyle = AREA_MARKER_STYLES.TEXT_COLOR
	ctx.textAlign = "center"
	ctx.textBaseline = "middle"
	ctx.fillText(String(sequence), x, y)

	ctx.restore()
}

/**
 * 根据 marker 类型在 Canvas 上绘制标记
 */
export function drawMarkerOnCanvas(
	ctx: CanvasRenderingContext2D,
	marker: Marker,
	imageInfo: ImageInfoForDraw,
	sequence: number,
): void {
	if (marker.type === MarkerTypeEnum.Mark) {
		drawPointMarker(ctx, marker, imageInfo, sequence)
	} else if (marker.type === MarkerTypeEnum.Area) {
		drawAreaMarker(ctx, marker, imageInfo, sequence)
	}
}
