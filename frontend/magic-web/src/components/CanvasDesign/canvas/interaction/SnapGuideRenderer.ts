import Konva from "konva"
import type { Rect } from "../utils/utils"
import type { AlignmentInfo, AlignmentType } from "./snapGuideTypes"

/**
 * 吸附辅助线渲染器
 * 职责：仅负责辅助线与对齐点标记的绘制与更新
 */
export class SnapGuideRenderer {
	private overlayLayer: Konva.Layer

	private allGuideLines: Konva.Line[] = []
	private alignmentMarkers: Konva.Group[] = []

	private readonly GUIDE_STROKE = "rgb(220, 38, 38)"
	private readonly GUIDE_STROKE_WIDTH = 1
	private readonly GUIDE_DASH = [4, 4]
	private readonly MARKER_SIZE = 8
	private readonly MARKER_STROKE = "rgb(220, 38, 38)"
	private readonly MARKER_STROKE_WIDTH = 2

	private cachedGuideStrokeWidth = 0
	private cachedGuideDash: number[] = []
	private cachedMarkerSize = 0
	private cachedMarkerStrokeWidth = 0

	constructor(options: { overlayLayer: Konva.Layer }) {
		this.overlayLayer = options.overlayLayer
	}

	/**
	 * 交互开始时应调用，缓存视觉参数（viewport 不变）
	 */
	cacheVisualParams(scale: number): void {
		this.cachedGuideStrokeWidth = this.GUIDE_STROKE_WIDTH / scale
		this.cachedGuideDash = this.GUIDE_DASH.map((d) => d / scale)
		this.cachedMarkerSize = this.MARKER_SIZE / scale
		this.cachedMarkerStrokeWidth = this.MARKER_STROKE_WIDTH / scale
	}

	/**
	 * 绘制辅助线与标记（吸附关系变化时调用）
	 */
	render(snappedAlignments: AlignmentInfo[], getSnappedRect: () => Rect | null): void {
		const snappedRect = getSnappedRect()
		if (!snappedRect) return
		for (const alignment of snappedAlignments) {
			const line = this.createGuideLine(alignment, snappedRect)
			this.allGuideLines.push(line)
			this.overlayLayer.add(line)
		}
		const points = this.collectMarkerPoints(snappedAlignments, getSnappedRect)
		for (const p of points) {
			const marker = this.createXMarker(
				p.x,
				p.y,
				this.cachedMarkerSize,
				this.cachedMarkerStrokeWidth,
			)
			this.alignmentMarkers.push(marker)
			this.overlayLayer.add(marker)
		}
	}

	/**
	 * 就地更新辅助线与标记位置（吸附关系未变，仅元素位移）
	 */
	update(snappedAlignments: AlignmentInfo[], getSnappedRect: () => Rect | null): void {
		const snappedRect = getSnappedRect()
		if (!snappedRect) return
		for (let i = 0; i < snappedAlignments.length; i++) {
			const alignment = snappedAlignments[i]
			const line = this.allGuideLines[i]
			if (!line) continue
			const points = this.computeLinePoints(alignment, snappedRect)
			line.points(points)
		}
		const points = this.collectMarkerPoints(snappedAlignments, getSnappedRect)
		for (let i = 0; i < points.length && i < this.alignmentMarkers.length; i++) {
			const p = points[i]
			this.alignmentMarkers[i].x(p.x)
			this.alignmentMarkers[i].y(p.y)
		}
	}

	/**
	 * 清除所有辅助线与标记
	 */
	clear(): void {
		for (const line of this.allGuideLines) {
			line.destroy()
		}
		this.allGuideLines = []
		for (const marker of this.alignmentMarkers) {
			marker.destroy()
		}
		this.alignmentMarkers = []
		this.overlayLayer.batchDraw()
	}

	/**
	 * 触发 overlay 重绘
	 */
	batchDraw(): void {
		this.overlayLayer.batchDraw()
	}

	private createGuideLine(alignment: AlignmentInfo, snappedRect: Rect): Konva.Line {
		const points = this.computeLinePoints(alignment, snappedRect)
		return new Konva.Line({
			points,
			stroke: this.GUIDE_STROKE,
			strokeWidth: this.cachedGuideStrokeWidth,
			dash: this.cachedGuideDash,
			listening: false,
		})
	}

	private computeLinePoints(alignment: AlignmentInfo, snappedRect: Rect): number[] {
		const dragPoints = this.getAlignmentPoints(alignment.type, snappedRect)
		const allPoints = [...dragPoints, ...alignment.targetPoints]
		return ["left", "center", "right"].includes(alignment.type)
			? [
					alignment.position,
					Math.min(...allPoints.map((p) => p.y)),
					alignment.position,
					Math.max(...allPoints.map((p) => p.y)),
				]
			: [
					Math.min(...allPoints.map((p) => p.x)),
					alignment.position,
					Math.max(...allPoints.map((p) => p.x)),
					alignment.position,
				]
	}

	private collectMarkerPoints(
		alignments: AlignmentInfo[],
		getSnappedRect: () => Rect | null,
	): Array<{ x: number; y: number }> {
		const result: Array<{ x: number; y: number }> = []
		const seen = new Set<string>()
		const snappedRect = getSnappedRect()
		if (!snappedRect) return result
		for (const alignment of alignments) {
			for (const p of this.getAlignmentPoints(alignment.type, snappedRect)) {
				const key = `${p.x.toFixed(2)},${p.y.toFixed(2)}`
				if (!seen.has(key)) {
					seen.add(key)
					result.push(p)
				}
			}
			for (const p of alignment.targetPoints) {
				const key = `${p.x.toFixed(2)},${p.y.toFixed(2)}`
				if (!seen.has(key)) {
					seen.add(key)
					result.push(p)
				}
			}
		}
		return result
	}

	private getAlignmentPoints(type: AlignmentType, rect: Rect): Array<{ x: number; y: number }> {
		switch (type) {
			case "left":
				return [
					{ x: rect.x, y: rect.y },
					{ x: rect.x, y: rect.y + rect.height },
				]
			case "right":
				return [
					{ x: rect.x + rect.width, y: rect.y },
					{ x: rect.x + rect.width, y: rect.y + rect.height },
				]
			case "top":
				return [
					{ x: rect.x, y: rect.y },
					{ x: rect.x + rect.width, y: rect.y },
				]
			case "bottom":
				return [
					{ x: rect.x, y: rect.y + rect.height },
					{ x: rect.x + rect.width, y: rect.y + rect.height },
				]
			case "center":
			case "middle":
				return [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }]
		}
	}

	private createXMarker(x: number, y: number, size: number, strokeWidth: number): Konva.Group {
		const group = new Konva.Group({ x, y, listening: false })
		group.add(
			new Konva.Line({
				points: [-size / 2, -size / 2, size / 2, size / 2],
				stroke: this.MARKER_STROKE,
				strokeWidth,
				listening: false,
			}),
		)
		group.add(
			new Konva.Line({
				points: [-size / 2, size / 2, size / 2, -size / 2],
				stroke: this.MARKER_STROKE,
				strokeWidth,
				listening: false,
			}),
		)
		return group
	}
}
