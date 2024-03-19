import { useState, useEffect, useMemo, useCallback } from "react"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import type { AttachmentItem } from "./types"
import type { TreeNodeData } from "../utils/treeDataConverter"

type CheckState = "checked" | "unchecked" | "indeterminate"

interface FileIndexInfo {
	item: AttachmentItem
	parentId: string | null
	level: number
	ancestorIds: string[]
	descendantIds: string[]
}

interface UseFileSelectionOptions {
	projectId?: string
	getItemId: (item: AttachmentItem) => string
	treeData: TreeNodeData[]
	isSelectMode: boolean
	onSelectionChange?: (selectedCount: number, totalCount: number) => void
	onSelectModeChange?: (isSelectMode: boolean) => void
	getAllFileIds?: (treeNodes: TreeNodeData[]) => string[]
	getTotalCount: (treeNodes: TreeNodeData[]) => number
}

/**
 * useFileSelection - 处理文件选择相关逻辑
 */
export function useFileSelection(options: UseFileSelectionOptions) {
	const {
		projectId,
		getItemId,
		treeData,
		isSelectMode,
		onSelectionChange,
		onSelectModeChange,
		getTotalCount,
	} = options
	const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

	// 当 projectId 变更时，清空 selectedItems
	useEffect(() => {
		setSelectedItems(new Set())
	}, [projectId])

	// 构建文件索引映射表 - 核心性能优化，O(1) 查询
	const fileIndexMap = useMemo(() => {
		const map = new Map<string, FileIndexInfo>()

		const buildIndex = (
			nodes: TreeNodeData[],
			parentId: string | null,
			level: number,
			ancestors: string[],
		) => {
			for (const node of nodes) {
				const itemId = getItemId(node.item)
				if (!itemId) continue

				// 收集所有后代ID
				const descendantIds: string[] = []
				const collectDescendants = (children: TreeNodeData[]) => {
					for (const child of children) {
						const childId = getItemId(child.item)
						if (childId) {
							descendantIds.push(childId)
							if (child.children?.length) {
								collectDescendants(child.children)
							}
						}
					}
				}
				if (node.children?.length) {
					collectDescendants(node.children)
				}

				map.set(itemId, {
					item: node.item,
					parentId,
					level,
					ancestorIds: ancestors,
					descendantIds,
				})

				if (node.children?.length) {
					buildIndex(node.children, itemId, level + 1, [...ancestors, itemId])
				}
			}
		}

		buildIndex(treeData, null, 0, [])
		return map
	}, [treeData, getItemId])

	// 判断节点是否被选中（考虑父级继承）- 使用索引优化
	const isItemSelected = useCallback(
		(itemId: string): boolean => {
			if (selectedItems.has(itemId)) return true

			const info = fileIndexMap.get(itemId)
			if (!info) return false

			// O(祖先数量) 通常 < 10，而非 O(所有节点)
			return info.ancestorIds.some((id) => selectedItems.has(id))
		},
		[selectedItems, fileIndexMap],
	)

	// 一次性计算所有节点的勾选状态 - 使用后序遍历（参考 FileSelector 的高性能实现）
	const nodeCheckStates = useMemo(() => {
		const states = new Map<string, CheckState>()
		const selectedSet = selectedItems

		// 判断节点是否被选中（含父级），使用索引优化
		const isSelected = (itemId: string): boolean => {
			if (selectedSet.has(itemId)) return true
			const info = fileIndexMap.get(itemId)
			if (!info) return false
			return info.ancestorIds.some((id) => selectedSet.has(id))
		}

		// 计算单个节点的状态
		const calculateState = (item: AttachmentItem): CheckState => {
			const itemId = getItemId(item)

			// 文件：检查是否被选中（含父级）
			if (!item.is_directory) {
				return isSelected(itemId) ? "checked" : "unchecked"
			}

			// 空文件夹：检查是否被选中（含父级）
			if (!item.children || item.children.length === 0) {
				return isSelected(itemId) ? "checked" : "unchecked"
			}

			// 文件夹本身被选中，直接返回 checked
			if (selectedSet.has(itemId)) {
				return "checked"
			}

			// 非空文件夹：基于子级状态汇总
			const visibleChildren = item.children.filter((child) => !child.is_hidden)

			// 如果没有可见子级，只检查自己
			if (visibleChildren.length === 0) {
				return isSelected(itemId) ? "checked" : "unchecked"
			}

			let checkedCount = 0
			let indeterminateFound = false

			for (const child of visibleChildren) {
				const childId = getItemId(child)
				const childState = states.get(childId)
				if (childState === "checked") {
					checkedCount++
				} else if (childState === "indeterminate") {
					indeterminateFound = true
				}
			}

			if (indeterminateFound || (checkedCount > 0 && checkedCount < visibleChildren.length)) {
				return "indeterminate"
			}
			return checkedCount === visibleChildren.length ? "checked" : "unchecked"
		}

		// 后序遍历计算所有节点状态（子节点先于父节点）
		const calculateStates = (items: AttachmentItem[]) => {
			for (const item of items) {
				// 先计算子节点
				if (item.children && item.children.length > 0) {
					calculateStates(item.children)
				}
				// 再计算当前节点
				const itemId = getItemId(item)
				if (itemId) {
					states.set(itemId, calculateState(item))
				}
			}
		}

		// 从索引中提取所有根节点的 items
		const rootItems = treeData.map((node) => node.item)
		calculateStates(rootItems)

		return states
	}, [selectedItems, fileIndexMap, treeData, getItemId])

	// 获取节点的勾选状态（直接从缓存的 Map 中查询）
	const getNodeCheckState = useCallback(
		(itemId: string): CheckState => {
			return nodeCheckStates.get(itemId) || "unchecked"
		},
		[nodeCheckStates],
	)

	// 计算实际选中的文件数量 - 增量计算优化
	const selectedCount = useMemo(() => {
		let count = 0
		const counted = new Set<string>()

		for (const selectedId of Array.from(selectedItems)) {
			const info = fileIndexMap.get(selectedId)
			if (!info) continue

			if (info.item.is_directory) {
				// 文件夹：统计所有后代（排除隐藏文件）
				for (const descendantId of info.descendantIds) {
					const descendantInfo = fileIndexMap.get(descendantId)
					if (
						descendantInfo &&
						!descendantInfo.item.is_hidden &&
						!counted.has(descendantId)
					) {
						counted.add(descendantId)
						count++
					}
				}
				// 加上文件夹自身（如果不是隐藏的）
				if (!info.item.is_hidden && !counted.has(selectedId)) {
					counted.add(selectedId)
					count++
				}
			} else {
				// 文件：直接计数（排除隐藏文件）
				if (!info.item.is_hidden && !counted.has(selectedId)) {
					counted.add(selectedId)
					count++
				}
			}
		}

		return count
	}, [selectedItems, fileIndexMap])

	// 监听选择状态变化并通知父组件
	useEffect(() => {
		if (onSelectionChange) {
			const totalCount = getTotalCount(treeData)
			onSelectionChange(selectedCount, totalCount)
		}
	}, [selectedCount, treeData, onSelectionChange, getTotalCount])

	// 监听全选和取消全选事件
	useEffect(() => {
		const handleSelectAll = () => {
			if (!isSelectMode) return

			// 只获取第一层（根级别）的文件/文件夹ID
			const rootFileIds = treeData
				.map((node) => getItemId(node.item))
				.filter(Boolean) as string[]
			setSelectedItems(new Set(rootFileIds))
		}

		const handleDeselectAll = () => {
			setSelectedItems(new Set())
		}

		pubsub.subscribe(PubSubEvents.Select_All_Files, handleSelectAll)
		pubsub.subscribe(PubSubEvents.Deselect_All_Files, handleDeselectAll)

		return () => {
			pubsub.unsubscribe(PubSubEvents.Select_All_Files, handleSelectAll)
			pubsub.unsubscribe(PubSubEvents.Deselect_All_Files, handleDeselectAll)
		}
	}, [isSelectMode, treeData, getItemId])

	// 递归获取文件夹下所有子项ID（包括文件和文件夹）
	const getAllItemIds = (folder: AttachmentItem): string[] => {
		const folderId = getItemId(folder)
		const info = fileIndexMap.get(folderId)
		if (!info) return []
		return info.descendantIds
	}

	// 检查文件夹的选中状态 - 使用按需计算
	const getFolderSelectionState = useCallback(
		(folder: AttachmentItem): "none" | "partial" | "all" => {
			if (!folder.is_directory) {
				return "none"
			}

			const folderId = getItemId(folder)
			const state = getNodeCheckState(folderId)

			if (state === "checked") return "all"
			if (state === "indeterminate") return "partial"
			return "none"
		},
		[getItemId, getNodeCheckState],
	)

	// 检查某个项目是否应该被禁用
	const isItemDisabled = (): boolean => {
		// 所有项目都不禁用，因为选中状态现在是独立的
		return false
	}

	// 处理项目选择 - 使用优化后的查询函数
	const handleItemSelect = useCallback(
		(item: AttachmentItem) => {
			const itemId = getItemId(item)
			const checkState = getNodeCheckState(itemId)
			let newSelectedIds: string[]

			// 情况1: 未选中 → 选中
			if (checkState === "unchecked") {
				newSelectedIds = [itemId, ...Array.from(selectedItems)]
			}
			// 情况2: 全选中 → 取消
			else if (checkState === "checked") {
				const selectedArray = Array.from(selectedItems)
				const selectedSet = new Set(selectedArray)

				if (selectedSet.has(itemId)) {
					// 直接选中的节点 - 直接移除
					newSelectedIds = selectedArray.filter((id) => id !== itemId)
				} else {
					// 因父级选中而间接选中的节点 - 需要向上查找真正被选中的祖先
					const info = fileIndexMap.get(itemId)

					// 向上查找第一个被选中的祖先
					let selectedAncestorId: string | null = null
					let ancestorIndex = -1
					if (info) {
						for (let i = info.ancestorIds.length - 1; i >= 0; i--) {
							const ancestorId = info.ancestorIds[i]
							if (selectedSet.has(ancestorId)) {
								selectedAncestorId = ancestorId
								ancestorIndex = i
								break
							}
						}
					}

					if (selectedAncestorId && info) {
						// 找到了被选中的祖先，取消该祖先，展开除当前节点所在路径外的其他节点
						const ancestorInfo = fileIndexMap.get(selectedAncestorId)

						// 从 ancestorIds 中直接获取直接子节点
						const directChildOfAncestor = info.ancestorIds[ancestorIndex + 1] || itemId

						// 获取祖先的所有子节点ID（排除当前节点所在的分支）
						const siblingIds =
							ancestorInfo?.item.children
								?.map((child) => getItemId(child))
								.filter((id) => id !== directChildOfAncestor) || []

						// 展开 directChildOfAncestor 分支，选中除当前取消节点外的所有节点
						const branchToExpand: string[] = []
						const directChildInfo = fileIndexMap.get(directChildOfAncestor)
						if (directChildInfo?.item.children) {
							// 递归收集该分支下所有节点，但排除当前取消选中的节点及其后代
							const excludeSet = new Set([itemId, ...info.descendantIds])
							const collectBranchNodes = (children: AttachmentItem[]) => {
								for (const child of children) {
									const childId = getItemId(child)
									if (childId && !excludeSet.has(childId)) {
										branchToExpand.push(childId)
										if (child.children?.length) {
											collectBranchNodes(child.children)
										}
									}
								}
							}
							collectBranchNodes(directChildInfo.item.children)
						}

						newSelectedIds = selectedArray
							.filter((id) => id !== selectedAncestorId)
							.concat(siblingIds)
							.concat(branchToExpand)
					} else {
						// 没有找到被选中的祖先（理论上不应该发生）
						// 文件夹的所有子级都被单独选中
						if (item.is_directory && info) {
							const descendantSet = new Set(info.descendantIds)
							newSelectedIds = selectedArray.filter((id) => !descendantSet.has(id))
						} else {
							newSelectedIds = selectedArray
						}
					}
				}
			}
			// 情况3：半选 → 全选（清除所有子级选中状态，只保留当前节点）
			else if (checkState === "indeterminate") {
				const selectedArray = Array.from(selectedItems)
				const info = fileIndexMap.get(itemId)
				if (info) {
					const descendantSet = new Set(info.descendantIds)
					newSelectedIds = selectedArray
						.filter((id) => !descendantSet.has(id))
						.concat([itemId])
				} else {
					newSelectedIds = selectedArray
				}
			} else {
				return
			}

			setSelectedItems(new Set(newSelectedIds))
		},
		[getItemId, getNodeCheckState, selectedItems, fileIndexMap],
	)

	// 重置选择状态
	const resetSelection = useCallback(() => {
		setSelectedItems(new Set())
	}, [])

	// 进入多选模式并选中当前项
	const handleEnterMultiSelectMode = useCallback(
		(item: AttachmentItem) => {
			// 进入多选模式
			if (!isSelectMode) {
				onSelectModeChange?.(true)
			}
			// 选中当前项
			handleItemSelect(item)
		},
		[isSelectMode, onSelectModeChange, handleItemSelect],
	)

	return {
		// 状态
		selectedItems,
		setSelectedItems,

		// 处理函数
		handleItemSelect,
		getAllItemIds,
		getFolderSelectionState,
		isItemDisabled,
		resetSelection,
		handleEnterMultiSelectMode,
		isItemSelected,
	}
}
