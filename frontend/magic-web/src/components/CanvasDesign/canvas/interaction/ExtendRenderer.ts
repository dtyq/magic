import Konva from "konva"
import type { Box } from "konva/lib/shapes/Transformer"
import type { Canvas } from "../Canvas"
import type { ExtendSession, ImageElement } from "../types"
import { ElementTypeEnum } from "../types"
import { applyAspectRatioToBoundBox, isEdgeAnchor } from "./anchorUtils"
import {
	FRAME_EDITOR_CONFIG,
	STANDARD_TRANSFORMER_STYLE,
	boxToLocalBox,
	createFrameEditorAnchorStyleFunc,
	createFrameGridLines,
	isManagedOverlayNode,
	localBoxToAbsoluteBox,
	updateFrameGridLines,
} from "./FrameEditorShared"

const EXTEND_OVERLAY_GROUP_NAME = "extend-overlay"
const EXTEND_FRAME_BOX_NAME = "extend-frame-box"
const EXTEND_GRID_LINE_NAME = "extend-grid-line"
const EXTEND_IMAGE_CLIP_GROUP_NAME = "extend-image-clip-group"
const EXTEND_IMAGE_PROXY_NAME = "extend-image-proxy"
const EXTEND_AREA_OVERLAY_NAME = "extend-area-overlay"
const EXTEND_AREA_SEGMENT_TOP = "extend-area-segment-top"
const EXTEND_AREA_SEGMENT_RIGHT = "extend-area-segment-right"
const EXTEND_AREA_SEGMENT_BOTTOM = "extend-area-segment-bottom"
const EXTEND_AREA_SEGMENT_LEFT = "extend-area-segment-left"
const EXTEND_NAME_LABEL_NAME = "extend-name-label"
const EXTEND_SIZE_LABEL_NAME = "extend-size-label"
const EXTEND_OVERLAY_GROUP_NAMES = [EXTEND_OVERLAY_GROUP_NAME]

const EXTEND_DRAW_CONFIG = {
	AREA_OVERLAY_FILL: "rgba(128, 128, 128, 0.28)",
	LABEL_FONT_SIZE: 12,
	LABEL_FONT_FAMILY: "Arial, sans-serif",
	LABEL_FILL: "#3B82F6",
	LABEL_OFFSET_TOP: 5,
} as const

export class ExtendRenderer {
	private canvas: Canvas
	private elementId: string

	private overlayGroup?: Konva.Group
	private imageClipGroup?: Konva.Group
	private imageProxy?: Konva.Image
	private frameBox?: Konva.Rect
	private frameTransformer?: Konva.Transformer
	private imageTransformer?: Konva.Transformer
	private nameLabelGroup?: Konva.Group
	private sizeLabelGroup?: Konva.Group
	private sourceElementNode?: Konva.Node
	private sourceElementVisible = true
	private updateFromPanelHandler?: (event: {
		data: { elementId: string; session: ExtendSession }
	}) => void
	private stagePointerDownHandler?: (
		event: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
	) => void
	private frameInitialAspectRatio: number | null = null
	private imageInitialAspectRatio: number | null = null

	constructor(options: { canvas: Canvas; elementId: string }) {
		this.canvas = options.canvas
		this.elementId = options.elementId
		this.setupEventListeners()
	}

	private setupEventListeners(): void {
		this.updateFromPanelHandler = ({ data }) => {
			if (data.elementId === this.elementId) {
				this.applySession(data.session)
			}
		}

		this.canvas.eventEmitter.on("extend:updateFromPanel", this.updateFromPanelHandler)
	}

	private removeEventListeners(): void {
		if (this.updateFromPanelHandler) {
			this.canvas.eventEmitter.off("extend:updateFromPanel", this.updateFromPanelHandler)
			this.updateFromPanelHandler = undefined
		}
		if (this.stagePointerDownHandler) {
			this.canvas.stage.off("mousedown touchstart", this.stagePointerDownHandler)
			this.stagePointerDownHandler = undefined
		}
	}

	public setKeepRatio(): void {
		const keepRatio = this.canvas.isKeepRatioModifierPressed()
		this.frameTransformer?.keepRatio(keepRatio)
		this.imageTransformer?.keepRatio(keepRatio)
	}

	public render(): void {
		const session = this.canvas.extendManager.getTempSession()
		if (!session) return

		const elementData = this.canvas.elementManager.getElementData(this.elementId)
		if (!elementData || elementData.type !== ElementTypeEnum.Image) return

		const elementInstance = this.canvas.elementManager.getElementInstance(this.elementId)
		const elementNode = elementInstance?.getNode()
		if (!elementNode || !(elementNode instanceof Konva.Group)) return

		const renderedImageNode = this.getRenderedImageNode(elementNode)
		const renderedImage = renderedImageNode?.image()
		if (!renderedImage) return

		const imageWidth = elementNode.width() ?? elementData.width ?? 0
		const imageHeight = elementNode.height() ?? elementData.height ?? 0
		if (imageWidth <= 0 || imageHeight <= 0) return

		this.sourceElementNode = elementNode
		this.sourceElementVisible = elementNode.visible()

		this.overlayGroup = new Konva.Group({
			x: elementNode.x(),
			y: elementNode.y(),
			scaleX: elementNode.scaleX(),
			scaleY: elementNode.scaleY(),
			rotation: elementNode.rotation(),
			offset: { x: 0, y: 0 },
			name: EXTEND_OVERLAY_GROUP_NAME,
			listening: true,
		})

		this.imageClipGroup = new Konva.Group({
			name: EXTEND_IMAGE_CLIP_GROUP_NAME,
			listening: true,
		})

		this.imageProxy = new Konva.Image({
			x: 0,
			y: 0,
			width: imageWidth,
			height: imageHeight,
			image: renderedImage,
			crop: renderedImageNode?.crop(),
			draggable: true,
			name: EXTEND_IMAGE_PROXY_NAME,
		})

		this.imageProxy.dragBoundFunc((nextPos) => this.constrainImagePosition(nextPos))
		this.imageProxy.on("dragmove", () => {
			this.syncAreaOverlay()
			this.imageTransformer?.forceUpdate()
			this.canvas.controlsLayer.batchDraw()
		})
		this.imageProxy.on("mouseenter", () => {
			this.canvas.cursorManager.setTemporary("move")
		})
		this.imageProxy.on("mouseleave", () => {
			this.canvas.cursorManager.restoreToolCursor()
		})

		this.frameBox = new Konva.Rect({
			x: session.frame.x,
			y: session.frame.y,
			width: session.frame.width,
			height: session.frame.height,
			stroke: FRAME_EDITOR_CONFIG.BOX_STROKE,
			strokeWidth: FRAME_EDITOR_CONFIG.BOX_STROKE_WIDTH,
			fill: undefined,
			draggable: false,
			listening: false,
			name: EXTEND_FRAME_BOX_NAME,
		})

		this.imageClipGroup.add(this.imageProxy)
		this.updateImageClip(session.frame)

		const areaOverlay = this.createAreaOverlay()
		const gridLines = createFrameGridLines(session.frame, EXTEND_GRID_LINE_NAME)

		this.overlayGroup.add(this.imageClipGroup, areaOverlay, this.frameBox, ...gridLines)
		this.canvas.controlsLayer.add(this.overlayGroup)
		this.createFrameLabels()
		this.updateFrameLabels()

		const anchorSize = FRAME_EDITOR_CONFIG.TRANSFORMER_ANCHOR_SIZE
		const proxyAnchorSize = STANDARD_TRANSFORMER_STYLE.ANCHOR_SIZE
		const enabledAnchors = [
			"top-left",
			"top-right",
			"bottom-left",
			"bottom-right",
			"top-center",
			"bottom-center",
			"middle-left",
			"middle-right",
		]
		this.frameTransformer = new Konva.Transformer({
			nodes: [this.frameBox],
			keepRatio: this.canvas.isKeepRatioModifierPressed(),
			rotateEnabled: false,
			enabledAnchors,
			anchorSize,
			borderStroke: FRAME_EDITOR_CONFIG.TRANSFORMER_BORDER_STROKE,
			borderStrokeWidth: FRAME_EDITOR_CONFIG.TRANSFORMER_BORDER_STROKE_WIDTH,
			anchorStroke: FRAME_EDITOR_CONFIG.TRANSFORMER_ANCHOR_STROKE,
			anchorFill: FRAME_EDITOR_CONFIG.TRANSFORMER_ANCHOR_FILL,
			anchorStrokeWidth: FRAME_EDITOR_CONFIG.TRANSFORMER_ANCHOR_STROKE_WIDTH,
			anchorCornerRadius: anchorSize / 2,
			ignoreStroke: true,
			anchorStyleFunc: createFrameEditorAnchorStyleFunc(anchorSize),
			boundBoxFunc: (oldBox: Box, newBox: Box): Box => {
				if (newBox.width < 0 || newBox.height < 0) return oldBox

				let resultBox = newBox
				const activeAnchor = this.frameTransformer?.getActiveAnchor()
				if (
					this.canvas.isKeepRatioModifierPressed() &&
					activeAnchor &&
					isEdgeAnchor(activeAnchor)
				) {
					resultBox = applyAspectRatioToBoundBox(
						oldBox,
						resultBox,
						activeAnchor,
						this.frameInitialAspectRatio,
					)
				}

				return this.constrainFrameBox(resultBox)
			},
		})

		this.frameTransformer.on("transformstart", () => {
			const frameNode = this.frameTransformer?.nodes()[0]
			if (frameNode instanceof Konva.Rect) {
				const width = frameNode.width() * frameNode.scaleX()
				const height = frameNode.height() * frameNode.scaleY()
				if (height > 0) {
					this.frameInitialAspectRatio = width / height
				}
			}
		})
		this.frameTransformer.on("transform", () => {
			if (!this.frameBox) return

			const scaleX = this.frameBox.scaleX()
			const scaleY = this.frameBox.scaleY()
			this.frameBox.width(this.normalizeDimension(this.frameBox.width() * scaleX))
			this.frameBox.height(this.normalizeDimension(this.frameBox.height() * scaleY))
			this.frameBox.scaleX(1)
			this.frameBox.scaleY(1)

			const nextFrame = this.normalizeFrame({
				x: this.frameBox.x(),
				y: this.frameBox.y(),
				width: this.frameBox.width(),
				height: this.frameBox.height(),
			})
			this.frameBox.size({ width: nextFrame.width, height: nextFrame.height })
			this.updateImageClip(nextFrame)
			this.syncAreaOverlay()
			updateFrameGridLines(this.overlayGroup, nextFrame, EXTEND_GRID_LINE_NAME)
			this.ensureImageProxyWithinFrame()
			this.updateFrameLabels()
			this.canvas.extendManager.updateTempSession(this.getCurrentSession())
		})
		this.frameTransformer.on("transformend", () => {
			this.frameInitialAspectRatio = null
		})

		this.imageTransformer = new Konva.Transformer({
			nodes: [this.imageProxy],
			keepRatio: this.canvas.isKeepRatioModifierPressed(),
			rotateEnabled: false,
			enabledAnchors,
			anchorSize: proxyAnchorSize,
			borderStroke: STANDARD_TRANSFORMER_STYLE.BORDER_STROKE,
			borderStrokeWidth: STANDARD_TRANSFORMER_STYLE.BORDER_STROKE_WIDTH,
			anchorStroke: STANDARD_TRANSFORMER_STYLE.ANCHOR_STROKE,
			anchorFill: STANDARD_TRANSFORMER_STYLE.ANCHOR_FILL,
			anchorStrokeWidth: STANDARD_TRANSFORMER_STYLE.ANCHOR_STROKE_WIDTH,
			ignoreStroke: STANDARD_TRANSFORMER_STYLE.IGNORE_STROKE,
			anchorStyleFunc: createFrameEditorAnchorStyleFunc(proxyAnchorSize),
			boundBoxFunc: (oldBox: Box, newBox: Box): Box => {
				if (newBox.width < 0 || newBox.height < 0) return oldBox

				let resultBox = newBox
				const activeAnchor = this.imageTransformer?.getActiveAnchor()
				if (
					this.canvas.isKeepRatioModifierPressed() &&
					activeAnchor &&
					isEdgeAnchor(activeAnchor)
				) {
					resultBox = applyAspectRatioToBoundBox(
						oldBox,
						resultBox,
						activeAnchor,
						this.imageInitialAspectRatio,
					)
				}

				return this.constrainImageBox(resultBox)
			},
		})

		this.imageTransformer.on("transformstart", () => {
			const imageNode = this.imageTransformer?.nodes()[0]
			if (imageNode instanceof Konva.Image) {
				const width = imageNode.width() * imageNode.scaleX()
				const height = imageNode.height() * imageNode.scaleY()
				if (height > 0) {
					this.imageInitialAspectRatio = width / height
				}
			}
		})
		this.imageTransformer.on("transform", () => {
			if (!this.imageProxy) return

			const scaleX = this.imageProxy.scaleX()
			const scaleY = this.imageProxy.scaleY()
			this.imageProxy.width(this.normalizeDimension(this.imageProxy.width() * scaleX))
			this.imageProxy.height(this.normalizeDimension(this.imageProxy.height() * scaleY))
			this.imageProxy.scaleX(1)
			this.imageProxy.scaleY(1)

			this.syncAreaOverlay()
			this.imageTransformer?.forceUpdate()
			this.canvas.controlsLayer.batchDraw()
		})
		this.imageTransformer.on("transformend", () => {
			this.imageInitialAspectRatio = null
		})

		this.canvas.controlsLayer.add(this.frameTransformer)
		this.canvas.controlsLayer.add(this.imageTransformer)
		this.syncTransformerZIndex()
		this.setImageTransformerVisible(false)
		this.setupStagePointerListener()
		this.hideSourceElement()
		this.canvas.overlayLayer.batchDraw()
		this.canvas.controlsLayer.batchDraw()
	}

	public syncTransform(): void {
		if (!this.overlayGroup || !this.sourceElementNode) return

		this.overlayGroup.setAttrs({
			x: this.sourceElementNode.x(),
			y: this.sourceElementNode.y(),
			scaleX: this.sourceElementNode.scaleX(),
			scaleY: this.sourceElementNode.scaleY(),
			rotation: this.sourceElementNode.rotation(),
		})
		this.ensureImageProxyWithinFrame()
		this.frameTransformer?.forceUpdate()
		this.imageTransformer?.forceUpdate()
		this.updateFrameLabels()
		this.canvas.controlsLayer.batchDraw()
	}

	public getBoundingRect(): { x: number; y: number; width: number; height: number } | null {
		if (!this.frameBox || !this.overlayGroup) return null

		const box = this.localBoxToLayerRect({
			x: this.frameBox.x(),
			y: this.frameBox.y(),
			width: this.frameBox.width(),
			height: this.frameBox.height(),
		})

		return {
			x: box.x,
			y: box.y,
			width: box.width,
			height: box.height,
		}
	}

	private hideSourceElement(): void {
		if (!this.sourceElementNode) return
		this.sourceElementNode.visible(false)
		this.sourceElementNode.getLayer()?.batchDraw()
	}

	private restoreSourceElement(): void {
		if (!this.sourceElementNode) return
		this.sourceElementNode.visible(this.sourceElementVisible)
		this.sourceElementNode.getLayer()?.batchDraw()
	}

	private getRenderedImageNode(elementNode: Konva.Group): Konva.Image | null {
		const children = elementNode.getChildren()
		for (const child of children) {
			if (child instanceof Konva.Image && child.image()) {
				return child
			}
		}
		return null
	}

	private updateImageClip(frame: ExtendSession["frame"]): void {
		if (!this.imageClipGroup) return
		this.imageClipGroup.clipFunc((ctx) => {
			ctx.rect(frame.x, frame.y, frame.width, frame.height)
		})
	}

	private setupStagePointerListener(): void {
		this.stagePointerDownHandler = ({ target }) => {
			if (target === this.imageProxy || this.isNodeInImageTransformer(target)) {
				this.setImageTransformerVisible(true)
				return
			}

			this.setImageTransformerVisible(false)
		}

		this.canvas.stage.on("mousedown touchstart", this.stagePointerDownHandler)
	}

	private isNodeInImageTransformer(node: Konva.Node | null): boolean {
		let current: Konva.Node | null = node
		while (current) {
			if (current === this.imageTransformer) return true
			current = current.getParent()
		}
		return false
	}

	private setImageTransformerVisible(visible: boolean): void {
		if (!this.imageTransformer) return
		if (this.imageTransformer.visible() === visible) return
		this.imageTransformer.visible(visible)
		this.syncTransformerZIndex()
		this.canvas.controlsLayer.batchDraw()
	}

	private syncTransformerZIndex(): void {
		this.imageTransformer?.moveToTop()
		this.frameTransformer?.moveToTop()
		this.canvas.controlsLayer.batchDraw()
	}

	private createAreaOverlay(): Konva.Group {
		const group = new Konva.Group({
			name: EXTEND_AREA_OVERLAY_NAME,
			listening: false,
		})
		;[
			EXTEND_AREA_SEGMENT_TOP,
			EXTEND_AREA_SEGMENT_RIGHT,
			EXTEND_AREA_SEGMENT_BOTTOM,
			EXTEND_AREA_SEGMENT_LEFT,
		].forEach((name) => {
			group.add(
				new Konva.Rect({
					fill: EXTEND_DRAW_CONFIG.AREA_OVERLAY_FILL,
					listening: false,
					name,
					visible: false,
				}),
			)
		})
		this.syncAreaOverlay(group)
		return group
	}

	private syncAreaOverlay(targetGroup?: Konva.Group): void {
		const group =
			targetGroup ??
			(this.overlayGroup?.findOne(`.${EXTEND_AREA_OVERLAY_NAME}`) as Konva.Group | undefined)
		if (!group || !this.frameBox || !this.imageProxy) return

		const frameLeft = this.frameBox.x()
		const frameTop = this.frameBox.y()
		const frameRight = frameLeft + this.frameBox.width()
		const frameBottom = frameTop + this.frameBox.height()
		const imageLeft = this.imageProxy.x()
		const imageTop = this.imageProxy.y()
		const imageRight = imageLeft + this.imageProxy.width()
		const imageBottom = imageTop + this.imageProxy.height()

		this.updateOverlaySegment(group, `.${EXTEND_AREA_SEGMENT_TOP}`, {
			x: frameLeft,
			y: frameTop,
			width: this.frameBox.width(),
			height: Math.max(0, imageTop - frameTop),
		})
		this.updateOverlaySegment(group, `.${EXTEND_AREA_SEGMENT_RIGHT}`, {
			x: imageRight,
			y: Math.max(frameTop, imageTop),
			width: Math.max(0, frameRight - imageRight),
			height: Math.min(frameBottom, imageBottom) - Math.max(frameTop, imageTop),
		})
		this.updateOverlaySegment(group, `.${EXTEND_AREA_SEGMENT_BOTTOM}`, {
			x: frameLeft,
			y: imageBottom,
			width: this.frameBox.width(),
			height: Math.max(0, frameBottom - imageBottom),
		})
		this.updateOverlaySegment(group, `.${EXTEND_AREA_SEGMENT_LEFT}`, {
			x: frameLeft,
			y: Math.max(frameTop, imageTop),
			width: Math.max(0, imageLeft - frameLeft),
			height: Math.min(frameBottom, imageBottom) - Math.max(frameTop, imageTop),
		})
	}

	private updateOverlaySegment(
		group: Konva.Group,
		selector: string,
		rect: { x: number; y: number; width: number; height: number },
	): void {
		const segment = group.findOne(selector) as Konva.Rect | undefined
		if (!segment) return

		const visible = rect.width > 0 && rect.height > 0
		segment.visible(visible)
		if (!visible) return

		segment.setAttrs(rect)
	}

	private normalizeDimension(value: number): number {
		return Math.max(1, Math.round(value))
	}

	private normalizeFrame(frame: ExtendSession["frame"]): ExtendSession["frame"] {
		return {
			...frame,
			width: this.normalizeDimension(frame.width),
			height: this.normalizeDimension(frame.height),
		}
	}

	private normalizeBoxSize(box: Box): Box {
		return {
			...box,
			width: this.normalizeDimension(box.width),
			height: this.normalizeDimension(box.height),
		}
	}

	private getCurrentSession(): ExtendSession {
		const normalizedFrame = this.normalizeFrame({
			x: this.frameBox?.x() ?? 0,
			y: this.frameBox?.y() ?? 0,
			width: this.frameBox?.width() ?? 0,
			height: this.frameBox?.height() ?? 0,
		})

		return {
			frame: normalizedFrame,
		}
	}

	public getImageBounds(): { x: number; y: number; width: number; height: number } | null {
		if (!this.overlayGroup || !this.imageProxy) return null

		const box = this.localBoxToLayerRect({
			x: this.imageProxy.x(),
			y: this.imageProxy.y(),
			width: this.imageProxy.width(),
			height: this.imageProxy.height(),
		})

		return {
			x: box.x,
			y: box.y,
			width: this.normalizeDimension(box.width),
			height: this.normalizeDimension(box.height),
		}
	}

	/** 代理图在扩展 overlay 局部坐标系下的轴对齐外接矩形（与 frame 坐标一致，供面板计算扩展框位置） */
	public getImageProxyLocalRect(): {
		x: number
		y: number
		width: number
		height: number
	} | null {
		if (!this.overlayGroup || !this.imageProxy) return null

		const w = this.imageProxy.width()
		const h = this.imageProxy.height()
		const tr = this.imageProxy.getAbsoluteTransform(this.overlayGroup)
		const corners = [
			tr.point({ x: 0, y: 0 }),
			tr.point({ x: w, y: 0 }),
			tr.point({ x: 0, y: h }),
			tr.point({ x: w, y: h }),
		]
		const minX = Math.min(...corners.map((p) => p.x))
		const minY = Math.min(...corners.map((p) => p.y))
		const maxX = Math.max(...corners.map((p) => p.x))
		const maxY = Math.max(...corners.map((p) => p.y))

		return {
			x: minX,
			y: minY,
			width: this.normalizeDimension(maxX - minX),
			height: this.normalizeDimension(maxY - minY),
		}
	}

	private localBoxToLayerRect(localRect: {
		x: number
		y: number
		width: number
		height: number
	}): { x: number; y: number; width: number; height: number } {
		if (!this.overlayGroup) {
			return localRect
		}

		const transform = this.overlayGroup.getTransform()
		const corners = [
			{ x: localRect.x, y: localRect.y },
			{ x: localRect.x + localRect.width, y: localRect.y },
			{ x: localRect.x, y: localRect.y + localRect.height },
			{ x: localRect.x + localRect.width, y: localRect.y + localRect.height },
		]
		const layerCorners = corners.map((point) => transform.point(point))

		const minX = Math.min(...layerCorners.map((point) => point.x))
		const minY = Math.min(...layerCorners.map((point) => point.y))
		const maxX = Math.max(...layerCorners.map((point) => point.x))
		const maxY = Math.max(...layerCorners.map((point) => point.y))

		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
		}
	}

	private constrainImagePosition(nextPos: { x: number; y: number }) {
		if (!this.frameBox || !this.imageProxy) return nextPos

		const parent = this.imageProxy.getParent()
		if (!parent) return nextPos

		const parentTransform = parent.getAbsoluteTransform()
		const localTransform = parentTransform.copy().invert()
		const localPos = localTransform.point(nextPos)

		const minX = this.frameBox.x()
		const minY = this.frameBox.y()
		const maxX = Math.max(
			minX,
			this.frameBox.x() + this.frameBox.width() - this.imageProxy.width(),
		)
		const maxY = Math.max(
			minY,
			this.frameBox.y() + this.frameBox.height() - this.imageProxy.height(),
		)

		const constrainedLocalPos = {
			x: Math.min(Math.max(localPos.x, minX), maxX),
			y: Math.min(Math.max(localPos.y, minY), maxY),
		}

		return parentTransform.point(constrainedLocalPos)
	}

	private constrainImageBox(newBox: Box): Box {
		if (!this.overlayGroup || !this.frameBox) return newBox

		const localBox = boxToLocalBox(this.overlayGroup, newBox)
		if (!localBox) return newBox

		const frameLeft = this.frameBox.x()
		const frameTop = this.frameBox.y()
		const frameRight = frameLeft + this.frameBox.width()
		const frameBottom = frameTop + this.frameBox.height()
		const frameWidth = this.frameBox.width()
		const frameHeight = this.frameBox.height()
		const minSize = 1
		const activeAnchor = this.imageTransformer?.getActiveAnchor() ?? ""

		const constrainedBox: Box = this.normalizeBoxSize({ ...localBox })
		const currentRight = localBox.x + localBox.width
		const currentBottom = localBox.y + localBox.height

		if (localBox.x < frameLeft) {
			if (activeAnchor.includes("left")) {
				constrainedBox.x = frameLeft
				constrainedBox.width = currentRight - frameLeft
			} else {
				constrainedBox.x = frameLeft
			}
		}
		if (localBox.y < frameTop) {
			if (activeAnchor.includes("top")) {
				constrainedBox.y = frameTop
				constrainedBox.height = currentBottom - frameTop
			} else {
				constrainedBox.y = frameTop
			}
		}
		if (constrainedBox.x + constrainedBox.width > frameRight) {
			if (activeAnchor.includes("right")) {
				constrainedBox.width = frameRight - constrainedBox.x
			} else {
				constrainedBox.x = frameRight - constrainedBox.width
			}
		}
		if (constrainedBox.y + constrainedBox.height > frameBottom) {
			if (activeAnchor.includes("bottom")) {
				constrainedBox.height = frameBottom - constrainedBox.y
			} else {
				constrainedBox.y = frameBottom - constrainedBox.height
			}
		}

		if (constrainedBox.width > frameWidth) {
			constrainedBox.x = frameLeft
			constrainedBox.width = frameWidth
		}
		if (constrainedBox.height > frameHeight) {
			constrainedBox.y = frameTop
			constrainedBox.height = frameHeight
		}

		constrainedBox.width = Math.max(minSize, constrainedBox.width)
		constrainedBox.height = Math.max(minSize, constrainedBox.height)
		constrainedBox.x = Math.min(
			Math.max(constrainedBox.x, frameLeft),
			frameRight - constrainedBox.width,
		)
		constrainedBox.y = Math.min(
			Math.max(constrainedBox.y, frameTop),
			frameBottom - constrainedBox.height,
		)

		return localBoxToAbsoluteBox(this.overlayGroup, this.normalizeBoxSize(constrainedBox))
	}

	private constrainFrameBox(newBox: Box): Box {
		if (!this.overlayGroup || !this.imageProxy) return newBox

		const localBox = boxToLocalBox(this.overlayGroup, newBox)
		if (!localBox) return newBox

		const activeAnchor = this.frameTransformer?.getActiveAnchor() ?? ""
		const imageLeft = this.imageProxy.x()
		const imageTop = this.imageProxy.y()
		const imageRight = imageLeft + this.imageProxy.width()
		const imageBottom = imageTop + this.imageProxy.height()

		const constrainedBox: Box = this.normalizeBoxSize({ ...localBox })
		const currentRight = localBox.x + localBox.width
		const currentBottom = localBox.y + localBox.height

		if (activeAnchor.includes("left")) {
			if (localBox.x > imageLeft) {
				constrainedBox.x = imageLeft
				constrainedBox.width = currentRight - imageLeft
			}
		}
		if (activeAnchor.includes("right")) {
			if (currentRight < imageRight) {
				constrainedBox.width = imageRight - localBox.x
			}
		}
		if (activeAnchor.includes("top")) {
			if (localBox.y > imageTop) {
				constrainedBox.y = imageTop
				constrainedBox.height = currentBottom - imageTop
			}
		}
		if (activeAnchor.includes("bottom")) {
			if (currentBottom < imageBottom) {
				constrainedBox.height = imageBottom - localBox.y
			}
		}
		if (activeAnchor === "middle-left" && localBox.x > imageLeft) {
			constrainedBox.x = imageLeft
			constrainedBox.width = currentRight - imageLeft
		}
		if (activeAnchor === "middle-right" && currentRight < imageRight) {
			constrainedBox.width = imageRight - localBox.x
		}
		if (activeAnchor === "top-center" && localBox.y > imageTop) {
			constrainedBox.y = imageTop
			constrainedBox.height = currentBottom - imageTop
		}
		if (activeAnchor === "bottom-center" && currentBottom < imageBottom) {
			constrainedBox.height = imageBottom - localBox.y
		}

		return localBoxToAbsoluteBox(this.overlayGroup, this.normalizeBoxSize(constrainedBox))
	}

	private ensureImageProxyWithinFrame(): void {
		if (!this.frameBox || !this.imageProxy) return

		const frameLeft = this.frameBox.x()
		const frameTop = this.frameBox.y()
		const frameWidth = this.frameBox.width()
		const frameHeight = this.frameBox.height()
		const nextWidth = this.normalizeDimension(Math.min(this.imageProxy.width(), frameWidth))
		const nextHeight = this.normalizeDimension(Math.min(this.imageProxy.height(), frameHeight))
		const maxX = frameLeft + frameWidth - nextWidth
		const maxY = frameTop + frameHeight - nextHeight

		this.imageProxy.size({
			width: nextWidth,
			height: nextHeight,
		})
		this.imageProxy.position({
			x: Math.min(Math.max(this.imageProxy.x(), frameLeft), maxX),
			y: Math.min(Math.max(this.imageProxy.y(), frameTop), maxY),
		})
		this.syncAreaOverlay()
	}

	private applySession(session: ExtendSession): void {
		if (!this.frameBox || !this.imageProxy) return

		const normalizedFrame = this.normalizeFrame(session.frame)
		this.frameBox.position({ x: normalizedFrame.x, y: normalizedFrame.y })
		this.frameBox.size({ width: normalizedFrame.width, height: normalizedFrame.height })
		this.updateImageClip(normalizedFrame)
		this.ensureImageProxyWithinFrame()
		this.syncAreaOverlay()
		updateFrameGridLines(this.overlayGroup, normalizedFrame, EXTEND_GRID_LINE_NAME)
		this.updateFrameLabels()
		this.setKeepRatio()
		this.frameTransformer?.forceUpdate()
		this.imageTransformer?.forceUpdate()
		this.canvas.controlsLayer.batchDraw()
	}

	private createFrameLabels(): void {
		if (!this.nameLabelGroup) {
			this.nameLabelGroup = this.createLabelGroup(EXTEND_NAME_LABEL_NAME)
		}
		if (!this.sizeLabelGroup) {
			this.sizeLabelGroup = this.createLabelGroup(EXTEND_SIZE_LABEL_NAME)
		}
	}

	private createLabelGroup(name: string): Konva.Group {
		const labelGroup = new Konva.Group({
			name,
			listening: false,
			visible: false,
		})
		labelGroup.add(
			new Konva.Text({
				text: "",
				fontSize: EXTEND_DRAW_CONFIG.LABEL_FONT_SIZE,
				fontFamily: EXTEND_DRAW_CONFIG.LABEL_FONT_FAMILY,
				fill: EXTEND_DRAW_CONFIG.LABEL_FILL,
				listening: false,
			}),
		)
		this.canvas.overlayLayer.add(labelGroup)
		return labelGroup
	}

	private updateFrameLabels(): void {
		if (!this.frameBox || !this.nameLabelGroup || !this.sizeLabelGroup) return

		const frameRect = this.getBoundingRect()
		if (!frameRect) return

		const viewportScale = this.canvas.stage.scaleX() || 1
		const inverseScale = 1 / viewportScale
		const element = this.canvas.elementManager.getElementInstance(this.elementId)
		const imageData = this.canvas.elementManager.getElementData(
			this.elementId,
		) as ImageElement | null
		const nameText = element?.getNameLabelText() || imageData?.name || ""
		const sizeText = this.formatSizeLabelText(this.frameBox.width(), this.frameBox.height())

		const nameTextNode = this.nameLabelGroup.findOne("Text") as Konva.Text | null
		const sizeTextNode = this.sizeLabelGroup.findOne("Text") as Konva.Text | null
		if (!nameTextNode || !sizeTextNode) return

		nameTextNode.text(nameText)
		sizeTextNode.text(sizeText)
		this.nameLabelGroup.scale({ x: inverseScale, y: inverseScale })
		this.sizeLabelGroup.scale({ x: inverseScale, y: inverseScale })

		const scaledNameWidth = nameTextNode.width() * inverseScale
		const scaledSizeWidth = sizeTextNode.width() * inverseScale
		const scaledLabelHeight = nameTextNode.height() * inverseScale
		const scaledOffsetTop = EXTEND_DRAW_CONFIG.LABEL_OFFSET_TOP * inverseScale
		const labelY = frameRect.y - scaledLabelHeight - scaledOffsetTop
		const nameX = frameRect.x
		const sizeX = frameRect.x + frameRect.width - scaledSizeWidth

		this.nameLabelGroup.position({ x: nameX, y: labelY })
		this.sizeLabelGroup.position({ x: sizeX, y: labelY })

		const nameVisible =
			Boolean(nameText) && nameX + scaledNameWidth <= frameRect.x + frameRect.width
		const sizeVisible =
			Boolean(sizeText) &&
			sizeX >= frameRect.x &&
			(!nameText || nameVisible) &&
			!this.checkRectOverlap(
				{ x: nameX, y: labelY, width: scaledNameWidth, height: scaledLabelHeight },
				{ x: sizeX, y: labelY, width: scaledSizeWidth, height: scaledLabelHeight },
			)

		this.nameLabelGroup.visible(nameVisible)
		this.sizeLabelGroup.visible(sizeVisible)
		this.canvas.overlayLayer.batchDraw()
	}

	private checkRectOverlap(
		rect1: { x: number; y: number; width: number; height: number },
		rect2: { x: number; y: number; width: number; height: number },
		padding = 2,
	): boolean {
		return (
			rect1.x < rect2.x + rect2.width + padding &&
			rect1.x + rect1.width + padding > rect2.x &&
			rect1.y < rect2.y + rect2.height + padding &&
			rect1.y + rect1.height + padding > rect2.y
		)
	}

	private formatSizeLabelText(width: number, height: number): string {
		const formatSize = (value: number): string => {
			return Number.isInteger(value) ? value.toString() : value.toFixed(1)
		}

		return `${formatSize(Math.round(width))} x ${formatSize(Math.round(height))}`
	}

	public destroy(): void {
		this.removeEventListeners()
		this.restoreSourceElement()
		if (this.overlayGroup) {
			this.overlayGroup.destroy()
			this.overlayGroup = undefined
		}
		if (this.frameTransformer) {
			this.frameTransformer.destroy()
			this.frameTransformer = undefined
		}
		if (this.imageTransformer) {
			this.imageTransformer.destroy()
			this.imageTransformer = undefined
		}
		if (this.nameLabelGroup) {
			this.nameLabelGroup.destroy()
			this.nameLabelGroup = undefined
		}
		if (this.sizeLabelGroup) {
			this.sizeLabelGroup.destroy()
			this.sizeLabelGroup = undefined
		}
		this.canvas.overlayLayer.batchDraw()
		this.canvas.controlsLayer.batchDraw()
		this.canvas.cursorManager.restoreToolCursor()
	}

	public static isExtendOverlayNode(node: Konva.Node | null): boolean {
		return isManagedOverlayNode(node, EXTEND_OVERLAY_GROUP_NAMES)
	}
}
