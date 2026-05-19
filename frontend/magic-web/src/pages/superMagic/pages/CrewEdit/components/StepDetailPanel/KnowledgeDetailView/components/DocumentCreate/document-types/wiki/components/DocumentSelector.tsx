import { useMemoizedFn, useRequest } from "ahooks"
import { FileText, Folder, ChevronRight, ChevronDown } from "lucide-react"
import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { cn } from "@/lib/utils"
import { KnowledgeApi } from "@/apis"
import type { SourceBindingNode } from "@/types/source-binding"
import { SourceType, ParentType, ProviderType, SourceBindingNodeType } from "@/types/source-binding"

export interface DocumentSelectorProps {
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
 * Wiki 文档选择器组件
 * 树形结构展示企业知识库的文档和文件夹,支持多选和懒加载
 */
export function DocumentSelector({
	knowledgeBaseRef,
	selectedFileIds,
	onSelectionChange,
	disabled = false,
	showSelectAll = true,
	className,
}: DocumentSelectorProps) {
	const { t } = useTranslation("crew/create")

	// 展开的文件夹集合
	const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

	// 已加载的节点数据缓存
	const [nodesCache, setNodesCache] = useState<Map<string, SourceBindingNode[]>>(new Map())

	// 所有节点信息缓存(用于获取选中节点的完整信息)
	const [allNodesMap, setAllNodesMap] = useState<Map<string, SourceBindingNode>>(new Map())

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
			nodes.forEach((node) => {
				setAllNodesMap((prev) => new Map(prev).set(node.node_ref, node))
			})
			return nodes
		},
		{
			refreshDeps: [knowledgeBaseRef],
		},
	)

	// 加载文件夹子节点
	const { run: loadFolderChildren, loading: folderLoading } = useRequest(
		async (folderRef: string) => {
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
			nodes.forEach((node) => {
				setAllNodesMap((prev) => new Map(prev).set(node.node_ref, node))
			})
			return nodes
		},
		{
			manual: true,
		},
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
				loadFolderChildren(folderRef)
			}
		}
		setExpandedFolders(newExpanded)
	})

	/**
	 * 切换节点选中状态
	 */
	const toggleSelection = useMemoizedFn((nodeRef: string, e: React.MouseEvent) => {
		e.stopPropagation()
		if (disabled) return

		const newSelection = new Set(selectedFileIds)
		if (newSelection.has(nodeRef)) {
			newSelection.delete(nodeRef)
		} else {
			newSelection.add(nodeRef)
		}

		const selectedIds = Array.from(newSelection)
		const selectedNodes = selectedIds
			.map((id) => allNodesMap.get(id))
			.filter((node): node is SourceBindingNode => node !== undefined)

		onSelectionChange(selectedIds, selectedNodes)
	})

	/**
	 * 全选/取消全选
	 */
	const toggleSelectAll = useMemoizedFn(() => {
		if (disabled) return

		const allSelectableNodes = rootNodes.filter((node) => node.selectable)

		if (selectedFileIds.length === allSelectableNodes.length) {
			// 全部选中时,取消全选
			onSelectionChange([], [])
		} else {
			// 未全部选中时,全选
			const allIds = allSelectableNodes.map((node) => node.node_ref)
			onSelectionChange(allIds, allSelectableNodes)
		}
	})

	// 可选择的节点总数
	const selectableCount = useMemo(() => {
		return rootNodes.filter((node) => node.selectable).length
	}, [rootNodes])

	// 是否全选
	const isAllSelected = useMemo(() => {
		return selectableCount > 0 && selectedFileIds.length === selectableCount
	}, [selectableCount, selectedFileIds.length])

	/**
	 * 渲染节点
	 */
	const renderNode = (node: SourceBindingNode, level = 0) => {
		const isFolder = node.node_type === SourceBindingNodeType.FOLDER
		const isExpanded = expandedFolders.has(node.node_ref)
		const isSelected = selectedFileIds.includes(node.node_ref)
		const children = nodesCache.get(node.node_ref) || []

		return (
			<div key={node.node_ref}>
				<div
					className={cn(
						"group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-accent",
						isSelected && "bg-accent/50",
						disabled && "cursor-not-allowed opacity-50",
					)}
					style={{ paddingLeft: `${level * 16 + 8}px` }}
					onClick={() => isFolder && toggleFolder(node.node_ref)}
				>
					{/* 展开/折叠图标 */}
					{isFolder && node.has_children && (
						<div className="shrink-0">
							{isExpanded ? (
								<ChevronDown className="size-4 text-muted-foreground" />
							) : (
								<ChevronRight className="size-4 text-muted-foreground" />
							)}
						</div>
					)}

					{/* Checkbox */}
					{node.selectable && (
						<Checkbox
							checked={isSelected}
							onClick={(e) => toggleSelection(node.node_ref, e)}
							disabled={disabled}
							className="shrink-0"
						/>
					)}

					{/* 文件/文件夹图标 */}
					{isFolder ? (
						<Folder className="size-4 shrink-0 text-muted-foreground" />
					) : (
						<FileText className="size-4 shrink-0 text-muted-foreground" />
					)}

					{/* 节点名称 */}
					<span className="flex-1 truncate text-sm">{node.name}</span>
				</div>

				{/* 子节点 */}
				{isFolder && isExpanded && (
					<div>
						{folderLoading && !nodesCache.has(node.node_ref) ? (
							<div className="flex items-center justify-center py-4">
								<Spinner className="animate-spin" size={16} />
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
	}

	return (
		<div className={cn("flex h-full flex-col", className)}>
			{/* 全选按钮 */}
			{showSelectAll && selectableCount > 0 && (
				<div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
					<span className="text-xs text-muted-foreground">
						{t("documentCreate.common.selectedCount", {
							count: selectedFileIds.length,
							total: selectableCount,
						})}
					</span>
					<button
						type="button"
						onClick={toggleSelectAll}
						disabled={disabled}
						className="text-xs text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isAllSelected
							? t("documentCreate.common.unselectAll")
							: t("documentCreate.common.selectAll")}
					</button>
				</div>
			)}

			{/* 文档树 */}
			<ScrollArea className="flex-1">
				<div className="p-2">
					{rootLoading ? (
						<div className="flex items-center justify-center py-8">
							<Spinner className="animate-spin" size={16} />
						</div>
					) : rootNodes.length === 0 ? (
						<div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
							{t("documentCreate.common.emptyState")}
						</div>
					) : (
						rootNodes.map((node) => renderNode(node))
					)}
				</div>
			</ScrollArea>
		</div>
	)
}
