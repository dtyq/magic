import { memo, useState, useMemo, useCallback, useRef } from "react"
import { useRequest, useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import MagicIcon from "@/components/base/MagicIcon"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react"
import { KnowledgeApi } from "@/apis"
import type { SourceBindingNode } from "@/types/source-binding"
import { SourceType, ParentType, ProviderType, SourceBindingNodeType } from "@/types/source-binding"
import FoldIcon from "@/pages/superMagic/assets/svg/file-folder.svg"
import { CheckboxState } from "@/pages/superMagic/components/Share/FileSelector/types"
import { cn } from "@/lib/utils"

export interface WikiFileSelectorProps {
	/** 知识库引用ID */
	knowledgeBaseRef: string
	/** 选中的文档/文件夹 node_ref 数组 */
	selectedFileIds: string[]
	/** 选择变化回调 */
	onSelectionChange: (fileIds: string[], nodes: SourceBindingNode[]) => void
	/** 是否禁用 */
	disabled?: boolean
	/** 是否显示全选按钮 */
	showSelectAll?: boolean
	/** 自定义类名 */
	className?: string
}

/**
 * Wiki 文件选择器组件
 *
 * **勾选逻辑核心概念（与 useFileSelection 保持一致）：**
 * 1. **视图与状态分离**：显示为选中的节点可能是因为父级被选中（间接选中），而非自己真正被选中
 * 2. **父子级联动**：当父级被选中时，所有子级自动继承选中状态
 * 3. **智能取消逻辑**：取消一个间接选中的节点时，需要展开其祖先选择，保留其他兄弟节点
 * 4. **懒加载适配**：与 FileSelector 不同，Wiki 数据是懒加载的，仅在已加载节点中计算状态
 *
 * UI 和勾选逻辑与 FileSelector 一致，但支持懒加载展开
 */
export default memo(function WikiFileSelector({
	knowledgeBaseRef,
	selectedFileIds,
	onSelectionChange,
	disabled = false,
	showSelectAll = false,
	className,
}: WikiFileSelectorProps) {
	const { t } = useTranslation("crew/create")
	const treeAreaRef = useRef<HTMLDivElement>(null)

	// 展开的文件夹集合
	const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

	// 已加载的节点数据缓存: key 为 parent_ref，value 为子节点列表
	const [nodesCache, setNodesCache] = useState<Map<string, SourceBindingNode[]>>(new Map())

	// 所有节点信息缓存(用于获取选中节点的完整信息)
	const [allNodesMap, setAllNodesMap] = useState<Map<string, SourceBindingNode>>(new Map())

	// 当前正在加载的文件夹
	const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set())

	// 加载根目录文档
	const { data: rootNodes = [], loading: rootLoading } = useRequest(
		async () => {
			const res = await KnowledgeApi.getSourceBindingNodes({
				source_type: SourceType.ENTERPRISE_KNOWLEDGE_BASE,
				provider: ProviderType.TEAMSHARE,
				parent_type: ParentType.KNOWLEDGE_BASE,
				parent_ref: knowledgeBaseRef,
			})
			const nodes = res?.list || []
			// 缓存根节点
			setNodesCache((prev) => new Map(prev).set("root", nodes))
			// 缓存节点信息
			const newMap = new Map(allNodesMap)
			nodes.forEach((node) => {
				newMap.set(node.node_ref, node)
			})
			setAllNodesMap(newMap)
			return nodes
		},
		{
			refreshDeps: [knowledgeBaseRef],
		},
	)

	/**
	 * 加载文件夹子节点
	 */
	const loadFolderChildren = useCallback(
		async (folderRef: string) => {
			// 如果已经在加载，直接返回
			if (loadingFolders.has(folderRef)) return

			setLoadingFolders((prev) => new Set(prev).add(folderRef))

			try {
				const res = await KnowledgeApi.getSourceBindingNodes({
					source_type: SourceType.ENTERPRISE_KNOWLEDGE_BASE,
					provider: ProviderType.TEAMSHARE,
					parent_type: ParentType.FOLDER,
					parent_ref: folderRef,
				})
				const nodes = res?.list || []

				// 缓存子节点
				setNodesCache((prev) => new Map(prev).set(folderRef, nodes))

				// 缓存节点信息
				setAllNodesMap((prev) => {
					const newMap = new Map(prev)
					nodes.forEach((node) => {
						newMap.set(node.node_ref, node)
					})
					return newMap
				})
			} finally {
				setLoadingFolders((prev) => {
					const newSet = new Set(prev)
					newSet.delete(folderRef)
					return newSet
				})
			}
		},
		[loadingFolders],
	)

	/**
	 * 切换文件夹展开/折叠
	 */
	const toggleFolder = useMemoizedFn((folderRef: string) => {
		const newExpanded = new Set(expandedFolders)
		if (newExpanded.has(folderRef)) {
			newExpanded.delete(folderRef)
		} else {
			newExpanded.add(folderRef)
			// 如果还没有加载子节点,则加载
			if (!nodesCache.has(folderRef)) {
				void loadFolderChildren(folderRef)
			}
		}
		setExpandedFolders(newExpanded)
	})

	/**
	 * 构建文件索引映射表 - 用于快速查询节点关系
	 */
	const fileIndexMap = useMemo(() => {
		const map = new Map<
			string,
			{
				node: SourceBindingNode
				parentId: string | null
				ancestorIds: string[]
				descendantIds: string[]
			}
		>()

		// 递归构建索引
		const buildIndex = (
			nodes: SourceBindingNode[],
			parentId: string | null,
			ancestors: string[],
		) => {
			for (const node of nodes) {
				// 收集所有后代ID（仅在已加载的节点中）
				const descendantIds: string[] = []
				const collectDescendants = (nodeRef: string) => {
					const children = nodesCache.get(nodeRef) || []
					for (const child of children) {
						descendantIds.push(child.node_ref)
						if (
							child.node_type === SourceBindingNodeType.FOLDER &&
							nodesCache.has(child.node_ref)
						) {
							collectDescendants(child.node_ref)
						}
					}
				}

				if (
					node.node_type === SourceBindingNodeType.FOLDER &&
					nodesCache.has(node.node_ref)
				) {
					collectDescendants(node.node_ref)
				}

				map.set(node.node_ref, {
					node,
					parentId,
					ancestorIds: ancestors,
					descendantIds,
				})

				// 递归处理子节点
				const children = nodesCache.get(node.node_ref)
				if (children) {
					buildIndex(children, node.node_ref, [...ancestors, node.node_ref])
				}
			}
		}

		buildIndex(rootNodes, null, [])
		return map
	}, [rootNodes, nodesCache])

	/**
	 * 检查节点是否被选中（包括父级选中的情况）
	 */
	const isNodeSelected = useCallback(
		(nodeRef: string): boolean => {
			if (selectedFileIds.includes(nodeRef)) return true

			const info = fileIndexMap.get(nodeRef)
			if (!info) return false

			// 检查祖先是否被选中
			return info.ancestorIds.some((id) => selectedFileIds.includes(id))
		},
		[selectedFileIds, fileIndexMap],
	)

	/**
	 * 计算节点的 checkbox 状态（后序遍历）
	 */
	const nodeCheckStates = useMemo(() => {
		const states = new Map<string, CheckboxState>()
		const selectedSet = new Set(selectedFileIds)

		const calculateState = (nodeRef: string): CheckboxState => {
			const info = fileIndexMap.get(nodeRef)
			if (!info) return CheckboxState.Unchecked

			const isFolder = info.node.node_type === SourceBindingNodeType.FOLDER

			// 文件节点：检查是否被选中（含父级）
			if (!isFolder) {
				return isNodeSelected(nodeRef) ? CheckboxState.Checked : CheckboxState.Unchecked
			}

			// 文件夹本身被选中，需要递归设置所有子节点的状态
			if (selectedSet.has(nodeRef)) {
				// 递归标记所有子节点为选中状态
				const children = nodesCache.get(nodeRef) || []
				const markChildrenChecked = (childNodes: SourceBindingNode[]) => {
					for (const child of childNodes) {
						states.set(child.node_ref, CheckboxState.Checked)
						// 递归处理子节点的子节点
						const grandChildren = nodesCache.get(child.node_ref)
						if (grandChildren && grandChildren.length > 0) {
							markChildrenChecked(grandChildren)
						}
					}
				}
				if (children.length > 0) {
					markChildrenChecked(children)
				}
				return CheckboxState.Checked
			}

			// 检查子级状态（仅当已加载子节点时）
			const children = nodesCache.get(nodeRef) || []
			if (children.length === 0) {
				// 未加载子节点或空文件夹，检查自己是否被选中
				return isNodeSelected(nodeRef) ? CheckboxState.Checked : CheckboxState.Unchecked
			}

			let checkedCount = 0
			let indeterminateFound = false

			for (const child of children) {
				// 先计算子节点状态（后序遍历）
				const childState = states.get(child.node_ref) || calculateState(child.node_ref)
				states.set(child.node_ref, childState)

				if (childState === CheckboxState.Checked) {
					checkedCount++
				} else if (childState === CheckboxState.Indeterminate) {
					indeterminateFound = true
				}
			}

			if (indeterminateFound || (checkedCount > 0 && checkedCount < children.length)) {
				return CheckboxState.Indeterminate
			}
			return checkedCount === children.length
				? CheckboxState.Checked
				: CheckboxState.Unchecked
		}

		// 后序遍历计算所有根节点的状态
		rootNodes.forEach((node) => {
			states.set(node.node_ref, calculateState(node.node_ref))
		})

		return states
	}, [selectedFileIds, rootNodes, fileIndexMap, nodesCache, isNodeSelected])

	/**
	 * 处理节点选中切换
	 */
	const handleFileToggle = useCallback(
		(nodeRef: string) => {
			const info = fileIndexMap.get(nodeRef)
			if (!info) return

			const checkState = nodeCheckStates.get(nodeRef) || CheckboxState.Unchecked
			let newSelectedIds: string[]

			// 情况1: 未选中 → 选中
			if (checkState === CheckboxState.Unchecked) {
				newSelectedIds = [nodeRef, ...selectedFileIds]
			}
			// 情况2: 全选中 → 取消
			else if (checkState === CheckboxState.Checked) {
				const selectedSet = new Set(selectedFileIds)

				if (selectedSet.has(nodeRef)) {
					// 直接选中的节点 - 直接移除
					newSelectedIds = selectedFileIds.filter((id) => id !== nodeRef)
				} else {
					// 因父级选中而间接选中的节点 - 需要向上查找真正被选中的祖先
					// 向上查找第一个被选中的祖先
					let selectedAncestorId: string | null = null
					let ancestorIndex = -1

					for (let i = info.ancestorIds.length - 1; i >= 0; i--) {
						const ancestorId = info.ancestorIds[i]
						if (selectedSet.has(ancestorId)) {
							selectedAncestorId = ancestorId
							ancestorIndex = i
							break
						}
					}

					if (selectedAncestorId) {
						// 找到了被选中的祖先，取消该祖先，展开除当前节点所在路径外的其他节点
						// 从 ancestorIds 中直接获取直接子节点
						const directChildOfAncestor = info.ancestorIds[ancestorIndex + 1] || nodeRef

						// 获取祖先的所有直接子节点ID（排除当前节点所在的分支）
						const ancestorChildren = nodesCache.get(selectedAncestorId) || []
						const siblingIds = ancestorChildren
							.map((child) => child.node_ref)
							.filter((id) => id !== directChildOfAncestor)

						// 展开 directChildOfAncestor 分支，选中除当前取消节点外的所有节点
						const branchToExpand: string[] = []
						const directChildInfo = fileIndexMap.get(directChildOfAncestor)
						if (directChildInfo && directChildInfo.descendantIds.length > 0) {
							// 递归收集该分支下所有已加载的节点，但排除当前取消选中的节点及其后代
							const excludeSet = new Set([nodeRef, ...info.descendantIds])
							const collectBranchNodes = (nodeRef: string) => {
								const children = nodesCache.get(nodeRef) || []
								for (const child of children) {
									if (!excludeSet.has(child.node_ref)) {
										branchToExpand.push(child.node_ref)
										if (
											child.node_type === SourceBindingNodeType.FOLDER &&
											nodesCache.has(child.node_ref)
										) {
											collectBranchNodes(child.node_ref)
										}
									}
								}
							}
							collectBranchNodes(directChildOfAncestor)
						}

						newSelectedIds = selectedFileIds
							.filter((id) => id !== selectedAncestorId)
							.concat(siblingIds)
							.concat(branchToExpand)
					} else {
						// 没有找到被选中的祖先（理论上不应该发生）
						// 文件夹的所有子级都被单独选中
						if (info.node.node_type === SourceBindingNodeType.FOLDER) {
							const descendantSet = new Set(info.descendantIds)
							newSelectedIds = selectedFileIds.filter((id) => !descendantSet.has(id))
						} else {
							newSelectedIds = selectedFileIds
						}
					}
				}
			}
			// 情况3: 半选 → 全选（清除所有子级选中状态，只保留当前节点）
			else if (checkState === CheckboxState.Indeterminate) {
				const descendantSet = new Set(info.descendantIds)
				newSelectedIds = selectedFileIds
					.filter((id) => !descendantSet.has(id))
					.concat([nodeRef])
			} else {
				return
			}

			// 构建新的选中节点列表
			const newSelectedNodes = newSelectedIds
				.map((id) => allNodesMap.get(id))
				.filter((n): n is SourceBindingNode => n !== undefined)

			onSelectionChange(newSelectedIds, newSelectedNodes)
		},
		[
			fileIndexMap,
			nodeCheckStates,
			selectedFileIds,
			allNodesMap,
			nodesCache,
			onSelectionChange,
		],
	)

	/**
	 * 全选/取消全选
	 */
	const handleSelectAll = useCallback(() => {
		if (disabled) return

		const rootItemIds = rootNodes.map((node) => node.node_ref)

		if (rootItemIds.length === 0) return

		const allChecked = rootItemIds.every(
			(id) => nodeCheckStates.get(id) === CheckboxState.Checked,
		)

		let newSelectedIds: string[]
		if (allChecked) {
			// 全选 → 取消全选（只取消根节点）
			const rootSet = new Set(rootItemIds)
			newSelectedIds = selectedFileIds.filter((id) => !rootSet.has(id))
		} else {
			// 未全选 → 全选（只选中根节点，子节点会自动继承）
			const existingIds = new Set(selectedFileIds)
			rootItemIds.forEach((id) => existingIds.add(id))
			newSelectedIds = Array.from(existingIds)
		}

		const newSelectedNodes = newSelectedIds
			.map((id) => allNodesMap.get(id))
			.filter((n): n is SourceBindingNode => n !== undefined)

		onSelectionChange(newSelectedIds, newSelectedNodes)
	}, [disabled, rootNodes, nodeCheckStates, selectedFileIds, allNodesMap, onSelectionChange])

	// 计算全选状态
	const selectAllState = useMemo(() => {
		if (!showSelectAll || rootNodes.length === 0) return CheckboxState.Unchecked

		const rootItemIds = rootNodes.map((node) => node.node_ref)
		let checkedCount = 0
		let indeterminateFound = false

		for (const itemId of rootItemIds) {
			const state = nodeCheckStates.get(itemId)
			if (state === CheckboxState.Checked) {
				checkedCount++
			} else if (state === CheckboxState.Indeterminate) {
				indeterminateFound = true
			}
		}

		if (indeterminateFound || (checkedCount > 0 && checkedCount < rootItemIds.length)) {
			return CheckboxState.Indeterminate
		}
		return checkedCount === rootItemIds.length ? CheckboxState.Checked : CheckboxState.Unchecked
	}, [showSelectAll, rootNodes, nodeCheckStates])

	/**
	 * 渲染节点
	 */
	const renderNode = useCallback(
		(node: SourceBindingNode, level = 0) => {
			const isFolder = node.node_type === SourceBindingNodeType.FOLDER
			const isExpanded = expandedFolders.has(node.node_ref)
			const isLoading = loadingFolders.has(node.node_ref)
			const children = nodesCache.get(node.node_ref) || []

			const checkState = nodeCheckStates.get(node.node_ref) || CheckboxState.Unchecked
			const checkedValue =
				checkState === CheckboxState.Checked
					? true
					: checkState === CheckboxState.Indeterminate
						? "indeterminate"
						: false

			const indentWidth = level * 10

			return (
				<div key={node.node_ref}>
					<div
						className={cn(
							"relative flex items-center rounded-md pl-1 transition-colors",
							disabled ? "cursor-default" : "cursor-pointer hover:bg-fill",
						)}
						onClick={(e) => {
							if (disabled) return
							e.stopPropagation()
							if (isFolder) {
								toggleFolder(node.node_ref)
							} else {
								handleFileToggle(node.node_ref)
							}
						}}
					>
						<div
							className="flex h-7 w-full items-center gap-2 py-1.5 pl-1 pr-2"
							style={{ paddingLeft: `${indentWidth}px` }}
						>
							{/* Expand/collapse icon */}
							<div className="flex shrink-0 items-center justify-center">
								{isFolder && node.has_children ? (
									<MagicIcon
										component={isExpanded ? IconChevronDown : IconChevronRight}
										size={16}
										stroke={1.5}
										style={{
											cursor: disabled ? "default" : "pointer",
											color: "rgba(28, 29, 35, 0.6)",
										}}
										onClick={(e: React.MouseEvent) => {
											if (!disabled) {
												e.stopPropagation()
												toggleFolder(node.node_ref)
											}
										}}
									/>
								) : (
									<div style={{ width: 16, height: 16 }} />
								)}
							</div>

							{/* Checkbox */}
							{!disabled && (
								<div className="flex shrink-0 items-center justify-center">
									<Checkbox
										checked={checkedValue}
										onCheckedChange={() => {
											handleFileToggle(node.node_ref)
										}}
										onClick={(e) => e.stopPropagation()}
									/>
								</div>
							)}

							{/* File/Folder icon */}
							<div className="flex shrink-0 items-center justify-center [&_img]:shrink-0">
								{isFolder ? (
									<img
										src={FoldIcon as unknown as string}
										alt="folder"
										width={16}
										height={16}
									/>
								) : (
									<MagicFileIcon type={node.meta?.extension} size={16} />
								)}
							</div>

							{/* File name */}
							<div className="flex-1 select-none overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-5 text-foreground/80">
								{node.name}
							</div>
						</div>
					</div>

					{/* 子节点 */}
					{isFolder && isExpanded && (
						<div>
							{isLoading && !nodesCache.has(node.node_ref) ? (
								<div
									className="flex items-center justify-center py-4"
									style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
								>
									<Loader2 className="size-4 animate-spin" />
								</div>
							) : children.length > 0 ? (
								children.map((child) => renderNode(child, level + 1))
							) : (
								<div
									className="py-2 text-center text-xs text-muted-foreground"
									style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
								>
									{t("documentCreate.common.emptyState")}
								</div>
							)}
						</div>
					)}
				</div>
			)
		},
		[
			expandedFolders,
			loadingFolders,
			nodesCache,
			nodeCheckStates,
			disabled,
			toggleFolder,
			handleFileToggle,
			t,
		],
	)

	return (
		<div className={cn("flex h-full flex-col rounded-bl-[12px] bg-background p-2", className)}>
			{/* Select All Checkbox */}
			{showSelectAll && !disabled && rootNodes.length > 0 && (
				<div className="flex items-center gap-2 px-2 py-1.5">
					<Checkbox
						checked={
							selectAllState === CheckboxState.Checked
								? true
								: selectAllState === CheckboxState.Indeterminate
									? "indeterminate"
									: false
						}
						onCheckedChange={handleSelectAll}
					/>
					<span className="text-sm text-muted-foreground">
						{t("documentCreate.common.selectAll")}
					</span>
				</div>
			)}

			{/* File tree */}
			<div
				ref={treeAreaRef}
				className={cn(
					"min-h-0 flex-1 overflow-y-auto overflow-x-hidden",
					// Custom scrollbar
					"[&::-webkit-scrollbar]:w-1",
					"[&::-webkit-scrollbar-track]:bg-transparent",
					"[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border",
					// File title height
					"[&_.magic-file-title]:h-8",
				)}
			>
				{rootLoading ? (
					<div className="flex h-full items-center justify-center p-5 text-center text-xs leading-4 text-muted-foreground">
						<Loader2 className="size-4 animate-spin" />
					</div>
				) : rootNodes.length === 0 ? (
					<div className="flex h-full items-center justify-center p-5 text-center text-xs leading-4 text-muted-foreground">
						{t("documentCreate.common.emptyState")}
					</div>
				) : (
					rootNodes.map((node) => renderNode(node))
				)}
			</div>
		</div>
	)
})
