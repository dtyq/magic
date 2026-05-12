import Konva from "konva"
import type { Canvas } from "../Canvas"
import type { CropConfig, ImageElement } from "../types"
import { ElementTypeEnum } from "../types"
import {
	applyAspectRatioToBoundBox,
	calculateSnapThreshold,
	isEdgeAnchor,
	SNAP_THRESHOLD,
} from "./anchorUtils"
import type { Box } from "konva/lib/shapes/Transformer"
import {
	FRAME_EDITOR_CONFIG,
	boxToLocalBox,
	createFrameEditorAnchorStyleFunc,
	createFrameGridLines,
	isManagedOverlayNode,
	localBoxToAbsoluteBox,
	updateFrameGridLines,
} from "./FrameEditorShared"

const CROP_OVERLAY_GROUP_NAME = "crop-overlay"
const CROP_BOX_NAME = "crop-box"
const CROP_AREA_NAME = "crop-area"
const CROP_AREA_HIT_PROXY_NAME = "crop-area-hit-proxy"
const CROP_OVERFLOW_OVERLAY_NAME = "crop-overflow-overlay"
const CROP_OVERFLOW_GRAY_NAME = "crop-overflow-gray"
const CROP_OVERFLOW_CUT_NAME = "crop-overflow-cut"
const CROP_GRID_LINE_NAME = "crop-grid-line"
const CROP_OVERLAY_GROUP_NAMES = [CROP_OVERLAY_GROUP_NAME]

// 绘制配置常量
const DRAW_CONFIG = {
	// 遮罩配置
	MASK_FILL: "rgba(0, 0, 0, 0.6)",

	// 裁剪区域配置
	CROP_AREA_FILL: "rgba(0, 0, 0, 1)",
	CROP_AREA_COMPOSITE_OPERATION: "destination-out" as GlobalCompositeOperation,

	// 裁剪框溢出配置（图片外的部分显示灰色透明）
	CROP_OVERFLOW_FILL: "rgba(128, 128, 128, 0.5)",

	// 裁剪框边框配置
	CROP_BOX_STROKE: FRAME_EDITOR_CONFIG.BOX_STROKE,
	CROP_BOX_STROKE_WIDTH: FRAME_EDITOR_CONFIG.BOX_STROKE_WIDTH,

	// Transformer 配置
	TRANSFORMER_ANCHOR_SIZE: FRAME_EDITOR_CONFIG.TRANSFORMER_ANCHOR_SIZE,
	TRANSFORMER_BORDER_STROKE: FRAME_EDITOR_CONFIG.TRANSFORMER_BORDER_STROKE,
	TRANSFORMER_BORDER_STROKE_WIDTH: FRAME_EDITOR_CONFIG.TRANSFORMER_BORDER_STROKE_WIDTH,
	TRANSFORMER_ANCHOR_STROKE: FRAME_EDITOR_CONFIG.TRANSFORMER_ANCHOR_STROKE,
	TRANSFORMER_ANCHOR_FILL: FRAME_EDITOR_CONFIG.TRANSFORMER_ANCHOR_FILL,
	TRANSFORMER_ANCHOR_STROKE_WIDTH: FRAME_EDITOR_CONFIG.TRANSFORMER_ANCHOR_STROKE_WIDTH,

	// 网格线配置
	GRID_LINE_STROKE: FRAME_EDITOR_CONFIG.GRID_LINE_STROKE,
	GRID_LINE_STROKE_WIDTH: FRAME_EDITOR_CONFIG.GRID_LINE_STROKE_WIDTH,
	GRID_DIVISIONS: FRAME_EDITOR_CONFIG.GRID_DIVISIONS, // 九宫格分割数

	// 裁剪尺寸限制
	MIN_CROP_WIDTH: 50,
	MIN_CROP_HEIGHT: 50,
} as const

/**
 * 裁剪渲染器 - 负责绘制裁剪框 overlay
 * 职责单一：在 controlsLayer 上绘制裁剪框，与 ImageElement 解耦
 */
export class CropRenderer {
	private canvas: Canvas
	private elementId: string

	private overlayGroup?: Konva.Group
	private cropTransformer?: Konva.Transformer
	private updateFromPanelHandler?: (event: {
		data: { elementId: string; tempCrop: CropConfig; isLocked?: boolean }
	}) => void
	// 记录 transform 开始时的初始宽高比（用于 Shift/Meta 锁定宽高比）
	private initialAspectRatio: number | null = null

	// 元素边界（用于吸附计算）
	private elementBounds: { width: number; height: number } | null = null

	// 记录当前吸附的边（用于锁定已吸附的边，避免继续移动时改变）
	private snappedEdges: {
		left?: boolean
		right?: boolean
		top?: boolean
		bottom?: boolean
	} = {}

	constructor(options: { canvas: Canvas; elementId: string }) {
		const { canvas, elementId } = options
		this.canvas = canvas
		this.elementId = elementId

		this.setupEventListeners()
	}

	/**
	 * 同步 Transformer 的宽高比锁定状态（与 TransformManager 一致）
	 * 修饰键状态由 Canvas 在键盘事件中统一设置
	 */
	public setKeepRatio(): void {
		if (!this.cropTransformer) return
		this.cropTransformer.keepRatio(this.canvas.isKeepRatioModifierPressed())
	}

	/**
	 * 设置事件监听器
	 */
	private setupEventListeners(): void {
		// 注意：setKeepRatio 由 CropManager 在 modifier 键变化时调用
		this.updateFromPanelHandler = ({ data }) => {
			if (data.elementId === this.elementId) {
				this.handlePanelUpdate(data)
			}
		}
		this.canvas.eventEmitter.on("crop:updateFromPanel", this.updateFromPanelHandler)
	}

	/**
	 * 移除事件监听器
	 */
	private removeEventListeners(): void {
		if (this.updateFromPanelHandler) {
			this.canvas.eventEmitter.off("crop:updateFromPanel", this.updateFromPanelHandler)
			this.updateFromPanelHandler = undefined
		}
	}

	/**
	 * 渲染裁剪框 overlay
	 */
	public render(): void {
		const tempCrop = this.canvas.cropManager.getTempCrop()
		if (!tempCrop) return

		const elementData = this.canvas.elementManager.getElementData(this.elementId)
		if (!elementData || elementData.type !== ElementTypeEnum.Image) return

		const imageElement = elementData as ImageElement
		const elementInstance = this.canvas.elementManager.getElementInstance(this.elementId)
		const elementNode = elementInstance?.getNode()
		if (!elementNode) return

		// 使用节点的 width/height 作为裁剪边界（与 overlay 坐标系统一致，已考虑 scaleX/scaleY）
		// crop 坐标空间是元素的逻辑尺寸，即 node.width() x node.height()，不受 scale 影响
		const elementWidth = elementNode.width() ?? imageElement.width ?? 0
		const elementHeight = elementNode.height() ?? imageElement.height ?? 0
		if (elementWidth <= 0 || elementHeight <= 0) return

		// 保存元素边界用于吸附计算
		this.elementBounds = { width: elementWidth, height: elementHeight }

		// 直接使用元素的变换属性（x, y, scaleX, scaleY, rotation）
		// 因为 overlayGroup 和元素都在同一个 stage 的不同 layer 上，坐标系统一致
		const elementX = elementNode.x()
		const elementY = elementNode.y()
		const elementScaleX = elementNode.scaleX()
		const elementScaleY = elementNode.scaleY()
		const elementRotation = elementNode.rotation()

		this.overlayGroup = new Konva.Group({
			x: elementX,
			y: elementY,
			scaleX: elementScaleX,
			scaleY: elementScaleY,
			rotation: elementRotation,
			offset: { x: 0, y: 0 },
			name: CROP_OVERLAY_GROUP_NAME,
			listening: true,
		})

		// 1. 半透明遮罩(裁剪框外区域) - listening: true 拦截点击，防止穿透到底层图片触发选中
		const mask = new Konva.Rect({
			x: 0,
			y: 0,
			width: elementWidth,
			height: elementHeight,
			fill: DRAW_CONFIG.MASK_FILL,
			listening: true,
		})

		// 2. 裁剪框内的透明区域(挖空效果) - listening: true 拦截点击，防止穿透到底层图片
		const cropArea = new Konva.Rect({
			x: tempCrop.x,
			y: tempCrop.y,
			width: tempCrop.width,
			height: tempCrop.height,
			fill: DRAW_CONFIG.CROP_AREA_FILL,
			globalCompositeOperation: DRAW_CONFIG.CROP_AREA_COMPOSITE_OPERATION,
			listening: true,
			draggable: true,
			name: CROP_AREA_NAME,
		})

		// 3. 裁剪框边框（白色，2单位宽度）
		const cropBox = new Konva.Rect({
			x: tempCrop.x,
			y: tempCrop.y,
			width: tempCrop.width,
			height: tempCrop.height,
			stroke: DRAW_CONFIG.CROP_BOX_STROKE,
			strokeWidth: DRAW_CONFIG.CROP_BOX_STROKE_WIDTH,
			fill: undefined,
			draggable: true,
			name: CROP_BOX_NAME,
		})

		const setMoveCursor = () => {
			this.canvas.cursorManager.setTemporary("move")
		}

		const resetCursor = () => {
			this.canvas.cursorManager.restoreToolCursor()
		}

		// hit 代理：透明 Rect 置于最顶层，无 composite 干扰，专门接收 hit 以触发 cursor 和拖拽
		const cropAreaHitProxy = new Konva.Rect({
			x: tempCrop.x,
			y: tempCrop.y,
			width: tempCrop.width,
			height: tempCrop.height,
			fill: "transparent",
			listening: true,
			draggable: true,
			name: CROP_AREA_HIT_PROXY_NAME,
		})
		cropAreaHitProxy.on("mouseenter", setMoveCursor)
		cropAreaHitProxy.on("mouseleave", resetCursor)

		// 监听变换
		cropBox.on("transform", () => {
			const scaleX = cropBox.scaleX()
			const scaleY = cropBox.scaleY()
			cropBox.width(cropBox.width() * scaleX)
			cropBox.height(cropBox.height() * scaleY)
			cropBox.scaleX(1)
			cropBox.scaleY(1)
			cropArea.width(cropBox.width())
			cropArea.height(cropBox.height())
			cropArea.position(cropBox.position())
			cropAreaHitProxy.size(cropBox.size())
			cropAreaHitProxy.position(cropBox.position())
			this.updateGridLines(cropBox)
			this.updateOverflowOverlay(cropBox)
			this.canvas.cropManager.updateTempCrop({
				x: cropBox.x(),
				y: cropBox.y(),
				width: cropBox.width(),
				height: cropBox.height(),
			})
		})

		// 拖动时同步 cropArea、hitProxy 和 tempCrop，并应用吸附
		const handleDragMove = (sourceNode: Konva.Rect) => {
			const snappedPosition = this.applySnapForDrag(
				sourceNode.x(),
				sourceNode.y(),
				sourceNode.width(),
				sourceNode.height(),
			)
			cropBox.position(snappedPosition)
			cropArea.position(snappedPosition)
			cropAreaHitProxy.position(snappedPosition)
			this.updateGridLines(cropBox)
			this.updateOverflowOverlay(cropBox)
			this.canvas.cropManager.updateTempCrop({
				x: snappedPosition.x,
				y: snappedPosition.y,
				width: cropBox.width(),
				height: cropBox.height(),
			})
		}

		cropBox.on("dragmove", () => handleDragMove(cropBox))
		cropArea.on("dragmove", () => handleDragMove(cropArea))
		cropAreaHitProxy.on("dragmove", () => handleDragMove(cropAreaHitProxy))

		// 4. 裁剪框溢出层（图片外部分灰色半透明，destination-out 方案）
		const overflowOverlay = this.createOverflowOverlay(tempCrop, elementWidth, elementHeight)

		// 5. 九宫格线条（灰色）
		const gridLines = this.createGridLines(cropBox)

		this.overlayGroup.add(
			mask,
			cropArea,
			overflowOverlay,
			cropBox,
			...gridLines,
			cropAreaHitProxy,
		)
		this.canvas.controlsLayer.add(this.overlayGroup)

		// 4. Transformer（只显示4个角点anchor，但上下左右边缘也支持编辑）
		const anchorSize = DRAW_CONFIG.TRANSFORMER_ANCHOR_SIZE
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

		const anchorStyleFunc = createFrameEditorAnchorStyleFunc(anchorSize)

		this.cropTransformer = new Konva.Transformer({
			nodes: [cropBox],
			keepRatio: this.canvas.isKeepRatioModifierPressed(),
			rotateEnabled: false,
			enabledAnchors,
			anchorSize,
			borderStroke: DRAW_CONFIG.TRANSFORMER_BORDER_STROKE,
			borderStrokeWidth: DRAW_CONFIG.TRANSFORMER_BORDER_STROKE_WIDTH,
			anchorStroke: DRAW_CONFIG.TRANSFORMER_ANCHOR_STROKE,
			anchorFill: DRAW_CONFIG.TRANSFORMER_ANCHOR_FILL,
			anchorStrokeWidth: DRAW_CONFIG.TRANSFORMER_ANCHOR_STROKE_WIDTH,
			anchorCornerRadius: anchorSize / 2, // 设置为圆形
			ignoreStroke: true,
			anchorStyleFunc,
			boundBoxFunc: (oldBox: Box, newBox: Box): Box => {
				// 防止翻转：确保宽度和高度始终为正数
				if (newBox.width < 0 || newBox.height < 0) {
					return oldBox
				}

				let resultBox: Box = newBox
				const activeAnchor = this.cropTransformer?.getActiveAnchor()

				// 与 TransformManager 一致：仅 edge anchor 时手动约束宽高比，角点交给 Konva keepRatio 处理
				const currentShouldKeepRatio = this.canvas.isKeepRatioModifierPressed()
				if (currentShouldKeepRatio && activeAnchor && isEdgeAnchor(activeAnchor)) {
					resultBox = applyAspectRatioToBoundBox(
						oldBox,
						resultBox,
						activeAnchor,
						this.initialAspectRatio,
					)
				}

				resultBox = this.applySnapForTransform(oldBox, resultBox, activeAnchor ?? null)
				return resultBox
			},
		})

		// 监听 transformstart 事件，记录初始宽高比和重置吸附状态
		this.cropTransformer.on("transformstart", () => {
			const cropBoxNode = this.cropTransformer?.nodes()[0]
			if (cropBoxNode instanceof Konva.Rect) {
				const width = cropBoxNode.width() * cropBoxNode.scaleX()
				const height = cropBoxNode.height() * cropBoxNode.scaleY()
				if (height > 0) {
					this.initialAspectRatio = width / height
				}
			}
			// 重置吸附状态
			this.snappedEdges = {}
		})

		// 监听 transformend 事件，重置初始宽高比和吸附状态
		this.cropTransformer.on("transformend", () => {
			this.initialAspectRatio = null
			this.snappedEdges = {}
		})
		this.canvas.controlsLayer.add(this.cropTransformer)
		this.cropTransformer.moveToTop()
		this.canvas.controlsLayer.batchDraw()
	}

	/**
	 * 创建裁剪框溢出层（图片外部分灰色半透明）
	 * destination-out 方案：灰层覆盖 crop，再用 (crop∩image) 挖空，保留 (crop-image) 的灰
	 */
	private createOverflowOverlay(
		crop: CropConfig,
		elementWidth: number,
		elementHeight: number,
	): Konva.Group {
		const group = new Konva.Group({ name: CROP_OVERFLOW_OVERLAY_NAME, listening: false })

		// 灰层：覆盖整个 crop
		const grayRect = new Konva.Rect({
			x: crop.x,
			y: crop.y,
			width: crop.width,
			height: crop.height,
			fill: DRAW_CONFIG.CROP_OVERFLOW_FILL,
			listening: false,
			name: CROP_OVERFLOW_GRAY_NAME,
		})
		group.add(grayRect)

		// 挖空层：(crop ∩ image) 使用 destination-out 从灰层中挖掉
		const left = Math.max(crop.x, 0)
		const top = Math.max(crop.y, 0)
		const right = Math.min(crop.x + crop.width, elementWidth)
		const bottom = Math.min(crop.y + crop.height, elementHeight)
		if (left < right && top < bottom) {
			const cutRect = new Konva.Rect({
				x: left,
				y: top,
				width: right - left,
				height: bottom - top,
				fill: "rgba(0, 0, 0, 1)",
				globalCompositeOperation: "destination-out",
				listening: false,
				name: CROP_OVERFLOW_CUT_NAME,
			})
			group.add(cutRect)
		}

		return group
	}

	/**
	 * 更新溢出层位置和尺寸（crop 或 transform 时调用）
	 */
	private updateOverflowOverlay(cropBox: Konva.Rect): void {
		if (!this.overlayGroup || !this.elementBounds) return

		const group = this.overlayGroup.findOne(`.${CROP_OVERFLOW_OVERLAY_NAME}`) as
			| Konva.Group
			| undefined
		if (!group) return

		const x = cropBox.x()
		const y = cropBox.y()
		const width = cropBox.width()
		const height = cropBox.height()
		const { width: elemW, height: elemH } = this.elementBounds

		const grayRect = group.findOne(`.${CROP_OVERFLOW_GRAY_NAME}`) as Konva.Rect
		if (grayRect) {
			grayRect.setAttrs({ x, y, width, height })
		}

		const left = Math.max(x, 0)
		const top = Math.max(y, 0)
		const right = Math.min(x + width, elemW)
		const bottom = Math.min(y + height, elemH)

		let cutRect = group.findOne(`.${CROP_OVERFLOW_CUT_NAME}`) as Konva.Rect | undefined
		if (left < right && top < bottom) {
			if (!cutRect) {
				cutRect = new Konva.Rect({
					x: left,
					y: top,
					width: right - left,
					height: bottom - top,
					fill: "rgba(0, 0, 0, 1)",
					globalCompositeOperation: "destination-out",
					listening: false,
					name: CROP_OVERFLOW_CUT_NAME,
				})
				group.add(cutRect)
			} else {
				cutRect.setAttrs({
					x: left,
					y: top,
					width: right - left,
					height: bottom - top,
				})
			}
		} else if (cutRect) {
			cutRect.remove()
			cutRect.destroy()
		}
	}

	/**
	 * 创建九宫格线条
	 */
	private createGridLines(cropBox: Konva.Rect): Konva.Line[] {
		return createFrameGridLines(
			{
				x: cropBox.x(),
				y: cropBox.y(),
				width: cropBox.width(),
				height: cropBox.height(),
			},
			CROP_GRID_LINE_NAME,
			DRAW_CONFIG.GRID_DIVISIONS,
		)
	}

	/**
	 * 更新九宫格线条位置
	 */
	private updateGridLines(cropBox: Konva.Rect): void {
		updateFrameGridLines(
			this.overlayGroup,
			{
				x: cropBox.x(),
				y: cropBox.y(),
				width: cropBox.width(),
				height: cropBox.height(),
			},
			CROP_GRID_LINE_NAME,
			DRAW_CONFIG.GRID_DIVISIONS,
		)
	}

	/**
	 * 处理面板更新
	 */
	private handlePanelUpdate(data: {
		elementId: string
		tempCrop: CropConfig
		isLocked?: boolean
	}): void {
		if (!this.overlayGroup) return

		const cropBox = this.overlayGroup.findOne(`.${CROP_BOX_NAME}`) as Konva.Rect
		const cropArea = this.overlayGroup.findOne(`.${CROP_AREA_NAME}`) as Konva.Rect
		const cropAreaHitProxy = this.overlayGroup.findOne(`.${CROP_AREA_HIT_PROXY_NAME}`) as
			| Konva.Rect
			| undefined

		if (cropBox && cropArea) {
			cropBox.position({ x: data.tempCrop.x, y: data.tempCrop.y })
			cropBox.size({ width: data.tempCrop.width, height: data.tempCrop.height })
			cropArea.position({ x: data.tempCrop.x, y: data.tempCrop.y })
			cropArea.size({ width: data.tempCrop.width, height: data.tempCrop.height })
			if (cropAreaHitProxy) {
				cropAreaHitProxy.position({ x: data.tempCrop.x, y: data.tempCrop.y })
				cropAreaHitProxy.size({ width: data.tempCrop.width, height: data.tempCrop.height })
			}
			this.updateGridLines(cropBox)
			this.updateOverflowOverlay(cropBox)
		}

		if (this.cropTransformer) {
			this.setKeepRatio()
		}

		this.canvas.controlsLayer.batchDraw()
	}

	/**
	 * 销毁 overlay
	 */
	public destroy(): void {
		this.removeEventListeners()
		if (this.overlayGroup) {
			this.overlayGroup.destroy()
			this.overlayGroup = undefined
		}
		if (this.cropTransformer) {
			this.cropTransformer.destroy()
			this.cropTransformer = undefined
		}
		this.canvas.controlsLayer?.batchDraw()
	}

	/**
	 * 获取吸附阈值
	 */
	private getSnapThreshold() {
		if (!this.overlayGroup) return SNAP_THRESHOLD
		const scale = this.overlayGroup.scaleX()
		// 确保 scale 有效，避免除以 0 导致 Infinity
		if (scale && scale > 0) {
			return calculateSnapThreshold(scale)
		} else {
			return SNAP_THRESHOLD
		}
	}

	/**
	 * 计算拖动时的吸附位置
	 */
	private applySnapForDrag(
		x: number,
		y: number,
		width: number,
		height: number,
	): { x: number; y: number } {
		if (!this.elementBounds) return { x, y }

		const threshold = this.getSnapThreshold()
		let snappedX = x
		let snappedY = y

		// 水平吸附：左边和右边
		if (Math.abs(x - 0) < threshold) {
			snappedX = 0
		} else if (Math.abs(x + width - this.elementBounds.width) < threshold) {
			snappedX = this.elementBounds.width - width
		}

		// 垂直吸附：上边和下边
		if (Math.abs(y - 0) < threshold) {
			snappedY = 0
		} else if (Math.abs(y + height - this.elementBounds.height) < threshold) {
			snappedY = this.elementBounds.height - height
		}

		return { x: snappedX, y: snappedY }
	}

	/**
	 * 将 boundBoxFunc 的 box 从 stage 空间转换到 overlayGroup 本地空间（元素逻辑坐标）
	 * Konva Transformer 的 boundBoxFunc 传入的 box 可能是 stage/layer 坐标，需与 elementBounds（元素逻辑）统一
	 */
	private boxToElementLocal(box: Box): Box | null {
		if (!this.overlayGroup || !this.elementBounds) return null
		return boxToLocalBox(this.overlayGroup, box)
	}

	/**
	 * 将元素本地空间的 box 转换回 boundBoxFunc 期望的 stage 空间
	 */
	private elementLocalToBox(localBox: Box): Box {
		return localBoxToAbsoluteBox(this.overlayGroup, localBox)
	}

	/**
	 * 计算变换时的吸附 Box
	 */
	private applySnapForTransform(oldBox: Box, newBox: Box, activeAnchor: string | null): Box {
		if (!this.elementBounds) return newBox

		// boundBoxFunc 的 box 为 stage 坐标，需转为元素本地空间再与 elementBounds 比较
		const localBox = this.boxToElementLocal(newBox)
		if (!localBox) {
			return newBox
		}

		const threshold = this.getSnapThreshold()
		const snappedBox: Box = { ...localBox }

		// 根据 activeAnchor 确定需要吸附的边（统一使用 localBox = 元素本地空间）
		if (!activeAnchor) {
			// 纯拖动，吸附所有边（boundBoxFunc 中通常不会出现这种情况，但为了安全起见）
			const snappedPos = this.applySnapForDrag(
				localBox.x,
				localBox.y,
				localBox.width,
				localBox.height,
			)
			snappedBox.x = snappedPos.x
			snappedBox.y = snappedPos.y
		} else {
			// 缩放操作，根据 anchor 位置吸附对应的边（使用 localBox = 元素本地空间）
			const left = localBox.x
			const right = localBox.x + localBox.width
			const top = localBox.y
			const bottom = localBox.y + localBox.height

			// 中间位置的 anchor 需要特殊处理（优先处理，避免与通用逻辑冲突）
			if (activeAnchor === "top-center") {
				// 只能改变高度，吸附上边或下边
				if (this.snappedEdges.top) {
					// 已吸附上边，锁定上边位置
					snappedBox.y = 0
					snappedBox.height = localBox.height + localBox.y
					// 检查是否移出吸附范围
					if (top > threshold) {
						this.snappedEdges.top = false
					}
				} else if (this.snappedEdges.bottom) {
					// 已吸附下边，锁定下边位置
					snappedBox.height = this.elementBounds.height - localBox.y
					// 检查是否移出吸附范围
					if (bottom < this.elementBounds.height - threshold) {
						this.snappedEdges.bottom = false
					}
				} else {
					// 未吸附，检查是否需要吸附
					if (Math.abs(top - 0) < threshold) {
						snappedBox.height = localBox.height + localBox.y
						snappedBox.y = 0
						this.snappedEdges.top = true
					} else if (Math.abs(bottom - this.elementBounds.height) < threshold) {
						snappedBox.height = this.elementBounds.height - localBox.y
						this.snappedEdges.bottom = true
					}
				}
			} else if (activeAnchor === "bottom-center") {
				// 只能改变高度，吸附上边或下边
				if (this.snappedEdges.top) {
					// 已吸附上边，锁定上边位置
					snappedBox.y = 0
					snappedBox.height = localBox.height + localBox.y
					// 检查是否移出吸附范围
					if (top > threshold) {
						this.snappedEdges.top = false
					}
				} else if (this.snappedEdges.bottom) {
					// 已吸附下边，锁定下边位置
					snappedBox.height = this.elementBounds.height - localBox.y
					// 检查是否移出吸附范围
					if (bottom < this.elementBounds.height - threshold) {
						this.snappedEdges.bottom = false
					}
				} else {
					// 未吸附，检查是否需要吸附
					if (Math.abs(top - 0) < threshold) {
						snappedBox.height = localBox.height + localBox.y
						snappedBox.y = 0
						this.snappedEdges.top = true
					} else if (Math.abs(bottom - this.elementBounds.height) < threshold) {
						snappedBox.height = this.elementBounds.height - localBox.y
						this.snappedEdges.bottom = true
					}
				}
			} else if (activeAnchor === "middle-left") {
				// 只能改变宽度，吸附左边或右边
				if (this.snappedEdges.left) {
					// 已吸附左边，锁定左边位置
					snappedBox.x = 0
					snappedBox.width = localBox.width + localBox.x
					// 检查是否移出吸附范围
					if (left > threshold) {
						this.snappedEdges.left = false
					}
				} else if (this.snappedEdges.right) {
					// 已吸附右边，锁定右边位置
					snappedBox.width = this.elementBounds.width - localBox.x
					// 检查是否移出吸附范围
					if (right < this.elementBounds.width - threshold) {
						this.snappedEdges.right = false
					}
				} else {
					// 未吸附，检查是否需要吸附
					if (Math.abs(left - 0) < threshold) {
						snappedBox.width = localBox.width + localBox.x
						snappedBox.x = 0
						this.snappedEdges.left = true
					} else if (Math.abs(right - this.elementBounds.width) < threshold) {
						snappedBox.width = this.elementBounds.width - localBox.x
						this.snappedEdges.right = true
					}
				}
			} else if (activeAnchor === "middle-right") {
				// 只能改变宽度，吸附左边或右边
				if (this.snappedEdges.left) {
					// 已吸附左边，锁定左边位置
					snappedBox.x = 0
					snappedBox.width = localBox.width + localBox.x
					// 检查是否移出吸附范围
					if (left > threshold) {
						this.snappedEdges.left = false
					}
				} else if (this.snappedEdges.right) {
					// 已吸附右边，锁定右边位置
					snappedBox.width = this.elementBounds.width - localBox.x
					// 检查是否移出吸附范围
					if (right < this.elementBounds.width - threshold) {
						this.snappedEdges.right = false
					}
				} else {
					// 未吸附，检查是否需要吸附
					if (Math.abs(left - 0) < threshold) {
						snappedBox.width = localBox.width + localBox.x
						snappedBox.x = 0
						this.snappedEdges.left = true
					} else if (Math.abs(right - this.elementBounds.width) < threshold) {
						snappedBox.width = this.elementBounds.width - localBox.x
						this.snappedEdges.right = true
					}
				}
			} else {
				// 角点 anchor：水平方向吸附
				if (activeAnchor.includes("left")) {
					if (this.snappedEdges.left) {
						// 已吸附左边，锁定左边位置
						snappedBox.x = 0
						snappedBox.width = localBox.width + localBox.x
						// 检查是否移出吸附范围
						if (left > threshold) {
							this.snappedEdges.left = false
						}
					} else if (Math.abs(left - 0) < threshold) {
						snappedBox.width = snappedBox.width + snappedBox.x
						snappedBox.x = 0
						this.snappedEdges.left = true
					}
				} else if (activeAnchor.includes("right")) {
					if (this.snappedEdges.right) {
						// 已吸附右边，锁定右边位置
						snappedBox.width = this.elementBounds.width - localBox.x
						// 检查是否移出吸附范围
						if (right < this.elementBounds.width - threshold) {
							this.snappedEdges.right = false
						}
					} else if (Math.abs(right - this.elementBounds.width) < threshold) {
						snappedBox.width = this.elementBounds.width - snappedBox.x
						this.snappedEdges.right = true
					}
				}

				// 角点 anchor：垂直方向吸附
				if (activeAnchor.includes("top")) {
					if (this.snappedEdges.top) {
						// 已吸附上边，锁定上边位置
						snappedBox.y = 0
						snappedBox.height = localBox.height + localBox.y
						// 检查是否移出吸附范围
						if (top > threshold) {
							this.snappedEdges.top = false
						}
					} else if (Math.abs(top - 0) < threshold) {
						snappedBox.height = snappedBox.height + snappedBox.y
						snappedBox.y = 0
						this.snappedEdges.top = true
					}
				} else if (activeAnchor.includes("bottom")) {
					if (this.snappedEdges.bottom) {
						// 已吸附下边，锁定下边位置
						snappedBox.height = this.elementBounds.height - localBox.y
						// 检查是否移出吸附范围
						if (bottom < this.elementBounds.height - threshold) {
							this.snappedEdges.bottom = false
						}
					} else if (Math.abs(bottom - this.elementBounds.height) < threshold) {
						snappedBox.height = this.elementBounds.height - snappedBox.y
						this.snappedEdges.bottom = true
					}
				}
			}
		}

		// boundBoxFunc 传入 stage 空间，返回也需为 stage 空间
		return this.elementLocalToBox(snappedBox)
	}

	/**
	 * 判断节点是否属于裁剪 overlay
	 */
	public static isCropOverlayNode(node: Konva.Node | null): boolean {
		return isManagedOverlayNode(node, CROP_OVERLAY_GROUP_NAMES)
	}
}
