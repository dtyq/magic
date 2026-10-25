import Konva from "konva"
import type { Canvas } from "../../core/Canvas"
import type { LayerElement, FrameElement } from "../../document/types"
import { ElementTypeEnum } from "../../document/types"
import { generateElementId, calculateElementsRect } from "../../shared/ids"
import { FrameElement as FrameElementClass } from "../../elements/frame/FrameElement"
import { createContentFrameData, resolveFrameContentLayout } from "./frameCreation"

/**
 * 画框管理器
 * 职责：
 * 1. 创建画框（将选中的元素组合成画框）
 * 2. 解除画框（将画框内的元素释放出来）
 */
export class FrameManager {
	private canvas: Canvas
	private dragSession: {
		elementIds: string[]
		sourceParentId: string | null
		targetParentId: string | null
	} | null = null
	private dragIndicator: Konva.Rect | null = null
	private readonly dragEventUnsubscribers: Array<() => void> = []
	private readonly DRAG_EXIT_PADDING_PX = 8

	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas
		this.dragEventUnsubscribers.push(
			this.canvas.eventEmitter.on("elements:transform:dragstart", ({ data }) => {
				this.handleFrameDropDragStart(data.elementIds)
			}),
			this.canvas.eventEmitter.on("elements:transform:dragmove", () => {
				this.handleFrameDropDragMove()
			}),
			this.canvas.eventEmitter.on("elements:transform:dragend", () => {
				this.handleFrameDropDragEnd()
			}),
			this.canvas.eventEmitter.on("permission:changed", () => {
				if (!this.canvas.permissionManager.can("document.write")) this.cancelFrameDropDrag()
			}),
		)
	}

	/**
	 * 返回画框换父级拖拽期间的临时目标父级。
	 *
	 * 拖拽节点会先临时提升到 contentLayer，文档树要等 dragend 才提交；连线渲染
	 * 需要这个过渡状态来判断当前应该使用画框内副本、全局副本，还是两者同时使用。
	 * 返回 undefined 表示元素不在这次换父级拖拽中，null 表示临时目标是根级。
	 */
	public getDragTargetParentId(elementId: string): string | null | undefined {
		if (!this.dragSession?.elementIds.includes(elementId)) return undefined
		return this.dragSession.targetParentId
	}

	private handleFrameDropDragStart(elementIds: string[]): void {
		this.cancelFrameDropDrag()
		const uniqueElementIds = Array.from(new Set(elementIds))
		if (uniqueElementIds.length === 0) return

		const candidates = uniqueElementIds.map((elementId) => {
			const element = this.canvas.elementManager.getElementData(elementId)
			if (
				!element ||
				element.type === ElementTypeEnum.Frame ||
				element.type === ElementTypeEnum.Group ||
				this.canvas.elementManager.isTemporary(elementId)
			) {
				return null
			}

			const sourceParentId =
				this.canvas.elementManager.findParentIdForElement(elementId) ?? null
			const sourceParent = sourceParentId
				? this.canvas.elementManager.getElementData(sourceParentId)
				: undefined
			if (sourceParentId && sourceParent?.type !== ElementTypeEnum.Frame) return null
			if (
				!this.canvas.permissionManager.canReparentElement(element, sourceParent, undefined)
			) {
				return null
			}

			const node = this.canvas.elementManager.getNodeAdapter().getNodeForParenting(elementId)
			if (!node) return null
			return {
				elementId,
				sourceParentId,
				node,
				visualZIndex:
					element.zIndex ??
					(typeof node.getAbsoluteZIndex === "function" ? node.getAbsoluteZIndex() : 0),
				positionInContent: this.getPositionInContent(node),
			}
		})
		if (candidates.some((candidate) => candidate === null)) return

		const validCandidates = candidates as Array<NonNullable<(typeof candidates)[number]>>
		const sourceParentId = validCandidates[0]?.sourceParentId ?? null
		// 多选换父级以一个共同父级为事务边界。混合根级和画框子元素时继续普通拖动，
		// 不猜测多个源画框各自对应的根级插入锚点。
		if (validCandidates.some((candidate) => candidate.sourceParentId !== sourceParentId)) return
		validCandidates.sort((left, right) => left.visualZIndex - right.visualZIndex)

		// 拖拽期间统一将节点临时提升到 content layer 顶部：
		// 画框子元素需要脱离原 Group 的 clip，根级元素则需要避免被更高层级的画框背景盖住。
		// 按原视觉层级从低到高移动，保证多选元素之间的前后顺序不变。
		validCandidates.forEach((candidate) => {
			candidate.node.moveTo(this.canvas.contentLayer)
			candidate.node.moveToTop()
			candidate.node.position(candidate.positionInContent)
		})
		this.canvas.transformManager.rebaseActiveDragNodePositions(
			validCandidates.map((candidate) => candidate.elementId),
		)

		this.dragSession = {
			elementIds: validCandidates.map((candidate) => candidate.elementId),
			sourceParentId,
			targetParentId: sourceParentId,
		}
	}

	private handleFrameDropDragMove(): void {
		const session = this.dragSession
		if (!session) return
		const stagePoint = this.canvas.stage.getPointerPosition()
		if (!stagePoint) return

		const contentPoint = this.getContentPoint(stagePoint)
		const nextTargetParentId = this.resolveDropTarget(contentPoint, session)
		if (nextTargetParentId === session.targetParentId) return

		session.targetParentId = nextTargetParentId
		this.updateDragIndicator(nextTargetParentId, session.sourceParentId)
	}

	private handleFrameDropDragEnd(): void {
		const session = this.dragSession
		if (!session) return

		// 根级元素只是拖拽期间临时提升到 content layer，文档父级并未变化。
		// 跳过无效的批量 reparent，避免为每个选中元素重复更新数据并派发事件。
		// 画框子元素即使目标父级仍是原画框，也必须走 reparentElements 恢复局部节点层级。
		if (session.sourceParentId === null && session.targetParentId === null) {
			this.canvas.elementManager.reorderTopLevelElementsPublic()
			this.canvas.runtimeScheduler.requestLayerDraw("content", {
				source: "FrameManager",
				reason: "restore-top-level-drag-order",
				priority: "input",
			})
			this.clearFrameDropState()
			return
		}

		const elements = this.getSessionElementsInContent(session.elementIds)
		if (elements.length === session.elementIds.length) {
			const committed = this.canvas.elementManager.reparentElements({
				targetParentId: session.targetParentId,
				elements,
			})
			// 拖拽期间目标可能被锁定或删除；提交失败时必须整体恢复原层级，
			// 否则会出现部分节点停在 content layer、文档树仍指向旧画框的状态。
			if (!committed) {
				this.canvas.elementManager.reparentElements({
					targetParentId: session.sourceParentId,
					elements,
					silent: true,
				})
			}
		} else if (elements.length > 0) {
			// 某个元素在拖拽期间被删除时，不提交剩余元素，但仍尽量把存活节点恢复原父级。
			this.canvas.elementManager.reparentElements({
				targetParentId: session.sourceParentId,
				elements,
				silent: true,
			})
		}

		this.clearFrameDropState()
	}

	private cancelFrameDropDrag(): void {
		if (!this.dragSession) {
			this.clearDragIndicator()
			return
		}

		// 取消场景优先恢复到原父级，避免节点停留在 content layer 但文档树仍指向旧父级。
		const elements = this.getSessionElementsInContent(this.dragSession.elementIds)
		if (elements.length > 0) {
			this.canvas.elementManager.reparentElements({
				targetParentId: this.dragSession.sourceParentId,
				elements,
				silent: true,
			})
		}
		this.clearFrameDropState()
	}

	private clearFrameDropState(): void {
		this.dragSession = null
		this.clearDragIndicator()
	}

	private getPositionInContent(node: Konva.Node): { x: number; y: number } {
		const absoluteOrigin = node.getAbsoluteTransform().point({ x: 0, y: 0 })
		return this.getContentPoint(absoluteOrigin)
	}

	private getSessionElementsInContent(elementIds: readonly string[]): Array<{
		elementId: string
		positionInContent: { x: number; y: number }
	}> {
		return elementIds.flatMap((elementId) => {
			const node = this.canvas.elementManager.getNodeAdapter().getNodeForParenting(elementId)
			return node ? [{ elementId, positionInContent: this.getPositionInContent(node) }] : []
		})
	}

	private getContentPoint(stagePoint: { x: number; y: number }): { x: number; y: number } {
		return this.canvas.contentLayer.getAbsoluteTransform().copy().invert().point(stagePoint)
	}

	private resolveDropTarget(
		point: { x: number; y: number },
		session: NonNullable<FrameManager["dragSession"]>,
	): string | null {
		const scale = Math.max(0.001, this.canvas.stage.scaleX())
		const draggedElements = session.elementIds
			.map((elementId) => this.canvas.elementManager.getElementData(elementId))
			.filter((element): element is LayerElement => Boolean(element))
		const sourceParent = session.sourceParentId
			? this.canvas.elementManager.getElementData(session.sourceParentId)
			: undefined
		if (draggedElements.length !== session.elementIds.length) return null

		const candidates = this.canvas.elementManager
			.getAllElementIds()
			.map((id) => {
				const element = this.canvas.elementManager.getElementData(id)
				if (!element || element.type !== ElementTypeEnum.Frame) return null
				if (!this.canvas.elementManager.isElementVisibleInDataTree(id)) return null
				if (
					!draggedElements.every((draggedElement) =>
						this.canvas.permissionManager.canReparentElement(
							draggedElement,
							sourceParent,
							element,
						),
					)
				) {
					return null
				}
				const bounds = this.canvas.geometryCacheManager.getElementBounds(id)
				const node = this.canvas.elementManager.getNodeAdapter().getNodeForParenting(id)
				if (!bounds || !node || !this.containsPoint(bounds, point)) return null
				return {
					id,
					bounds,
					zIndex:
						typeof node.getAbsoluteZIndex === "function"
							? node.getAbsoluteZIndex()
							: (element.zIndex ?? 0),
				}
			})
			.filter(
				(
					candidate,
				): candidate is {
					id: string
					bounds: { x: number; y: number; width: number; height: number }
					zIndex: number
				} => candidate !== null,
			)

		candidates.sort((left, right) => right.zIndex - left.zIndex)
		const topCandidate = candidates[0]
		if (topCandidate) return topCandidate.id

		// 只在指针已离开所有画框时保留当前目标的退出迟滞；
		// 若指针进入另一个更高画框，顶层命中应立即接管。
		if (session.targetParentId) {
			const activeTarget = this.canvas.elementManager.getElementData(session.targetParentId)
			const activeBounds = this.canvas.geometryCacheManager.getElementBounds(
				session.targetParentId,
			)
			if (
				activeTarget?.type === ElementTypeEnum.Frame &&
				this.canvas.elementManager.isElementVisibleInDataTree(session.targetParentId) &&
				draggedElements.every((draggedElement) =>
					this.canvas.permissionManager.canReparentElement(
						draggedElement,
						sourceParent,
						activeTarget,
					),
				) &&
				activeBounds &&
				this.containsPoint(
					this.expandRect(activeBounds, this.DRAG_EXIT_PADDING_PX / scale),
					point,
				)
			) {
				return session.targetParentId
			}
		}
		return null
	}

	private updateDragIndicator(
		targetParentId: string | null,
		sourceParentId: string | null,
	): void {
		if (!targetParentId || targetParentId === sourceParentId) {
			this.clearDragIndicator()
			return
		}
		const bounds = this.canvas.geometryCacheManager.getElementBounds(targetParentId)
		if (!bounds) {
			this.clearDragIndicator()
			return
		}

		if (!this.dragIndicator) {
			this.dragIndicator = new Konva.Rect({
				name: "frame-drop-indicator",
				listening: false,
				stroke: "#3B82F6",
				fill: "rgba(59, 130, 246, 0.08)",
				dash: [6, 4],
			})
			this.canvas.overlayLayer.add(this.dragIndicator)
		}

		const scale = Math.max(0.001, this.canvas.stage.scaleX())
		this.dragIndicator.setAttrs({
			x: bounds.x,
			y: bounds.y,
			width: bounds.width,
			height: bounds.height,
			strokeWidth: 2 / scale,
		})
		this.dragIndicator.moveToTop()
		this.canvas.runtimeScheduler.requestLayerDraw("overlay", {
			source: "FrameManager",
			reason: "frame-drop-indicator",
			priority: "input",
		})
	}

	private clearDragIndicator(requestDraw: boolean = true): void {
		if (!this.dragIndicator) return
		this.dragIndicator.destroy()
		this.dragIndicator = null
		if (!requestDraw) return
		this.canvas.runtimeScheduler.requestLayerDraw("overlay", {
			source: "FrameManager",
			reason: "clear-frame-drop-indicator",
			priority: "input",
		})
	}

	private containsPoint(
		bounds: { x: number; y: number; width: number; height: number },
		point: { x: number; y: number },
	): boolean {
		return (
			point.x >= bounds.x &&
			point.x <= bounds.x + bounds.width &&
			point.y >= bounds.y &&
			point.y <= bounds.y + bounds.height
		)
	}

	private expandRect(
		bounds: { x: number; y: number; width: number; height: number },
		padding: number,
	): { x: number; y: number; width: number; height: number } {
		return {
			x: bounds.x - padding,
			y: bounds.y - padding,
			width: bounds.width + padding * 2,
			height: bounds.height + padding * 2,
		}
	}

	/**
	 * 创建画框
	 * 将选中的元素组合成一个画框
	 * @param boundsExpansion - 显式覆盖默认边距；省略时边距为内容短边的 8%
	 * @returns 创建的画框 ID，如果创建失败返回 null
	 */
	public createFrame(boundsExpansion?: number): string | null {
		const selectedIds = this.canvas.selectionManager.getSelectedIds()
		if (selectedIds.length === 0) {
			return null
		}

		// 容器不能参与新 Frame 创建；先在权限过滤前检查原始选区，避免把一个
		// 锁定的 Frame/Group 过滤掉后，误把剩余普通节点单独包进新容器。
		const selectedElements = selectedIds
			.map((id) => this.canvas.elementManager.getElementData(id))
			.filter((el): el is LayerElement => Boolean(el))

		if (
			selectedElements.some(
				(el) => el.type === ElementTypeEnum.Frame || el.type === ElementTypeEnum.Group,
			)
		) {
			return null
		}

		// Keep the no-nesting invariant at the manager boundary as well as in the
		// action catalog. A direct API caller must not be able to move an existing
		// Frame/Group child into a newly created Frame and leave the old parent stale.
		const findParentId = this.canvas.elementManager.findParentIdForElement
		if (
			typeof findParentId === "function" &&
			selectedElements.some((element) =>
				findParentId.call(this.canvas.elementManager, element.id),
			)
		) {
			return null
		}

		// 获取选中的元素数据，过滤掉锁定或无写权限的元素。
		const permittedElements = selectedElements.filter((element) =>
			this.canvas.permissionManager.canAddToFrame(element),
		)

		if (permittedElements.length === 0) {
			return null
		}

		// 计算选中元素的总体边界
		const rect = calculateElementsRect(permittedElements)
		if (!rect) {
			return null
		}

		const layout = resolveFrameContentLayout(rect, { padding: boundsExpansion })
		const frameX = rect.x - layout.padding
		const frameY = rect.y - layout.padding

		// 获取选中元素的最大 zIndex，Frame 将使用这个位置
		const maxSelectedZIndex = Math.max(...permittedElements.map((el) => el.zIndex ?? 0))

		// 创建新的 Frame 元素数据
		const frameId = generateElementId()
		const { frameData } = createContentFrameData({
			id: frameId,
			x: frameX,
			y: frameY,
			width: rect.width,
			height: rect.height,
			zIndex: maxSelectedZIndex,
			padding: layout.padding,
		})

		// 禁用历史记录，避免子元素更新时记录多次
		const historyManager = this.canvas.historyManager
		historyManager?.disable()

		try {
			// 先创建 Frame 元素（不包含 children，稍后通过移动节点的方式添加）
			const frameDataWithoutChildren: FrameElement = {
				...frameData,
				children: [],
			}
			this.canvas.elementManager.create(frameDataWithoutChildren)

			// 获取 Frame 的节点和 adapter
			const adapter = this.canvas.elementManager.getNodeAdapter()
			const frameNode = adapter.getNodeForParenting(frameId)
			const layer = frameNode?.getLayer()

			// 错误处理：如果 Frame 创建失败，回滚删除
			if (!frameNode || !layer || !(frameNode instanceof Konva.Group)) {
				this.canvas.elementManager.delete(frameId)
				return null
			}

			// 按原有 zIndex 从大到小排序，然后从大到小分配画框内 zIndex，保持相对顺序
			const sortedElements = [...permittedElements].sort(
				(a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0),
			)

			// 移动子元素节点到 Frame 的 Group，并更新数据
			const frameChildren: LayerElement[] = []
			sortedElements.forEach((element, index) => {
				const childNode = adapter.getNodeForParenting(element.id)
				if (
					!childNode ||
					!(childNode instanceof Konva.Shape || childNode instanceof Konva.Group)
				) {
					return
				}

				// 计算子元素相对于 Frame 的坐标
				const relativeX = (element.x ?? 0) - frameX
				const relativeY = (element.y ?? 0) - frameY

				// 将子元素节点从主 layer 移除
				childNode.remove()

				// 更新节点的相对坐标
				childNode.x(relativeX)
				childNode.y(relativeY)

				// 将子元素节点添加到 Frame 的 Group
				frameNode.add(childNode)

				// 更新子元素数据（坐标、zIndex）
				// 按原始顺序从大到小分配 zIndex
				const updatedChildData: LayerElement = {
					...element,
					x: relativeX,
					y: relativeY,
					zIndex: sortedElements.length - index, // 从大到小分配
				}

				// 更新子元素数据（不触发重新渲染，因为节点已经手动移动了）
				this.canvas.elementManager.update(element.id, updatedChildData, {
					forceRerender: false,
				})

				frameChildren.push(updatedChildData)
			})

			// 更新 Frame 的 children 数据
			this.canvas.elementManager.update(frameId, { children: frameChildren })

			// 确保 Frame 的边框始终在最上层
			const frameElement = this.canvas.elementManager.getElementInstance(frameId)
			if (frameElement instanceof FrameElementClass) {
				frameElement.ensureBorderOnTop()
			}

			// 选中新创建的 Frame
			this.canvas.selectionManager.select(frameId)

			// 重新启用历史记录并立即记录一次
			if (historyManager) {
				historyManager.enable()
				historyManager.recordHistoryImmediate()
			}

			// 发出画框创建事件
			this.canvas.eventEmitter.emit({ type: "frame:created", data: { frameId } })
		} catch (error) {
			// 发生错误时也要重新启用历史记录
			historyManager?.enable()
			throw error
		}

		return frameId
	}

	/**
	 * 解除画框
	 * 将画框内的元素释放出来，删除画框
	 * @param frameIds - 要解除的画框 ID 数组，如果不传则使用当前选中的画框
	 * @returns 释放出来的元素 ID 数组
	 */
	public removeFrame(frameIds?: string[]): string[] {
		// 如果没有传入 frameIds，则使用当前选中的元素
		let targetFrameIds = frameIds
		if (!targetFrameIds) {
			const selectedIds = this.canvas.selectionManager.getSelectedIds()
			targetFrameIds = selectedIds.filter((id) => {
				const element = this.canvas.elementManager.getElementData(id)
				// 使用 PermissionManager 统一判断画框是否可以被解除
				return (
					element?.type === ElementTypeEnum.Frame &&
					this.canvas.permissionManager.canRemoveFrame(element)
				)
			})
		}

		if (targetFrameIds.length === 0) {
			return []
		}

		// 获取画框元素数据，过滤掉锁定的画框
		const frameElements = targetFrameIds
			.map((id) => this.canvas.elementManager.getElementData(id))
			.filter((el): el is FrameElement => {
				// 使用 PermissionManager 统一判断画框是否可以被解除
				return (
					el !== undefined &&
					el.type === ElementTypeEnum.Frame &&
					this.canvas.permissionManager.canRemoveFrame(el)
				)
			})

		if (frameElements.length === 0) {
			return []
		}

		// 收集所有需要释放的子元素
		const elementsToRelease: Array<{ element: FrameElement; children: LayerElement[] }> = []
		const emptyFrameElements: FrameElement[] = []

		frameElements.forEach((frameElement) => {
			if (frameElement.children && frameElement.children.length > 0) {
				elementsToRelease.push({
					element: frameElement,
					children: frameElement.children,
				})
			} else {
				emptyFrameElements.push(frameElement)
			}
		})

		if (elementsToRelease.length === 0 && emptyFrameElements.length === 0) {
			return []
		}

		// 禁用历史记录，避免子元素更新、Frame删除、批量更新时记录多次
		const historyManager = this.canvas.historyManager
		historyManager?.disable()

		// 释放所有子元素
		const releasedElementIds: string[] = []
		const elementsToReorder: Array<{
			element: LayerElement
			frameId: string
			targetZIndex: number
		}> = []

		try {
			emptyFrameElements.forEach((frameElement) => {
				this.canvas.elementManager.delete(frameElement.id)
				this.canvas.eventEmitter.emit({
					type: "frame:removed",
					data: { frameId: frameElement.id },
				})
			})

			elementsToRelease.forEach(({ element: frameElement, children }) => {
				const frameX = frameElement.x ?? 0
				const frameY = frameElement.y ?? 0
				const frameZIndex = frameElement.zIndex ?? 0

				// 使用 NodeAdapter 获取 Frame 的节点和 layer
				const adapter = this.canvas.elementManager.getNodeAdapter()
				const frameNode = adapter.getNodeForParenting(frameElement.id)
				const layer = frameNode?.getLayer()
				if (!frameNode || !layer || !(frameNode instanceof Konva.Group)) {
					return
				}
				const frameLayerIndex = frameNode.getZIndex()
				const releasedNodesForFrame: Konva.Node[] = []

				// 按子元素在画框内的 zIndex 从大到小排序，保持相对顺序
				const sortedChildren = [...children].sort(
					(a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0),
				)

				// 将子元素转换为画布坐标并移动节点到主 layer
				sortedChildren.forEach((child) => {
					const childNode = adapter.getNodeForParenting(child.id)
					if (
						!childNode ||
						!(childNode instanceof Konva.Shape || childNode instanceof Konva.Group)
					) {
						return
					}

					// 计算子元素在画布上的绝对坐标
					const absoluteX = (child.x ?? 0) + frameX
					const absoluteY = (child.y ?? 0) + frameY

					// 将子元素节点从 Frame 的 Group 中移除
					childNode.remove()

					// 更新节点的绝对坐标
					childNode.x(absoluteX)
					childNode.y(absoluteY)

					// 将子元素节点添加到主 layer
					layer.add(childNode)
					releasedNodesForFrame.push(childNode)

					// 更新子元素数据（坐标，zIndex 稍后统一重新分配）
					const childData = {
						...child,
						x: absoluteX,
						y: absoluteY,
					}

					// 更新子元素数据（不触发重新渲染，因为节点已经手动移动了）
					this.canvas.elementManager.update(child.id, childData, {
						forceRerender: false,
					})

					releasedElementIds.push(childData.id)

					// 记录释放出来的子元素及其在画框内的顺序
					elementsToReorder.push({
						element: childData,
						frameId: frameElement.id,
						targetZIndex: frameZIndex, // 使用画框的 zIndex 作为基准
					})
				})

				// 清空 Frame 的 children，避免删除时递归删除子元素
				this.canvas.elementManager.update(frameElement.id, { children: [] })

				// 删除 Frame 元素
				this.canvas.elementManager.delete(frameElement.id)

				// 发出画框移除事件
				this.canvas.eventEmitter.emit({
					type: "frame:removed",
					data: { frameId: frameElement.id },
				})

				this.repositionReleasedNodesAtFrameIndex(releasedNodesForFrame, frameLayerIndex)
			})

			// 只更新释放出来的子元素 zIndex；Konva 节点顺序已按原 frame 位置插回。
			this.assignReleasedElementZIndexes(elementsToReorder)

			// 选中释放出来的元素
			if (releasedElementIds.length > 0) {
				this.canvas.selectionManager.selectMultiple(releasedElementIds)
			}

			// 重新启用历史记录并立即记录一次
			if (historyManager) {
				historyManager.enable()
				historyManager.recordHistoryImmediate()
			}

			return releasedElementIds
		} catch (error) {
			// 发生错误时也要重新启用历史记录
			historyManager?.enable()
			throw error
		}
	}

	/**
	 * 将释放出来的节点插回原 frame 所在的 layer index。
	 * sortedChildren 是从上到下处理的，Konva 插入时需要从下到上放回，才能保持视觉层级。
	 */
	private repositionReleasedNodesAtFrameIndex(
		releasedNodes: Konva.Node[],
		frameLayerIndex: number,
	): void {
		if (releasedNodes.length === 0) return
		;[...releasedNodes].reverse().forEach((node, index) => {
			node.zIndex(frameLayerIndex + index)
		})
		this.canvas.runtimeScheduler.requestLayerDraw("content", {
			source: "FrameManager",
			reason: "remove-frame-reposition-released-nodes",
			priority: "normal",
		})
	}

	/**
	 * 重新分配释放元素的 zIndex
	 * 释放出的子元素用小数 zIndex 填入原 frame 与其上一层之间，不再重排全部顶层元素。
	 * @param elementsToReorder - 需要重新排序的元素及其目标 zIndex（画框的 zIndex）
	 */
	private assignReleasedElementZIndexes(
		elementsToReorder: Array<{ element: LayerElement; frameId: string; targetZIndex: number }>,
	): void {
		if (elementsToReorder.length === 0) return

		const updates: Array<{ id: string; data: Partial<LayerElement> }> = []

		const groups = new Map<string, typeof elementsToReorder>()
		elementsToReorder.forEach((item) => {
			const group = groups.get(item.frameId)
			if (group) {
				group.push(item)
			} else {
				groups.set(item.frameId, [item])
			}
		})

		groups.forEach((items) => {
			const count = items.length
			const frameZIndex = items[0].targetZIndex
			items.forEach((item, index) => {
				const newZIndex = frameZIndex + (count - index) / (count + 1)
				updates.push({ id: item.element.id, data: { zIndex: newZIndex } })
			})
		})

		if (updates.length > 0) {
			this.canvas.elementManager.batchUpdate(updates, { skipZIndexReorder: true })
		}
	}

	/**
	 * 检查选中的元素中是否有画框且包含子元素
	 * @returns 是否有可以解除的画框
	 */
	public hasRemovableFrame(): boolean {
		const selectedIds = this.canvas.selectionManager.getSelectedIds()
		return selectedIds.some((id) => {
			const element = this.canvas.elementManager.getElementData(id)
			return (
				element?.type === ElementTypeEnum.Frame &&
				"children" in element &&
				element.children &&
				Array.isArray(element.children) &&
				element.children.length > 0
			)
		})
	}

	/**
	 * 销毁管理器
	 */
	public destroy(): void {
		this.dragEventUnsubscribers.forEach((unsubscribe) => unsubscribe())
		this.dragEventUnsubscribers.length = 0
		this.dragSession = null
		this.clearDragIndicator(false)
	}
}
