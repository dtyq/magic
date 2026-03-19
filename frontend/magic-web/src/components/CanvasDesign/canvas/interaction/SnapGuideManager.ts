import Konva from "konva"
import type { Box } from "konva/lib/shapes/Transformer"
import type { Canvas } from "../Canvas"
import type { Rect } from "../utils/utils"
import type { LayerElement } from "../types"
import { normalizeSize } from "../utils/normalizeUtils"
import { constrainRectToAspectRatio } from "./anchorUtils"
import type { AlignmentInfo, AlignmentType } from "./snapGuideTypes"
import { SnapGuideRenderer } from "./SnapGuideRenderer"
import { SnapResolver, type SnapResolverContext } from "./SnapResolver"

/**
 * 吸附引导线管理器
 * 职责：计算吸附 + 更新元素位置
 * 视觉绘制委托给 SnapGuideRenderer
 *
 * 对齐逻辑：
 * - 只考虑同级元素之间的对齐（兄弟元素）
 * - 如果元素在 Frame 内，还会考虑与 Frame 边界的对齐
 * - 不会与不同层级的元素对齐（例如：Frame 外的元素不会与 Frame 内的子元素对齐）
 */
export class SnapGuideManager implements SnapResolverContext {
	private canvas: Canvas
	private guideRenderer: SnapGuideRenderer
	private snapResolver: SnapResolver

	// 吸附阈值（像素）- 在此范围内会自动吸附
	private readonly SNAP_THRESHOLD = 8

	// 是否启用吸附
	private enabled = true

	// 是否正在拖拽
	private isDragging = false

	// 当前激活的 anchor（用于缩放时的吸附）
	private activeAnchor: string | null = null

	// 交互期间缓存的参数（viewport 不变，避免每帧重复计算）
	private cachedSnapThreshold = 0
	private cachedGuideThreshold = 0

	// 上一帧吸附结果签名，用于判断辅助线是否需要重绘
	private lastSnappedAlignmentsKey: string | null = null

	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas
		this.guideRenderer = new SnapGuideRenderer({
			overlayLayer: canvas.overlayLayer,
		})
		this.snapResolver = new SnapResolver(this)
		this.setupEventListeners()
	}

	ensureCache(): void {
		if (this.cachedSnapThreshold === 0) this.cacheVisualParams()
	}

	/**
	 * 设置事件监听
	 */
	private setupEventListeners(): void {
		// 监听拖拽开始
		this.canvas.eventEmitter.on("elements:transform:dragstart", () => {
			this.isDragging = true
			this.activeAnchor = null
			this.lastSnappedAlignmentsKey = null
			this.cacheVisualParams()
		})

		// 监听拖拽移动
		this.canvas.eventEmitter.on("elements:transform:dragmove", () => {
			if (!this.enabled || !this.isDragging) return
			this.processSnap()
		})

		// 监听拖拽结束
		this.canvas.eventEmitter.on("elements:transform:dragend", () => {
			this.isDragging = false
			this.activeAnchor = null
			this.lastSnappedAlignmentsKey = null
			this.guideRenderer.clear()
		})

		// 监听缩放开始
		this.canvas.eventEmitter.on("elements:transform:anchorDragStart", ({ data }) => {
			this.isDragging = true
			this.activeAnchor = data.activeAnchor
			this.lastSnappedAlignmentsKey = null
			this.cacheVisualParams()
		})

		// 监听缩放移动
		this.canvas.eventEmitter.on("elements:transform:anchorDragmove", () => {
			if (!this.enabled || !this.isDragging) return
			this.processSnap()
		})

		// 监听缩放结束
		this.canvas.eventEmitter.on("elements:transform:anchorDragend", () => {
			this.isDragging = false
			this.activeAnchor = null
			this.lastSnappedAlignmentsKey = null
			this.guideRenderer.clear()
		})
	}

	/**
	 * 生成吸附结果签名，用于判断辅助线是否需要重绘
	 * 仅当 type + targetElementId 组合变化时才重绘（脱离吸附或切换目标）
	 */
	private getSnappedAlignmentsKey(alignments: AlignmentInfo[]): string {
		if (alignments.length === 0) return ""
		return alignments
			.map((a) => `${a.type}:${a.targetElementId}`)
			.sort()
			.join("|")
	}

	/**
	 * 交互开始缓存参数（viewport/scale 不变，避免每帧重复计算）
	 */
	private cacheVisualParams(): void {
		const scale = this.canvas.stage.scaleX()
		this.cachedSnapThreshold = this.SNAP_THRESHOLD / scale
		const viewportWidth = this.canvas.stage.width() / scale
		this.cachedGuideThreshold = viewportWidth / 4
		this.guideRenderer.cacheVisualParams(scale)
	}

	/**
	 * 主入口：编排核心逻辑 + 视觉渲染
	 * 吸附计算委托给 SnapResolver，应用根据场景分发
	 */
	private processSnap(): void {
		if (!this.enabled) return

		const selectedIds = this.canvas.selectionManager.getSelectedIds()
		if (selectedIds.length === 0) return

		const targets = this.getAlignmentTargets(selectedIds)
		const draggingRect = this.getDraggingElementsRect(selectedIds)
		if (!draggingRect) return

		const options =
			this.activeAnchor && this.canvas.transformManager.shouldKeepRatio(selectedIds)
				? {
						keepRatio: true,
						aspectRatio:
							this.canvas.transformManager.getInitialAspectRatio() ??
							(draggingRect.height !== 0
								? draggingRect.width / draggingRect.height
								: 1),
					}
				: undefined

		const result = this.snapResolver.resolveInContentSpace({
			draggingRect,
			targets,
			activeAnchor: this.activeAnchor,
			options,
		})

		const snappedAlignments = result?.snappedAlignments ?? []

		// 应用吸附：多选 anchor 由 boundBoxFunc 处理，此处只处理单选/拖拽
		const isAnchorMultiSelect = this.activeAnchor && selectedIds.length > 1
		if (
			result &&
			!isAnchorMultiSelect &&
			(result.snapOffsetX !== 0 || result.snapOffsetY !== 0)
		) {
			this.applySnapOffset(selectedIds, result.snapOffsetX, result.snapOffsetY)
		}

		// 视觉：委托渲染器
		const currentKey = this.getSnappedAlignmentsKey(snappedAlignments)
		const getSnappedRect = () => this.getSnappedElementsRect()
		if (currentKey !== this.lastSnappedAlignmentsKey) {
			this.guideRenderer.clear()
			this.guideRenderer.render(snappedAlignments, getSnappedRect)
			this.lastSnappedAlignmentsKey = currentKey
		} else if (snappedAlignments.length > 0) {
			this.guideRenderer.update(snappedAlignments, getSnappedRect)
		}

		this.guideRenderer.batchDraw()
	}

	/** @implements SnapResolverContext - 供 SnapResolver 调用 */
	getAlignmentTargets(draggingElementIds: string[]): LayerElement[] {
		const targets: LayerElement[] = []
		const excludeSet = new Set(draggingElementIds)

		// 获取第一个拖拽元素（假设多选时都在同一层级）
		const firstElementId = draggingElementIds[0]
		if (!firstElementId) return targets

		// 查找父元素和同级元素
		const { parentElement, siblings } = this.findParentAndSiblings(firstElementId)

		// 1. 添加同级元素（排除正在拖拽的元素）
		for (const sibling of siblings) {
			if (!excludeSet.has(sibling.id) && this.canvas.permissionManager.canSnap(sibling)) {
				targets.push(sibling)
			}
		}

		// 2. 如果有父 Frame，添加父 Frame（用于边界对齐）
		if (parentElement && parentElement.type === "frame") {
			if (this.canvas.permissionManager.canSnap(parentElement)) {
				targets.push(parentElement)
			}
		}

		return targets
	}

	/**
	 * 查找元素的父元素和同级元素
	 */
	private findParentAndSiblings(elementId: string): {
		parentElement: LayerElement | null
		siblings: LayerElement[]
	} {
		const allElements = this.canvas.elementManager.getAllElements()

		// 递归查找函数
		const findInTree = (
			nodes: LayerElement[],
			targetId: string,
			parent: LayerElement | null = null,
		): { parentElement: LayerElement | null; siblings: LayerElement[] } | null => {
			// 检查当前层级
			const index = nodes.findIndex((node) => node.id === targetId)
			if (index !== -1) {
				return { parentElement: parent, siblings: nodes }
			}

			// 递归检查子节点
			for (const node of nodes) {
				if ("children" in node && node.children && Array.isArray(node.children)) {
					const result = findInTree(node.children, targetId, node)
					if (result) return result
				}
			}

			return null
		}

		const result = findInTree(allElements, elementId)
		return result || { parentElement: null, siblings: [] }
	}

	/** @implements SnapResolverContext */
	calculateElementsRect(elementIds: string[]): Rect | null {
		const adapter = this.canvas.elementManager.getNodeAdapter()
		const nodes = adapter.getNodesForTransform(elementIds)

		if (nodes.length === 0) return null

		let minX = Infinity
		let minY = Infinity
		let maxX = -Infinity
		let maxY = -Infinity

		for (const node of nodes) {
			const clientRect = node.getClientRect({
				relativeTo: this.canvas.contentLayer,
			})

			minX = Math.min(minX, clientRect.x)
			minY = Math.min(minY, clientRect.y)
			maxX = Math.max(maxX, clientRect.x + clientRect.width)
			maxY = Math.max(maxY, clientRect.y + clientRect.height)
		}

		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
		}
	}

	/**
	 * 获取拖拽元素的边界矩形
	 */
	private getDraggingElementsRect(elementIds: string[]): Rect | null {
		return this.calculateElementsRect(elementIds)
	}

	/** @implements SnapResolverContext */
	findAlignments(
		draggingRect: Rect,
		otherElements: LayerElement[],
		overrideAnchor?: string | null,
	): AlignmentInfo[] {
		const alignments: AlignmentInfo[] = []
		const guideThreshold = this.cachedGuideThreshold
		// 使用缓存的吸附阈值
		const snapThreshold = this.cachedSnapThreshold

		// 计算拖拽元素的关键位置
		const dragLeft = draggingRect.x
		const dragRight = draggingRect.x + draggingRect.width
		const dragCenterX = draggingRect.x + draggingRect.width / 2
		const dragTop = draggingRect.y
		const dragBottom = draggingRect.y + draggingRect.height
		const dragMiddleY = draggingRect.y + draggingRect.height / 2

		// 根据 activeAnchor 确定允许吸附的边
		const allowedAlignments = this.getAllowedAlignments(overrideAnchor)

		// 获取 NodeAdapter 用于获取节点的绝对位置
		const adapter = this.canvas.elementManager.getNodeAdapter()

		// 遍历其他元素，查找对齐关系
		for (const element of otherElements) {
			// 通过节点获取在 layer 坐标系中的绝对位置
			// 这样可以正确处理 Frame 子元素的相对坐标
			const node = adapter.getNodeForParenting(element.id)
			if (!node) continue

			const clientRect = node.getClientRect({
				relativeTo: this.canvas.contentLayer,
			})

			// 确保尺寸有效
			if (clientRect.width <= 0 || clientRect.height <= 0) {
				continue
			}

			const targetRect: Rect = {
				x: clientRect.x,
				y: clientRect.y,
				width: clientRect.width,
				height: clientRect.height,
			}

			const targetLeft = targetRect.x
			const targetRight = targetRect.x + targetRect.width
			const targetCenterX = targetRect.x + targetRect.width / 2
			const targetTop = targetRect.y
			const targetBottom = targetRect.y + targetRect.height
			const targetMiddleY = targetRect.y + targetRect.height / 2

			// 检查水平对齐（左、中、右） - 只检查允许的对齐方式
			if (allowedAlignments.has("left") && Math.abs(dragLeft - targetLeft) < guideThreshold) {
				alignments.push({
					type: "left",
					position: targetLeft,
					targetElementId: element.id,
					dragPoints: this.getAlignmentPoints("left", draggingRect),
					targetPoints: this.getAlignmentPoints("left", targetRect),
				})
			}
			if (
				allowedAlignments.has("center") &&
				Math.abs(dragCenterX - targetCenterX) < guideThreshold
			) {
				alignments.push({
					type: "center",
					position: targetCenterX,
					targetElementId: element.id,
					dragPoints: this.getAlignmentPoints("center", draggingRect),
					targetPoints: this.getAlignmentPoints("center", targetRect),
				})
			}
			if (
				allowedAlignments.has("right") &&
				Math.abs(dragRight - targetRight) < guideThreshold
			) {
				alignments.push({
					type: "right",
					position: targetRight,
					targetElementId: element.id,
					dragPoints: this.getAlignmentPoints("right", draggingRect),
					targetPoints: this.getAlignmentPoints("right", targetRect),
				})
			}

			// 检查垂直对齐（上、中、下） - 只检查允许的对齐方式
			if (allowedAlignments.has("top") && Math.abs(dragTop - targetTop) < guideThreshold) {
				alignments.push({
					type: "top",
					position: targetTop,
					targetElementId: element.id,
					dragPoints: this.getAlignmentPoints("top", draggingRect),
					targetPoints: this.getAlignmentPoints("top", targetRect),
				})
			}
			if (
				allowedAlignments.has("middle") &&
				Math.abs(dragMiddleY - targetMiddleY) < guideThreshold
			) {
				alignments.push({
					type: "middle",
					position: targetMiddleY,
					targetElementId: element.id,
					dragPoints: this.getAlignmentPoints("middle", draggingRect),
					targetPoints: this.getAlignmentPoints("middle", targetRect),
				})
			}
			if (
				allowedAlignments.has("bottom") &&
				Math.abs(dragBottom - targetBottom) < guideThreshold
			) {
				alignments.push({
					type: "bottom",
					position: targetBottom,
					targetElementId: element.id,
					dragPoints: this.getAlignmentPoints("bottom", draggingRect),
					targetPoints: this.getAlignmentPoints("bottom", targetRect),
				})
			}

			// ==================== 边缘吸附 ====================
			// 检查拖拽元素的边缘是否接近目标元素的边缘
			// 注意：边缘吸附使用 snapThreshold，确保只在真正接近时才吸附

			// 水平边缘吸附：拖拽元素的左边 -> 目标元素的右边
			if (allowedAlignments.has("left") && Math.abs(dragLeft - targetRight) < snapThreshold) {
				alignments.push({
					type: "left",
					position: targetRight,
					targetElementId: element.id,
					dragPoints: this.getAlignmentPoints("left", draggingRect),
					targetPoints: this.getAlignmentPoints("right", targetRect),
				})
			}

			// 水平边缘吸附：拖拽元素的右边 -> 目标元素的左边
			if (
				allowedAlignments.has("right") &&
				Math.abs(dragRight - targetLeft) < snapThreshold
			) {
				alignments.push({
					type: "right",
					position: targetLeft,
					targetElementId: element.id,
					dragPoints: this.getAlignmentPoints("right", draggingRect),
					targetPoints: this.getAlignmentPoints("left", targetRect),
				})
			}

			// 垂直边缘吸附：拖拽元素的上边 -> 目标元素的下边
			if (allowedAlignments.has("top") && Math.abs(dragTop - targetBottom) < snapThreshold) {
				alignments.push({
					type: "top",
					position: targetBottom,
					targetElementId: element.id,
					dragPoints: this.getAlignmentPoints("top", draggingRect),
					targetPoints: this.getAlignmentPoints("bottom", targetRect),
				})
			}

			// 垂直边缘吸附：拖拽元素的下边 -> 目标元素的上边
			if (
				allowedAlignments.has("bottom") &&
				Math.abs(dragBottom - targetTop) < snapThreshold
			) {
				alignments.push({
					type: "bottom",
					position: targetTop,
					targetElementId: element.id,
					dragPoints: this.getAlignmentPoints("bottom", draggingRect),
					targetPoints: this.getAlignmentPoints("top", targetRect),
				})
			}
		}

		return alignments
	}

	/** @implements SnapResolverContext */
	getAllowedAlignments(overrideAnchor?: string | null): Set<AlignmentType> {
		const anchor = overrideAnchor ?? this.activeAnchor
		// 如果没有激活的 anchor，说明是纯拖拽，允许所有对齐
		if (!anchor) {
			return new Set(["left", "center", "right", "top", "middle", "bottom"])
		}

		// 通过 TransformManager 检查是否按下了 Shift 或 Meta/Command 键
		// 这里传入空数组，只检查键盘状态，不检查元素配置
		const isKeepRatioKeyPressed = this.canvas.transformManager.shouldKeepRatio([])

		// 根据 anchor 位置确定允许的对齐方式
		const allowed = new Set<AlignmentType>()

		switch (anchor) {
			case "top-left":
				allowed.add("left")
				allowed.add("top")
				break
			case "top-center":
				// 不按 Shift/Meta：只吸附上边
				// 按住 Shift/Meta：吸附左上角（left + top）
				allowed.add("top")
				if (isKeepRatioKeyPressed) {
					allowed.add("left")
				}
				break
			case "top-right":
				allowed.add("right")
				allowed.add("top")
				break
			case "middle-left":
				// 不按 Shift/Meta：只吸附左边
				// 按住 Shift/Meta：吸附左上角（left + top）
				allowed.add("left")
				if (isKeepRatioKeyPressed) {
					allowed.add("top")
				}
				break
			case "middle-right":
				// 不按 Shift/Meta：只吸附右边
				// 按住 Shift/Meta：吸附右下角（right + bottom）
				allowed.add("right")
				if (isKeepRatioKeyPressed) {
					allowed.add("bottom")
				}
				break
			case "bottom-left":
				allowed.add("left")
				allowed.add("bottom")
				break
			case "bottom-center":
				// 不按 Shift/Meta：只吸附下边
				// 按住 Shift/Meta：吸附右下角（right + bottom）
				allowed.add("bottom")
				if (isKeepRatioKeyPressed) {
					allowed.add("right")
				}
				break
			case "bottom-right":
				allowed.add("right")
				allowed.add("bottom")
				break
		}

		return allowed
	}

	/**
	 * 获取吸附后选中元素的边界（applySnapOffset 之后调用）
	 */
	private getSnappedElementsRect(): Rect | null {
		const selectedIds = this.canvas.selectionManager.getSelectedIds()
		return this.calculateElementsRect(selectedIds)
	}

	/** @implements SnapResolverContext */
	calculateSnapResult(
		alignments: AlignmentInfo[],
		draggingRect: Rect,
	): {
		snappedAlignments: AlignmentInfo[]
		snapOffsetX: number
		snapOffsetY: number
	} {
		if (alignments.length === 0) {
			return { snappedAlignments: [], snapOffsetX: 0, snapOffsetY: 0 }
		}

		// 使用缓存的吸附阈值
		const snapThreshold = this.cachedSnapThreshold

		const dragLeft = draggingRect.x
		const dragCenterX = draggingRect.x + draggingRect.width / 2
		const dragRight = draggingRect.x + draggingRect.width
		const dragTop = draggingRect.y
		const dragMiddleY = draggingRect.y + draggingRect.height / 2
		const dragBottom = draggingRect.y + draggingRect.height

		// 选择距离最近的水平对齐（左/中/右）
		let minXOffset = Infinity
		let bestXAlignment: AlignmentInfo | null = null

		for (const alignment of alignments) {
			if (!["left", "center", "right"].includes(alignment.type)) continue

			let offset = 0
			if (alignment.type === "left") {
				offset = alignment.position - dragLeft
			} else if (alignment.type === "center") {
				offset = alignment.position - dragCenterX
			} else if (alignment.type === "right") {
				offset = alignment.position - dragRight
			}

			// 只考虑在吸附阈值内的对齐
			if (Math.abs(offset) <= snapThreshold && Math.abs(offset) < Math.abs(minXOffset)) {
				minXOffset = offset
				bestXAlignment = alignment
			}
		}

		// 选择距离最近的垂直对齐（上/中/下）
		let minYOffset = Infinity
		let bestYAlignment: AlignmentInfo | null = null

		for (const alignment of alignments) {
			if (!["top", "middle", "bottom"].includes(alignment.type)) continue

			let offset = 0
			if (alignment.type === "top") {
				offset = alignment.position - dragTop
			} else if (alignment.type === "middle") {
				offset = alignment.position - dragMiddleY
			} else if (alignment.type === "bottom") {
				offset = alignment.position - dragBottom
			}

			// 只考虑在吸附阈值内的对齐
			if (Math.abs(offset) <= snapThreshold && Math.abs(offset) < Math.abs(minYOffset)) {
				minYOffset = offset
				bestYAlignment = alignment
			}
		}

		// 返回真正会吸附的对齐关系和偏移量
		const snappedAlignments: AlignmentInfo[] = []
		if (bestXAlignment) snappedAlignments.push(bestXAlignment)
		if (bestYAlignment) snappedAlignments.push(bestYAlignment)

		return {
			snappedAlignments,
			snapOffsetX: bestXAlignment ? minXOffset : 0,
			snapOffsetY: bestYAlignment ? minYOffset : 0,
		}
	}

	/**
	 * 多选 anchor 场景：返回 Konva boundBoxFunc 所需的吸附后 box
	 * 委托给 SnapResolver，内部完成 content ↔ konva 坐标转换
	 */
	public getSnappedBox(
		oldBox: Box,
		newBox: Box,
		activeAnchor: string | null,
		options?: { keepRatio: boolean; aspectRatio: number },
	): Box {
		if (!this.enabled || !activeAnchor) return newBox

		const selectedIds = this.canvas.selectionManager.getSelectedIds()
		return this.snapResolver.getSnappedBox(oldBox, newBox, activeAnchor, selectedIds, options)
	}

	/**
	 * 根据对齐类型计算标记点位置
	 */
	private getAlignmentPoints(type: AlignmentType, rect: Rect): Array<{ x: number; y: number }> {
		switch (type) {
			case "left":
				return [
					{ x: rect.x, y: rect.y }, // 左上角
					{ x: rect.x, y: rect.y + rect.height }, // 左下角
				]
			case "right":
				return [
					{ x: rect.x + rect.width, y: rect.y }, // 右上角
					{ x: rect.x + rect.width, y: rect.y + rect.height }, // 右下角
				]
			case "top":
				return [
					{ x: rect.x, y: rect.y }, // 左上角
					{ x: rect.x + rect.width, y: rect.y }, // 右上角
				]
			case "bottom":
				return [
					{ x: rect.x, y: rect.y + rect.height }, // 左下角
					{ x: rect.x + rect.width, y: rect.y + rect.height }, // 右下角
				]
			case "center":
			case "middle":
				return [
					{
						x: rect.x + rect.width / 2,
						y: rect.y + rect.height / 2,
					}, // 中心点
				]
		}
	}

	/**
	 * 应用吸附偏移到选中的元素
	 * 如果是缩放操作，调整尺寸而非位置
	 */
	private applySnapOffset(selectedIds: string[], snapOffsetX: number, snapOffsetY: number): void {
		// 获取选中的元素节点
		const adapter = this.canvas.elementManager.getNodeAdapter()
		const nodes = adapter.getNodesForTransform(selectedIds)

		if (nodes.length === 0) return

		// 临时标记正在吸附，避免触发过多的位置更新事件
		this.canvas.eventEmitter.emit({ type: "snap:start", data: undefined })

		// 如果有激活的 anchor，说明是缩放操作
		if (this.activeAnchor) {
			this.applySnapForScaling(nodes, snapOffsetX, snapOffsetY)
		} else {
			// 纯拖拽操作，直接调整位置
			for (const node of nodes) {
				const elementId = node.id()
				const currentX = node.x()
				const currentY = node.y()
				const updates = {
					x: currentX + snapOffsetX,
					y: currentY + snapOffsetY,
				}

				// 使用 ElementManager 的 update 接口（mode: 'node-only'）
				this.canvas.elementManager.update(elementId, updates, {
					mode: "node-only",
					forceRerender: false,
				})
			}
		}

		this.canvas.overlayLayer.batchDraw()

		// 吸附完成后再触发位置更新
		this.canvas.eventEmitter.emit({ type: "snap:end", data: undefined })
	}

	/**
	 * 处理缩放时的吸附
	 * 通过调整尺寸来实现吸附，保持对角点不变
	 */
	private applySnapForScaling(
		nodes: Konva.Node[],
		snapOffsetX: number,
		snapOffsetY: number,
	): void {
		if (!this.activeAnchor) return

		for (const node of nodes) {
			if (!(node instanceof Konva.Group)) continue

			const elementId = node.id()
			const element = this.canvas.elementManager.getElementInstance(elementId)
			// 使用 TransformManager 的统一方法判断是否保持比例
			const keepRatio = this.canvas.transformManager.shouldKeepRatioForElement(element)

			const currentX = node.x()
			const currentY = node.y()
			const currentWidth = node.width()
			const currentHeight = node.height()
			const aspectRatio = currentWidth / currentHeight

			let newX = currentX
			let newY = currentY
			let newWidth = currentWidth
			let newHeight = currentHeight

			const targetRect: Rect = {
				x: currentX,
				y: currentY,
				width: currentWidth,
				height: currentHeight,
			}
			switch (this.activeAnchor) {
				case "top-left":
					newX = currentX + snapOffsetX
					newY = currentY + snapOffsetY
					newWidth = currentWidth - snapOffsetX
					newHeight = currentHeight - snapOffsetY
					break
				case "top-center":
					if (snapOffsetX !== 0) {
						newX = currentX + snapOffsetX
						newWidth = currentWidth - snapOffsetX
					}
					newY = currentY + snapOffsetY
					newHeight = currentHeight - snapOffsetY
					break
				case "top-right":
					newY = currentY + snapOffsetY
					newWidth = currentWidth + snapOffsetX
					newHeight = currentHeight - snapOffsetY
					break
				case "middle-left":
					newX = currentX + snapOffsetX
					newWidth = currentWidth - snapOffsetX
					if (snapOffsetY !== 0) {
						newY = currentY + snapOffsetY
						newHeight = currentHeight - snapOffsetY
					}
					break
				case "middle-right":
					newWidth = currentWidth + snapOffsetX
					if (snapOffsetY !== 0) {
						newHeight = currentHeight + snapOffsetY
					}
					break
				case "bottom-left":
					newX = currentX + snapOffsetX
					newWidth = currentWidth - snapOffsetX
					newHeight = currentHeight + snapOffsetY
					break
				case "bottom-center":
					newHeight = currentHeight + snapOffsetY
					if (snapOffsetX !== 0) {
						newWidth = currentWidth + snapOffsetX
					}
					break
				case "bottom-right":
					newWidth = currentWidth + snapOffsetX
					newHeight = currentHeight + snapOffsetY
					break
			}

			if (keepRatio) {
				const snappedRect: Rect = { x: newX, y: newY, width: newWidth, height: newHeight }
				const constrained = constrainRectToAspectRatio(
					snappedRect,
					targetRect,
					this.activeAnchor,
					aspectRatio,
				)
				newX = constrained.x
				newY = constrained.y
				newWidth = constrained.width
				newHeight = constrained.height
			}

			// 确保尺寸不为负数
			if (newWidth < 1) newWidth = 1
			if (newHeight < 1) newHeight = 1

			// 规范化尺寸（如果保持宽高比，确保规范化后仍然保持比例）
			const normalizedSize = normalizeSize(newWidth, newHeight, {
				precision: "integer",
				keepAspectRatio: keepRatio,
				aspectRatio: keepRatio ? aspectRatio : undefined,
			})
			const finalWidth = normalizedSize.width
			const finalHeight = normalizedSize.height

			// 如果规范化后尺寸发生变化，需要重新调整位置以保持固定点不变
			// 这里简化处理：如果保持宽高比且尺寸变化，可能需要微调位置
			// 但为了保持代码简洁，我们直接使用规范化后的尺寸
			// 因为规范化通常只会产生很小的变化

			// 应用新的位置和尺寸
			// 使用 ElementManager 的 updateNode 接口，避免直接操作 node
			if (element) {
				const updates = {
					x: newX,
					y: newY,
					width: finalWidth,
					height: finalHeight,
				}

				// 更新 node（视图层，使用 mode: 'node-only'）
				this.canvas.elementManager.update(elementId, updates, {
					mode: "node-only",
					forceRerender: false,
				})

				// 同步更新 data（数据层，使用 mode: 'data-only'）
				this.canvas.elementManager.update(elementId, updates, {
					mode: "data-only",
					silent: true,
				})

				// 调用元素的 resize 钩子（用于更新内部节点）
				element.onTransformResize?.(finalWidth, finalHeight)
			}
		}
	}

	/**
	 * 启用吸附
	 */
	public enable(): void {
		this.enabled = true
	}

	/**
	 * 禁用吸附
	 */
	public disable(): void {
		this.enabled = false
		this.guideRenderer.clear()
	}

	/**
	 * 检查是否启用
	 */
	public isEnabled(): boolean {
		return this.enabled
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		this.guideRenderer.clear()
		this.canvas.overlayLayer.destroy()
		this.canvas.eventEmitter.off("elements:transform:dragstart")
		this.canvas.eventEmitter.off("elements:transform:dragmove")
		this.canvas.eventEmitter.off("elements:transform:dragend")
		this.canvas.eventEmitter.off("elements:transform:anchorDragStart")
		this.canvas.eventEmitter.off("elements:transform:anchorDragmove")
		this.canvas.eventEmitter.off("elements:transform:anchorDragend")
	}
}
