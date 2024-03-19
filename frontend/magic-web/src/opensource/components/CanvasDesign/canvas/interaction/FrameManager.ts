import Konva from "konva"
import type { Canvas } from "../Canvas"
import type { LayerElement, FrameElement } from "../types"
import { ElementTypeEnum } from "../types"
import { generateElementId, calculateElementsRect } from "../utils/utils"
import { FrameElement as FrameElementClass } from "../element/elements/FrameElement"

/**
 * 画框管理器
 * 职责：
 * 1. 创建画框（将选中的元素组合成画框）
 * 2. 解除画框（将画框内的元素释放出来）
 */
export class FrameManager {
	private canvas: Canvas

	constructor(options: { canvas: Canvas }) {
		const { canvas } = options
		this.canvas = canvas
	}

	/**
	 * 创建画框
	 * 将选中的元素组合成一个画框
	 * @param padding - 画框内边距
	 * @returns 创建的画框 ID，如果创建失败返回 null
	 */
	public createFrame(padding: number = 0): string | null {
		const selectedIds = this.canvas.selectionManager.getSelectedIds()
		if (selectedIds.length === 0) {
			return null
		}

		// 获取选中的元素数据，过滤掉锁定的元素
		const selectedElements = selectedIds
			.map((id) => this.canvas.elementManager.getElementData(id))
			.filter((el): el is LayerElement => {
				// 使用 PermissionManager 统一判断元素是否可以被添加到画框
				return el !== undefined && this.canvas.permissionManager.canAddToFrame(el)
			})

		if (selectedElements.length === 0) {
			return null
		}

		// 校验：选中的元素中不能包含 frame 元素
		const hasFrameElement = selectedElements.some((el) => el.type === ElementTypeEnum.Frame)
		if (hasFrameElement) {
			return null
		}

		// 计算选中元素的总体边界
		const rect = calculateElementsRect(selectedElements)
		if (!rect) {
			return null
		}

		// 计算画框的位置和尺寸，宽高向上取整
		const frameX = rect.x - padding
		const frameY = rect.y - padding
		const frameWidth = Math.ceil(rect.width + padding * 2)
		const frameHeight = Math.ceil(rect.height + padding * 2)

		// 获取选中元素的最大 zIndex，Frame 将使用这个位置
		const maxSelectedZIndex = Math.max(...selectedElements.map((el) => el.zIndex ?? 0))

		// 创建新的 Frame 元素数据
		const frameId = generateElementId()
		const frameData: FrameElement = FrameElementClass.createElementData(
			frameId,
			frameX,
			frameY,
			frameWidth,
			frameHeight,
			maxSelectedZIndex, // Frame 使用选中元素的最大 zIndex
		)

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
			const sortedElements = [...selectedElements].sort(
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

			// 重新分配顶层元素的 zIndex（因为移除了选中元素，需要重新排列）
			const allTopLevelElements = this.canvas.elementManager.getAllElements()
			const updates: Array<{ id: string; data: Partial<LayerElement> }> = []
			let zIndex = 1

			// 按当前 zIndex 排序所有顶层元素
			const sortedTopLevelElements = [...allTopLevelElements].sort(
				(a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
			)

			// 重新分配 zIndex，从 1 开始连续递增
			sortedTopLevelElements.forEach((element) => {
				updates.push({ id: element.id, data: { zIndex } })
				zIndex++
			})

			// 批量更新顶层元素的 zIndex
			if (updates.length > 0) {
				this.canvas.elementManager.batchUpdate(updates)
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

		frameElements.forEach((frameElement) => {
			if (frameElement.children && frameElement.children.length > 0) {
				elementsToRelease.push({
					element: frameElement,
					children: frameElement.children,
				})
			}
		})

		if (elementsToRelease.length === 0) {
			return []
		}

		// 禁用历史记录，避免子元素更新、Frame删除、批量更新时记录多次
		const historyManager = this.canvas.historyManager
		historyManager?.disable()

		// 释放所有子元素
		const releasedElementIds: string[] = []
		// 收集所有需要重新排序的元素及其目标 zIndex
		// 格式: { element: LayerElement, targetZIndex: number }
		const elementsToReorder: Array<{ element: LayerElement; targetZIndex: number }> = []

		try {
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
			})

			// 重新分配所有顶层元素的 zIndex
			this.reorderTopLevelElements(elementsToReorder)

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
	 * 重新分配顶层元素的 zIndex
	 * 将释放出来的子元素作为一个整体插入到画框位置，保持相对顺序
	 * @param elementsToReorder - 需要重新排序的元素及其目标 zIndex（画框的 zIndex）
	 */
	private reorderTopLevelElements(
		elementsToReorder: Array<{ element: LayerElement; targetZIndex: number }>,
	): void {
		if (elementsToReorder.length === 0) return

		// 获取所有顶层元素
		const allTopLevelElements = this.canvas.elementManager.getAllElements()

		// 获取画框的 zIndex（所有释放元素使用相同的 targetZIndex）
		const frameZIndex = elementsToReorder[0].targetZIndex

		// 获取释放的元素 ID 集合
		const releasedElementIds = new Set(elementsToReorder.map((item) => item.element.id))

		// 将其他元素分为两组：画框位置以上的元素，画框位置以下的元素
		const elementsAboveFrame: LayerElement[] = []
		const elementsBelowFrame: LayerElement[] = []

		allTopLevelElements.forEach((element) => {
			if (releasedElementIds.has(element.id)) {
				// 跳过释放的元素
				return
			}
			const elementZIndex = element.zIndex ?? 0
			if (elementZIndex > frameZIndex) {
				elementsAboveFrame.push(element)
			} else if (elementZIndex < frameZIndex) {
				elementsBelowFrame.push(element)
			}
		})

		// 按 zIndex 从大到小排序
		elementsAboveFrame.sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))
		elementsBelowFrame.sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0))

		// 释放的元素已经按画框内 zIndex 从大到小排序
		const releasedElements = elementsToReorder.map((item) => item.element)

		// 合并所有元素：上方元素 + 释放的元素 + 下方元素
		const finalElements = [...elementsAboveFrame, ...releasedElements, ...elementsBelowFrame]

		// 重新分配 zIndex，从最大值开始连续递减
		const updates: Array<{ id: string; data: Partial<LayerElement> }> = []
		finalElements.forEach((element, index) => {
			const newZIndex = finalElements.length - index
			updates.push({ id: element.id, data: { zIndex: newZIndex } })
		})

		// 批量更新顶层元素的 zIndex
		if (updates.length > 0) {
			this.canvas.elementManager.batchUpdate(updates)
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
		// 清理资源
	}
}
