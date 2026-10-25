import { useState, useEffect, useMemo, useCallback } from "react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { AttachmentItem } from "./types"
import type { AttachmentIndex } from "../utils/attachmentIndex"
import {
	buildSelectionCheckStates,
	countSelectedVisibleItems,
	getBranchSelectionIds,
	getNearestSelectedAncestor,
	getSelectionChildIds,
	getSelectionDescendantIds,
	getSelectionIdsByKeys,
	hasSelectedAncestor,
	type FileSelectionCheckState,
} from "../utils/fileSelectionIndex"
import {
	measureSelectAll,
	measureSelectedCountCompute,
	measureSelectionCompute,
	measureSelectionToggle,
} from "./useFileSelectionPerf"

const EMPTY_NODE_CHECK_STATES = new Map<string, FileSelectionCheckState>()
const DEFAULT_ITEM_SELECTABLE = () => true

interface UseFileSelectionOptions {
	listenGlobalEvents?: boolean
	projectId?: string
	getItemId: (item: AttachmentItem) => string
	treeIndex: AttachmentIndex
	isSelectMode: boolean
	selectionEnabled?: boolean
	onSelectionChange?: (selectedCount: number, totalCount: number) => void
	onSelectModeChange?: (isSelectMode: boolean) => void
	/** 判断节点是否允许进入多选集合。 */
	isItemSelectable?: (item: AttachmentItem) => boolean
}

/**
 * useFileSelection - 处理文件选择相关逻辑
 */
export function useFileSelection(options: UseFileSelectionOptions) {
	const {
		projectId,
		getItemId,
		treeIndex,
		isSelectMode,
		selectionEnabled = isSelectMode,
		onSelectionChange,
		onSelectModeChange,
		isItemSelectable = DEFAULT_ITEM_SELECTABLE,
	} = options
	const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

	/** 计算当前文件空间可参与多选的节点总数。 */
	const selectableItemCount = useMemo(() => {
		return treeIndex.allKeys.reduce((count, key) => {
			const item = treeIndex.getItemByKey(key)
			return item && isItemSelectable(item) ? count + 1 : count
		}, 0)
	}, [isItemSelectable, treeIndex])

	/** 收集每个可选分支的最高层节点，避免选中固定空间根目录。 */
	const selectableBranchRootKeys = useMemo(() => {
		const result: string[] = []
		const pendingKeys = [...treeIndex.rootKeys].reverse()

		while (pendingKeys.length > 0) {
			const key = pendingKeys.pop()
			if (!key) continue

			const item = treeIndex.getItemByKey(key)
			if (item && isItemSelectable(item)) {
				result.push(key)
				continue
			}

			const childKeys = treeIndex.getChildKeysByKey(key)
			for (let index = childKeys.length - 1; index >= 0; index -= 1) {
				pendingKeys.push(childKeys[index])
			}
		}

		return result
	}, [isItemSelectable, treeIndex])

	// 当 projectId 变更时，清空 selectedItems
	useEffect(() => {
		setSelectedItems(new Set())
	}, [projectId])

	// Check selection, including parent inheritance.
	const isItemSelected = useCallback(
		(itemId: string): boolean => {
			if (!selectionEnabled) return false

			if (selectedItems.has(itemId)) return true
			return hasSelectedAncestor(treeIndex, itemId, selectedItems, getItemId)
		},
		[selectionEnabled, selectedItems, treeIndex, getItemId],
	)

	// 一次性计算所有节点的勾选状态 - 使用后序遍历（参考 FileSelector 的高性能实现）
	const nodeCheckStates = useMemo(() => {
		if (!selectionEnabled) {
			return EMPTY_NODE_CHECK_STATES
		}

		return measureSelectionCompute(treeIndex.totalCount, selectedItems.size, () => {
			return buildSelectionCheckStates(treeIndex, selectedItems, getItemId)
		})
	}, [selectionEnabled, selectedItems, treeIndex, getItemId])

	// 获取节点的勾选状态（直接从缓存的 Map 中查询）
	const getNodeCheckState = useCallback(
		(itemId: string): FileSelectionCheckState => {
			return nodeCheckStates.get(itemId) || "unchecked"
		},
		[nodeCheckStates],
	)

	// 计算实际选中的文件数量 - 增量计算优化
	const selectedCount = useMemo(() => {
		if (!selectionEnabled) {
			return 0
		}

		return measureSelectedCountCompute(selectedItems.size, treeIndex.totalCount, () => {
			return countSelectedVisibleItems(treeIndex, selectedItems, getItemId)
		})
	}, [selectionEnabled, selectedItems, treeIndex, getItemId])

	// 监听选择状态变化并通知父组件
	useEffect(() => {
		if (!selectionEnabled) {
			return
		}

		if (onSelectionChange) {
			onSelectionChange(selectedCount, selectableItemCount)
		}
	}, [selectionEnabled, selectedCount, selectableItemCount, onSelectionChange])

	const handleSelectAll = () => {
		if (!isSelectMode) return

		measureSelectAll(selectableBranchRootKeys.length, () => {
			// 选择每个可选分支的最高层节点，由父级选中状态覆盖其后代。
			const rootFileIds = getSelectionIdsByKeys(
				treeIndex,
				selectableBranchRootKeys,
				getItemId,
			)
			setSelectedItems(new Set(rootFileIds))
			return rootFileIds
		})
	}

	const handleDeselectAll = () => {
		setSelectedItems(new Set())
	}

	// 用户目录由所属 Panel 直接调用；项目保留原有全局事件入口。
	useEffect(() => {
		if (options.listenGlobalEvents === false) return
		pubsub.subscribe(PubSubEvents.Select_All_Files, handleSelectAll)
		pubsub.subscribe(PubSubEvents.Deselect_All_Files, handleDeselectAll)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Select_All_Files, handleSelectAll)
			pubsub.unsubscribe(PubSubEvents.Deselect_All_Files, handleDeselectAll)
		}
	}, [options.listenGlobalEvents, getItemId, isSelectMode, selectableBranchRootKeys, treeIndex])

	// 递归获取文件夹下所有子项ID（包括文件和文件夹）
	const getAllItemIds = (folder: AttachmentItem): string[] => {
		const folderId = getItemId(folder)
		return getSelectionDescendantIds(treeIndex, folderId, getItemId)
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
	const isItemDisabled = (item: AttachmentItem): boolean => {
		return !isItemSelectable(item)
	}

	// 处理项目选择 - 使用优化后的查询函数
	const handleItemSelect = useCallback(
		(item: AttachmentItem) => {
			if (!isItemSelectable(item)) return

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
					// 向上查找第一个被选中的祖先
					const selectedAncestor = getNearestSelectedAncestor(
						treeIndex,
						itemId,
						selectedSet,
						getItemId,
					)

					if (selectedAncestor) {
						// 找到了被选中的祖先，取消该祖先，展开除当前节点所在路径外的其他节点
						const { selectedAncestorId, directChildId, directChildKey } =
							selectedAncestor

						// 获取祖先的所有子节点ID（排除当前节点所在的分支）
						const siblingIds = getSelectionChildIds(
							treeIndex,
							selectedAncestorId,
							getItemId,
						).filter((id) => id !== directChildId)

						// 展开 directChildOfAncestor 分支，选中除当前取消节点外的所有节点
						const excludeSet = new Set([
							itemId,
							...getSelectionDescendantIds(treeIndex, itemId, getItemId),
						])
						const branchToExpand = getBranchSelectionIds(
							treeIndex,
							directChildKey,
							excludeSet,
							getItemId,
						)

						newSelectedIds = selectedArray
							.filter((id) => id !== selectedAncestorId)
							.concat(siblingIds)
							.concat(branchToExpand)
					} else {
						// 没有找到被选中的祖先（理论上不应该发生）
						// 文件夹的所有子级都被单独选中
						if (item.is_directory) {
							const descendantSet = new Set(
								getSelectionDescendantIds(treeIndex, itemId, getItemId),
							)
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
				const descendantSet = new Set(
					getSelectionDescendantIds(treeIndex, itemId, getItemId),
				)
				newSelectedIds = selectedArray
					.filter((id) => !descendantSet.has(id))
					.concat([itemId])
			} else {
				return
			}

			measureSelectionToggle(
				{
					previousSelectedCount: selectedItems.size,
					checkState,
					isDirectory: Boolean(item.is_directory),
				},
				() => {
					setSelectedItems(new Set(newSelectedIds))
					return newSelectedIds
				},
			)
		},
		[getItemId, getNodeCheckState, isItemSelectable, selectedItems, treeIndex],
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
		handleSelectAll,
		handleDeselectAll,
		handleEnterMultiSelectMode,
		isItemSelected,
	}
}
