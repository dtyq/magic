import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { TopicFileIcon } from "@/pages/superMagic/components/TopicFilesButton/components/TopicFileIcon"
import type { SelectedFileHierarchyNode } from "../types"

interface SelectedFilesHierarchySectionProps {
	hierarchy: SelectedFileHierarchyNode[]
	totalCount: number
	testId: string
}

/**
 * 递归统计单个文件夹节点下的文件数量，用于文件夹行右侧的固定数量展示。
 */
function countNodeFiles(node: SelectedFileHierarchyNode): number {
	if (!node.isDirectory) {
		return 1
	}

	const childCount = node.children.reduce((total, child) => total + countNodeFiles(child), 0)
	return childCount > 0 ? childCount : 1
}

/**
 * 复用创建页与详情页的“已选文件”层级区块，保证标题文案、数量样式和递归展开行为保持一致。
 */
export default function SelectedFilesHierarchySection({
	hierarchy,
	totalCount,
	testId,
}: SelectedFilesHierarchySectionProps) {
	const { t } = useTranslation("super")
	const [expanded, setExpanded] = useState(false)
	const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set())

	if (totalCount === 0 || hierarchy.length === 0) {
		return null
	}

	/**
	 * 用递归渲染函数而不是组件自调用，既保留树形结构，也避开本地 lint 对组件递归的误报。
	 */
	const renderNode = (node: SelectedFileHierarchyNode, depth: number): JSX.Element => {
		const isExpandable = node.isDirectory && node.children.length > 0
		const isExpanded = expandedFolderIds.has(node.id)

		return (
			<div>
				<button
					type="button"
					className="flex h-11 w-full items-center gap-3 active:opacity-75"
					style={{ paddingLeft: 14 + depth * 20, paddingRight: 14 }}
					onClick={() => {
						if (isExpandable) {
							setExpandedFolderIds((previous) => {
								const next = new Set(previous)
								if (next.has(node.id)) {
									next.delete(node.id)
								} else {
									next.add(node.id)
								}
								return next
							})
						}
					}}
					data-testid={`project-share-sheet-selected-file-row-${node.id}`}
				>
					<TopicFileIcon
						isDirectory={node.isDirectory}
						hasChildren={node.children.length > 0}
						fileExtension={node.fileExtension}
						className="block size-4 shrink-0 object-contain"
						dataTestId={`project-share-sheet-selected-file-icon-${node.id}`}
					/>
					<span className="min-w-0 flex-1 truncate text-left text-[15px] leading-5 text-foreground">
						{node.name}
					</span>
					{node.isDirectory ? (
						<>
							<span className="shrink-0 text-[13px] leading-4 text-[#8A8A8A]">
								{countNodeFiles(node)}
							</span>
							{isExpandable ? (
								<ChevronDown
									className={cn(
										"h-4 w-4 shrink-0 text-[#8A8A8A] transition-transform",
										isExpanded && "rotate-180",
									)}
								/>
							) : null}
						</>
					) : null}
				</button>
				{isExpandable && isExpanded ? (
					<div>
						{node.children.map((child) => (
							<div key={child.id}>
								<div className="h-px bg-border" />
								{renderNode(child, depth + 1)}
							</div>
						))}
					</div>
				) : null}
			</div>
		)
	}

	return (
		<div className="overflow-hidden rounded-[14px] bg-white">
			<button
				type="button"
				className="flex h-12 w-full items-center gap-3 px-3.5 text-left active:opacity-75"
				onClick={() => setExpanded((value) => !value)}
				data-testid={testId}
			>
				<span className="flex-1 text-[15px] leading-5 text-foreground">
					{t("projectShare.selectedFilesLabel")}
				</span>
				<span className="shrink-0 text-[13px] leading-4 text-[#8A8A8A]">{totalCount}</span>
				<ChevronDown
					className={cn(
						"h-4 w-4 shrink-0 text-[#8A8A8A] transition-transform",
						expanded && "rotate-180",
					)}
				/>
			</button>
			{expanded ? (
				<div className="border-t border-border">
					{hierarchy.map((node, index) => (
						<div key={node.id}>
							{index > 0 ? <div className="h-px bg-border" /> : null}
							{renderNode(node, 0)}
						</div>
					))}
				</div>
			) : null}
		</div>
	)
}
