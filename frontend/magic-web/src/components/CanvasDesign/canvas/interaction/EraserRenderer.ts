import Konva from "konva"
import type { Canvas } from "../Canvas"
import type { ImageElement } from "../types"
import { ElementTypeEnum } from "../types"
import type { EraserManager } from "./EraserManager"

export interface EraserPoint {
	x: number
	y: number
}

export interface EraserStroke {
	radius: number
	points: EraserPoint[]
}

const ERASER_OVERLAY_GROUP_NAME = "eraser-overlay"

const DRAW_CONFIG = {
	MASK_FILL: "rgba(0, 0, 0, 0.01)",
	HIT_FILL: "rgba(255, 255, 255, 0.01)",
	/** 画布上以不透明描边绘制，最后仅对整图设一次透明度，拖拽中与已提交笔划交叉也不叠深 */
	BRUSH_STROKE: "rgb(139, 92, 246)",
	BRUSH_LAYER_OPACITY: 0.45,
	POINT_DISTANCE_THRESHOLD: 0.5,
} as const

/**
 * 笔迹预览离屏 raster 的像素比（独立于 Konva 舞台 pixelRatio）。
 * 取 1 可显著减轻每帧 drawImage 与内存；最终擦除 mask 由 Worker / createEraserMaskFile 按元素逻辑尺寸精绘，不受此值影响。
 */
const BRUSH_PREVIEW_PIXEL_RATIO = 1

/** 单次绘制采样：避免同一帧多次 getStrokes / 重复算 pad */
interface BrushRenderSnapshot {
	readonly committedStrokes: readonly EraserStroke[]
	readonly previewRadius: number
	readonly pad: number
	readonly previewPr: number
}

/**
 * 橡皮擦渲染器
 * 负责绘制会话遮罩和笔画预览。
 */
export class EraserRenderer {
	private canvas: Canvas
	private elementId: string
	private manager: EraserManager

	private overlayGroup?: Konva.Group
	private maskRect?: Konva.Rect
	private brushImage?: Konva.Image
	private hitRect?: Konva.Rect

	private committedCanvas: HTMLCanvasElement | null = null
	private displayCanvas: HTMLCanvasElement | null = null
	/** width|height|pad|previewPr，画布尺寸变化时重建 buffer */
	private brushSurfaceKey = ""

	private sessionUpdateHandler?: (event: {
		data: { elementId: string; radius: number; strokeCount: number; canUndo: boolean }
	}) => void

	private elementBounds: { width: number; height: number } | null = null
	private isDrawing = false
	private currentStrokePoints: EraserPoint[] = []
	private brushVisualRafId = 0
	/** pushStroke 与 finishStroke 同栈时由 session 回调刷新笔迹，避免重复 batchDraw */
	private suppressSessionBatchDraw = false

	constructor(options: { canvas: Canvas; elementId: string; manager: EraserManager }) {
		this.canvas = options.canvas
		this.elementId = options.elementId
		this.manager = options.manager

		this.setupEventListeners()
	}

	private setupEventListeners(): void {
		this.sessionUpdateHandler = ({ data }) => {
			if (data.elementId !== this.elementId) return
			this.syncBrushLayerFull()
			if (!this.suppressSessionBatchDraw) {
				this.canvas.controlsLayer.batchDraw()
			}
		}
		this.canvas.eventEmitter.on("eraser:sessionUpdate", this.sessionUpdateHandler)
	}

	private removeEventListeners(): void {
		if (this.sessionUpdateHandler) {
			this.canvas.eventEmitter.off("eraser:sessionUpdate", this.sessionUpdateHandler)
			this.sessionUpdateHandler = undefined
		}
	}

	public render(): void {
		const metrics = this.getElementMetrics()
		if (!metrics) return
		const { elementNode, width, height } = metrics

		this.elementBounds = { width, height }

		this.overlayGroup = new Konva.Group({
			x: elementNode.x(),
			y: elementNode.y(),
			scaleX: elementNode.scaleX(),
			scaleY: elementNode.scaleY(),
			rotation: elementNode.rotation(),
			offset: { x: 0, y: 0 },
			name: ERASER_OVERLAY_GROUP_NAME,
			listening: true,
			clipFunc: (ctx) => {
				ctx.rect(0, 0, width, height)
			},
		})

		this.maskRect = new Konva.Rect({
			x: 0,
			y: 0,
			width,
			height,
			fill: DRAW_CONFIG.MASK_FILL,
			listening: false,
		})

		this.hitRect = new Konva.Rect({
			x: 0,
			y: 0,
			width,
			height,
			fill: DRAW_CONFIG.HIT_FILL,
			listening: true,
		})

		const snapshot = this.captureBrushSnapshot()
		if (!this.ensureBrushSurfaces(snapshot)) return

		const display = this.displayCanvas
		if (!display) return

		const pad = snapshot.pad
		this.brushImage = new Konva.Image({
			x: -pad,
			y: -pad,
			width: width + pad * 2,
			height: height + pad * 2,
			image: display,
			listening: false,
			opacity: DRAW_CONFIG.BRUSH_LAYER_OPACITY,
		})

		this.syncBrushLayerFull()

		this.overlayGroup.add(this.maskRect, this.hitRect, this.brushImage)

		this.canvas.controlsLayer.add(this.overlayGroup)
		this.overlayGroup.moveToTop()
		this.canvas.controlsLayer.batchDraw()
	}

	public syncTransform(): void {
		if (!this.overlayGroup || !this.maskRect || !this.hitRect) return

		const metrics = this.getElementMetrics()
		if (!metrics) return
		const { elementNode, width, height } = metrics

		this.elementBounds = { width, height }
		this.overlayGroup.setAttrs({
			x: elementNode.x(),
			y: elementNode.y(),
			scaleX: elementNode.scaleX(),
			scaleY: elementNode.scaleY(),
			rotation: elementNode.rotation(),
			offset: { x: 0, y: 0 },
			clipFunc: (ctx) => {
				ctx.rect(0, 0, width, height)
			},
		})
		this.maskRect.size({ width, height })
		this.hitRect.size({ width, height })
		this.overlayGroup.moveToTop()

		this.brushSurfaceKey = ""
		this.syncBrushLayerFull()
		this.canvas.controlsLayer.batchDraw()
	}

	public getLocalPointFromStagePointer(pointer?: Konva.Vector2d | null): EraserPoint | null {
		if (!this.overlayGroup || !pointer) return null
		const localPoint = this.overlayGroup.getAbsoluteTransform().copy().invert().point(pointer)
		return {
			x: localPoint.x,
			y: localPoint.y,
		}
	}

	public isPointInsideBounds(point: EraserPoint): boolean {
		if (!this.elementBounds) return false
		return (
			point.x >= 0 &&
			point.y >= 0 &&
			point.x <= this.elementBounds.width &&
			point.y <= this.elementBounds.height
		)
	}

	public beginStroke(point: EraserPoint): void {
		if (!this.overlayGroup) return

		this.isDrawing = true
		this.currentStrokePoints = [point]
		this.cancelBrushVisualRefresh()
		const snapshot = this.captureBrushSnapshot()
		if (this.ensureBrushSurfaces(snapshot)) {
			this.compositeBrushOnly(snapshot)
		}
		this.canvas.controlsLayer.batchDraw()
	}

	public extendStroke(point: EraserPoint): void {
		if (!this.displayCanvas || this.currentStrokePoints.length === 0) return

		const previousPoint = this.currentStrokePoints[this.currentStrokePoints.length - 1]
		const distance = Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y)
		if (distance < DRAW_CONFIG.POINT_DISTANCE_THRESHOLD) {
			return
		}

		this.currentStrokePoints.push(point)
		this.scheduleBrushVisualRefresh()
	}

	/** 指针暂时离开可擦除区域但左键仍按下：不提交撤销栈，保留当前笔画以便移回后继续。 */
	public pauseStroke(): void {
		if (!this.isDrawing && this.currentStrokePoints.length === 0) return
		this.isDrawing = false
	}

	public hasPendingStroke(): boolean {
		return this.currentStrokePoints.length > 0
	}

	public resumeStroke(): void {
		if (this.currentStrokePoints.length === 0) return
		this.isDrawing = true
	}

	public finishStroke(commit = true): void {
		const hadStroke = this.isDrawing || this.currentStrokePoints.length > 0
		if (!hadStroke) return

		this.isDrawing = false
		this.cancelBrushVisualRefresh()

		const radius = this.manager.getRadius()
		const pointsToCommit =
			commit && this.currentStrokePoints.length > 0
				? this.currentStrokePoints.map((point) => ({ ...point }))
				: []

		this.currentStrokePoints = []

		if (pointsToCommit.length > 0) {
			this.suppressSessionBatchDraw = true
			try {
				this.manager.pushStroke({ radius, points: pointsToCommit })
			} finally {
				this.suppressSessionBatchDraw = false
			}
		} else {
			this.syncBrushLayerFull()
		}

		this.canvas.controlsLayer.batchDraw()
	}

	public isDrawingActive(): boolean {
		return this.isDrawing
	}

	/**
	 * 已提交笔划重绘 + 与当前笔划合成到一张位图，整图一次透明度，拖拽路径自交或与历史交叉都不叠深。
	 */
	private syncBrushLayerFull(): void {
		const snapshot = this.captureBrushSnapshot()
		if (!this.ensureBrushSurfaces(snapshot)) return
		this.paintCommittedCanvas(snapshot)
		this.compositeBrushOnly(snapshot)
	}

	private scheduleBrushVisualRefresh(): void {
		if (this.brushVisualRafId !== 0) return
		this.brushVisualRafId = requestAnimationFrame(() => {
			this.brushVisualRafId = 0
			const snapshot = this.captureBrushSnapshot()
			if (this.ensureBrushSurfaces(snapshot)) {
				this.compositeBrushOnly(snapshot)
			}
			this.canvas.controlsLayer.batchDraw()
		})
	}

	private cancelBrushVisualRefresh(): void {
		if (this.brushVisualRafId === 0) return
		cancelAnimationFrame(this.brushVisualRafId)
		this.brushVisualRafId = 0
	}

	private captureBrushSnapshot(): BrushRenderSnapshot {
		const committedStrokes = this.manager.getStrokesForRender()
		const previewRadius = this.manager.getRadius()
		let maxR = previewRadius
		for (let i = 0; i < committedStrokes.length; i += 1) {
			const r = committedStrokes[i].radius
			if (r > maxR) maxR = r
		}
		return {
			committedStrokes,
			previewRadius,
			pad: Math.ceil(maxR),
			previewPr: BRUSH_PREVIEW_PIXEL_RATIO,
		}
	}

	private ensureBrushSurfaces(snapshot: BrushRenderSnapshot): boolean {
		if (!this.overlayGroup || !this.elementBounds) return false

		const { width, height } = this.elementBounds
		const { pad, previewPr } = snapshot
		const key = `${width}|${height}|${pad}|${previewPr}`

		const cw = Math.max(1, Math.ceil((width + pad * 2) * previewPr))
		const ch = Math.max(1, Math.ceil((height + pad * 2) * previewPr))

		if (!this.committedCanvas) {
			this.committedCanvas = document.createElement("canvas")
		}
		if (!this.displayCanvas) {
			this.displayCanvas = document.createElement("canvas")
		}

		if (key !== this.brushSurfaceKey) {
			this.brushSurfaceKey = key
			this.committedCanvas.width = cw
			this.committedCanvas.height = ch
			this.displayCanvas.width = cw
			this.displayCanvas.height = ch
		}

		if (this.brushImage) {
			this.brushImage.setAttrs({
				x: -pad,
				y: -pad,
				width: width + pad * 2,
				height: height + pad * 2,
				image: this.displayCanvas,
			})
		}

		return true
	}

	private paintCommittedCanvas(snapshot: BrushRenderSnapshot): void {
		if (!this.committedCanvas || !this.elementBounds) return
		const ctx = this.committedCanvas.getContext("2d")
		if (!ctx) return

		const { pad, previewPr, committedStrokes } = snapshot

		ctx.setTransform(1, 0, 0, 1, 0, 0)
		ctx.clearRect(0, 0, this.committedCanvas.width, this.committedCanvas.height)

		ctx.scale(previewPr, previewPr)
		ctx.translate(pad, pad)

		this.applySharedBrushStrokeStyle(ctx)
		for (let i = 0; i < committedStrokes.length; i += 1) {
			const stroke = committedStrokes[i]
			ctx.lineWidth = stroke.radius * 2
			this.strokePolylinePath(ctx, stroke.points)
		}
	}

	/**
	 * 将已提交位图与当前笔划（单次 stroke）合成到展示画布。
	 */
	private compositeBrushOnly(snapshot: BrushRenderSnapshot): void {
		if (!this.committedCanvas || !this.displayCanvas || !this.elementBounds || !this.brushImage)
			return

		const dctx = this.displayCanvas.getContext("2d")
		if (!dctx) return

		const { pad, previewPr, previewRadius, committedStrokes } = snapshot

		dctx.setTransform(1, 0, 0, 1, 0, 0)
		dctx.clearRect(0, 0, this.displayCanvas.width, this.displayCanvas.height)
		dctx.drawImage(this.committedCanvas, 0, 0)

		const hasCurrent = this.currentStrokePoints.length > 0
		const hasCommitted = committedStrokes.length > 0
		if (hasCurrent) {
			dctx.save()
			dctx.scale(previewPr, previewPr)
			dctx.translate(pad, pad)
			this.applySharedBrushStrokeStyle(dctx)
			dctx.lineWidth = previewRadius * 2
			this.strokePolylinePath(dctx, this.currentStrokePoints)
			dctx.restore()
		}

		this.brushImage.visible(hasCommitted || hasCurrent)
	}

	private applySharedBrushStrokeStyle(ctx: CanvasRenderingContext2D): void {
		ctx.strokeStyle = DRAW_CONFIG.BRUSH_STROKE
		ctx.lineCap = "round"
		ctx.lineJoin = "round"
		ctx.globalAlpha = 1
	}

	private strokePolylinePath(ctx: CanvasRenderingContext2D, points: EraserPoint[]): void {
		if (points.length === 0) return

		ctx.beginPath()
		const first = points[0]
		ctx.moveTo(first.x, first.y)
		if (points.length === 1) {
			ctx.lineTo(first.x + 0.01, first.y + 0.01)
		} else {
			for (let i = 1; i < points.length; i += 1) {
				ctx.lineTo(points[i].x, points[i].y)
			}
		}
		ctx.stroke()
	}

	public destroy(): void {
		this.cancelBrushVisualRefresh()
		this.removeEventListeners()
		this.finishStroke(false)
		if (this.overlayGroup) {
			this.overlayGroup.destroy()
			this.overlayGroup = undefined
		}
		this.brushImage = undefined
		this.committedCanvas = null
		this.displayCanvas = null
		this.brushSurfaceKey = ""
		this.canvas.controlsLayer.batchDraw()
	}

	public static isEraserOverlayNode(node: Konva.Node | null): boolean {
		let current: Konva.Node | null = node
		while (current) {
			if (current.name() === ERASER_OVERLAY_GROUP_NAME) return true
			current = current.getParent()
		}
		return false
	}

	private getElementMetrics(): { elementNode: Konva.Node; width: number; height: number } | null {
		const elementData = this.canvas.elementManager.getElementData(this.elementId)
		if (!elementData || elementData.type !== ElementTypeEnum.Image) return null

		const imageElement = elementData as ImageElement
		const elementInstance = this.canvas.elementManager.getElementInstance(this.elementId)
		const elementNode = elementInstance?.getNode()
		if (!elementNode) return null

		const width = elementNode.width() ?? imageElement.width ?? 0
		const height = elementNode.height() ?? imageElement.height ?? 0
		if (width <= 0 || height <= 0) return null

		return {
			elementNode,
			width,
			height,
		}
	}
}
