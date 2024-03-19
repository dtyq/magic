import type { Canvas } from "../Canvas"
import type { LayerElement } from "../types"

/**
 * ZIndex 管理器
 * 职责：管理元素的 zIndex 层级操作（上移、下移、置顶、置底等）
 */
export class ZIndexManager {
	private canvas: Canvas

	constructor(canvas: Canvas) {
		this.canvas = canvas
	}

	/**
	 * 获取同级元素列表
	 */
	private getSiblings(
		elementId: string,
	): { siblings: LayerElement[]; currentIndex: number } | null {
		const allElements = this.canvas.elementManager.getAllElements()
		const element = this.canvas.elementManager.getElementData(elementId)
		if (!element) return null

		// 查找父节点
		const findParent = (
			nodes: LayerElement[],
			targetId: string,
		): { parent: LayerElement | null; siblings: LayerElement[] } | null => {
			for (const node of nodes) {
				if ("children" in node && node.children) {
					const index = node.children.findIndex((child) => child.id === targetId)
					if (index !== -1) {
						return { parent: node, siblings: node.children }
					}
					const result = findParent(node.children, targetId)
					if (result) return result
				}
			}
			return null
		}

		// 先检查是否在顶层
		const topIndex = allElements.findIndex((el) => el.id === elementId)
		if (topIndex !== -1) {
			return { siblings: allElements, currentIndex: topIndex }
		}

		// 在子节点中查找
		const result = findParent(allElements, elementId)
		if (result) {
			const currentIndex = result.siblings.findIndex((s) => s.id === elementId)
			return { siblings: result.siblings, currentIndex }
		}

		return null
	}

	/**
	 * 按 zIndex 排序同级元素（升序：zIndex 小的在前）
	 */
	private sortSiblingsByZIndex(
		siblings: LayerElement[],
		ascending: boolean = true,
	): LayerElement[] {
		return [...siblings].sort((a, b) => {
			const aZIndex = a.zIndex ?? 0
			const bZIndex = b.zIndex ?? 0
			return ascending ? aZIndex - bZIndex : bZIndex - aZIndex
		})
	}

	/**
	 * 获取排序后的同级元素并找到当前元素的索引
	 */
	private getSortedSiblingsAndIndex(
		elementId: string,
		ascending: boolean = true,
	): { sortedSiblings: LayerElement[]; currentIndex: number } | null {
		const result = this.getSiblings(elementId)
		if (!result) return null

		const sortedSiblings = this.sortSiblingsByZIndex(result.siblings, ascending)
		const currentIndex = sortedSiblings.findIndex((s) => s.id === elementId)
		return { sortedSiblings, currentIndex }
	}

	/**
	 * 交换两个元素的 zIndex
	 */
	private swapZIndex(elementId1: string, elementId2: string): void {
		const element1 = this.canvas.elementManager.getElementData(elementId1)
		const element2 = this.canvas.elementManager.getElementData(elementId2)
		if (!element1 || !element2) return

		const zIndex1 = element1.zIndex ?? 0
		const zIndex2 = element2.zIndex ?? 0

		this.canvas.elementManager.update(elementId1, { zIndex: zIndex2 })
		this.canvas.elementManager.update(elementId2, { zIndex: zIndex1 })
	}

	/**
	 * 批量操作：按层级分组选中元素
	 * 返回 Map<parentId, { elements: LayerElement[], siblings: LayerElement[] }>
	 */
	private groupElementsByLevel(
		elementIds: string[],
	): Map<string, { elements: LayerElement[]; siblings: LayerElement[] }> {
		const levelGroups = new Map<
			string,
			{ elements: LayerElement[]; siblings: LayerElement[] }
		>()

		// 获取选中的元素数据
		const selectedElements = elementIds
			.map((id) => this.canvas.elementManager.getElementData(id))
			.filter((el): el is LayerElement => el !== undefined)

		// 按层级分组，同时缓存 siblings
		selectedElements.forEach((element) => {
			const result = this.getSiblings(element.id)
			if (!result) return

			const parentId = this.canvas.elementManager.findParentIdForElement(element.id) ?? ""

			if (!levelGroups.has(parentId)) {
				levelGroups.set(parentId, {
					elements: [],
					siblings: result.siblings,
				})
			}

			const group = levelGroups.get(parentId)
			if (group) {
				group.elements.push(element)
			}
		})

		return levelGroups
	}

	/**
	 * 批量操作通用框架
	 * 处理层级分组、收集更新、批量提交
	 */
	private batchOperation(
		elementIds: string[],
		processLevel: (
			elements: LayerElement[],
			siblings: LayerElement[],
			updates: Array<{ id: string; data: Partial<LayerElement> }>,
		) => void,
	): void {
		if (elementIds.length === 0) return

		const levelGroups = this.groupElementsByLevel(elementIds)
		const updates: Array<{ id: string; data: Partial<LayerElement> }> = []

		levelGroups.forEach(({ elements, siblings }) => {
			processLevel(elements, siblings, updates)
		})

		if (updates.length > 0) {
			this.canvas.elementManager.batchUpdate(updates)
		}
	}

	/**
	 * 执行 zIndex 交换操作（使用临时映射避免修改原始数据）
	 */
	private executeZIndexSwaps(
		swapPairs: Array<{ selectedId: string; targetId: string }>,
		siblings: LayerElement[],
		updates: Array<{ id: string; data: Partial<LayerElement> }>,
	): void {
		// 维护临时的 zIndex 映射，避免直接修改数据对象
		const tempZIndexMap = new Map<string, number>()
		siblings.forEach((s) => tempZIndexMap.set(s.id, s.zIndex ?? 0))

		// 按顺序执行交换，使用临时映射来跟踪最新的 zIndex
		swapPairs.forEach((pair) => {
			const selectedZIndex = tempZIndexMap.get(pair.selectedId) ?? 0
			const targetZIndex = tempZIndexMap.get(pair.targetId) ?? 0
			updates.push({ id: pair.selectedId, data: { zIndex: targetZIndex } })
			updates.push({ id: pair.targetId, data: { zIndex: selectedZIndex } })
			// 更新临时映射（不修改原始数据）
			tempZIndexMap.set(pair.selectedId, targetZIndex)
			tempZIndexMap.set(pair.targetId, selectedZIndex)
		})
	}

	/**
	 * 上移一层
	 * @param elementId - 元素ID
	 */
	public moveUp(elementId: string): void {
		const result = this.getSortedSiblingsAndIndex(elementId, true)
		if (!result) return
		const { sortedSiblings, currentIndex } = result

		if (currentIndex < sortedSiblings.length - 1) {
			// 与上一个元素交换 zIndex
			const upperElement = sortedSiblings[currentIndex + 1]
			this.swapZIndex(elementId, upperElement.id)
		}
	}

	/**
	 * 批量上移一层
	 * 规则：每个选中元素与其上方第一个未选中元素交换 zIndex
	 * 处理顺序：从上到下（zIndex 从大到小）
	 */
	public batchMoveUp(elementIds: string[]): void {
		this.batchOperation(elementIds, (elements, siblings, updates) => {
			// 按 zIndex 从大到小排序（从上到下）
			const sortedSiblings = this.sortSiblingsByZIndex(siblings, false)
			const selectedIds = new Set(elements.map((el) => el.id))

			// 按 zIndex 从大到小排序选中的元素
			const sortedElements = this.sortSiblingsByZIndex(elements, false)

			// 为每个选中元素找到其上方第一个未选中元素（基于初始状态）
			// 注意：sortedSiblings 是按 zIndex 从大到小排序的，所以上方元素在数组前面（索引更小）
			const swapPairs: Array<{ selectedId: string; targetId: string }> = []
			sortedElements.forEach((element) => {
				const currentIndex = sortedSiblings.findIndex((s) => s.id === element.id)
				// 向上查找第一个未选中元素（索引减小的方向）
				for (let i = currentIndex - 1; i >= 0; i--) {
					if (!selectedIds.has(sortedSiblings[i].id)) {
						swapPairs.push({
							selectedId: element.id,
							targetId: sortedSiblings[i].id,
						})
						break
					}
				}
			})

			this.executeZIndexSwaps(swapPairs, siblings, updates)
		})
	}

	/**
	 * 下移一层
	 * @param elementId - 元素ID
	 */
	public moveDown(elementId: string): void {
		const result = this.getSortedSiblingsAndIndex(elementId, true)
		if (!result) return
		const { sortedSiblings, currentIndex } = result

		if (currentIndex > 0) {
			// 与下一个元素交换 zIndex
			const lowerElement = sortedSiblings[currentIndex - 1]
			this.swapZIndex(elementId, lowerElement.id)
		}
	}

	/**
	 * 批量下移一层
	 * 规则：每个选中元素与其下方第一个未选中元素交换 zIndex
	 * 处理顺序：从下到上（zIndex 从小到大）
	 */
	public batchMoveDown(elementIds: string[]): void {
		this.batchOperation(elementIds, (elements, siblings, updates) => {
			// 按 zIndex 从小到大排序（从下到上）
			const sortedSiblings = this.sortSiblingsByZIndex(siblings, true)
			const selectedIds = new Set(elements.map((el) => el.id))

			// 按 zIndex 从小到大排序选中的元素
			const sortedElements = this.sortSiblingsByZIndex(elements, true)

			// 为每个选中元素找到其下方第一个未选中元素（基于初始状态）
			// 注意：sortedSiblings 是按 zIndex 从小到大排序的，所以下方元素在数组前面（索引更小）
			const swapPairs: Array<{ selectedId: string; targetId: string }> = []
			sortedElements.forEach((element) => {
				const currentIndex = sortedSiblings.findIndex((s) => s.id === element.id)
				// 向下查找第一个未选中元素（索引减小的方向）
				for (let i = currentIndex - 1; i >= 0; i--) {
					if (!selectedIds.has(sortedSiblings[i].id)) {
						swapPairs.push({
							selectedId: element.id,
							targetId: sortedSiblings[i].id,
						})
						break
					}
				}
			})

			this.executeZIndexSwaps(swapPairs, siblings, updates)
		})
	}

	/**
	 * 移至顶部
	 * @param elementId - 元素ID
	 */
	public moveToTop(elementId: string): void {
		const result = this.getSortedSiblingsAndIndex(elementId, true)
		if (!result) return
		const { sortedSiblings, currentIndex } = result

		// 如果已经在最顶部，不需要移动
		if (currentIndex === sortedSiblings.length - 1) return

		// 重新分配所有同级元素的 zIndex，将目标元素移至顶部
		const updates: Array<{ id: string; data: Partial<LayerElement> }> = []
		let zIndex = 1

		// 先分配其他元素（排除目标元素）
		sortedSiblings.forEach((sibling) => {
			if (sibling.id !== elementId) {
				updates.push({ id: sibling.id, data: { zIndex } })
				zIndex++
			}
		})

		// 最后分配目标元素（最大 zIndex）
		updates.push({ id: elementId, data: { zIndex } })

		// 批量更新
		this.canvas.elementManager.batchUpdate(updates)
	}

	/**
	 * 批量移至顶部（保持相对层级关系）
	 * 按层级分组处理，每个层级内的元素移至该层级的顶部
	 */
	public batchMoveToTop(elementIds: string[]): void {
		this.batchOperation(elementIds, (elements, siblings, updates) => {
			// 获取选中的元素 ID 集合
			const selectedElementIds = new Set(elements.map((el) => el.id))

			// 分离选中的元素和未选中的元素
			const unselectedSiblings = siblings.filter((s) => !selectedElementIds.has(s.id))
			const sortedUnselected = this.sortSiblingsByZIndex(unselectedSiblings, true)

			// 按 zIndex 从小到大排序选中的元素（保持相对层级关系）
			const sortedSelected = this.sortSiblingsByZIndex(elements, true)

			// 重新分配所有同级元素的 zIndex
			let zIndex = 1

			// 先分配未选中的元素（保持相对顺序）
			sortedUnselected.forEach((sibling) => {
				updates.push({ id: sibling.id, data: { zIndex } })
				zIndex++
			})

			// 最后分配选中的元素（移至顶部，保持相对顺序）
			sortedSelected.forEach((element) => {
				updates.push({ id: element.id, data: { zIndex } })
				zIndex++
			})
		})
	}

	/**
	 * 移至底部
	 * @param elementId - 元素ID
	 */
	public moveToBottom(elementId: string): void {
		const result = this.getSortedSiblingsAndIndex(elementId, true)
		if (!result) return
		const { sortedSiblings, currentIndex } = result

		// 如果已经在最底部，不需要移动
		if (currentIndex === 0) return

		// 重新分配所有同级元素的 zIndex，将目标元素移至底部
		const updates: Array<{ id: string; data: Partial<LayerElement> }> = []
		let zIndex = 1

		// 先分配目标元素（最小 zIndex）
		updates.push({ id: elementId, data: { zIndex } })
		zIndex++

		// 然后分配其他元素（保持相对顺序）
		sortedSiblings.forEach((sibling) => {
			if (sibling.id !== elementId) {
				updates.push({ id: sibling.id, data: { zIndex } })
				zIndex++
			}
		})

		// 批量更新
		this.canvas.elementManager.batchUpdate(updates)
	}

	/**
	 * 批量移至底部（保持相对层级关系）
	 * 按层级分组处理，每个层级内的元素移至该层级的底部
	 */
	public batchMoveToBottom(elementIds: string[]): void {
		this.batchOperation(elementIds, (elements, siblings, updates) => {
			// 获取选中的元素 ID 集合
			const selectedElementIds = new Set(elements.map((el) => el.id))

			// 分离选中的元素和未选中的元素
			const unselectedSiblings = siblings.filter((s) => !selectedElementIds.has(s.id))
			const sortedUnselected = this.sortSiblingsByZIndex(unselectedSiblings, true)

			// 按 zIndex 从小到大排序选中的元素（保持相对层级关系）
			const sortedSelected = this.sortSiblingsByZIndex(elements, true)

			// 重新分配所有同级元素的 zIndex
			let zIndex = 1

			// 先分配选中的元素（移至底部，保持相对顺序）
			sortedSelected.forEach((element) => {
				updates.push({ id: element.id, data: { zIndex } })
				zIndex++
			})

			// 然后分配未选中的元素（保持相对顺序）
			sortedUnselected.forEach((sibling) => {
				updates.push({ id: sibling.id, data: { zIndex } })
				zIndex++
			})
		})
	}
}
