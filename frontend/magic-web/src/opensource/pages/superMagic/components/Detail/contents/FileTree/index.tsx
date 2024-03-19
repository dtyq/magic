import { memo, useState, useMemo, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Flex } from "antd"
import {
	IconChevronDown,
	IconChevronRight,
	IconCornerLeftUp,
	IconCornerRightDown,
} from "@tabler/icons-react"
import { useResponsive } from "ahooks"
import CommonHeaderV2 from "../../components/CommonHeaderV2"
import MagicFileIcon from "@/opensource/components/base/MagicFileIcon"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { formatFileSize, formatTime } from "@/opensource/utils/string"
import { useStyles } from "./styles"
import { ActionButton } from "../../components/CommonHeader/components"
import type { DetailFileTreeData, FileTreeNode } from "../../types"
import FoldIcon from "@/opensource/pages/superMagic/assets/svg/file-folder.svg"
import EmptyFiles from "@/opensource/pages/superMagic/assets/svg/empty-files.svg"
import { cx } from "antd-style"

interface FileTreeProps {
	data: DetailFileTreeData
	userSelectDetail: any
	setUserSelectDetail?: (detail: any) => void
	isFromNode?: boolean
	onClose?: () => void
	// Props from Render component
	type?: string
	currentIndex?: number
	totalFiles?: number
	onPrevious?: () => void
	onNext?: () => void
	onFullscreen?: () => void
	onDownload?: () => void
	hasUserSelectDetail?: boolean
	isFullscreen?: boolean
	// New props for ActionButtons functionality
	viewMode?: "code" | "desktop" | "phone"
	onViewModeChange?: (mode: "code" | "desktop" | "phone") => void
	onCopy?: () => void
	onShare?: () => void
	onFavorite?: () => void
	fileContent?: string
	isFavorited?: boolean
	// File sharing props
	topicId?: string
	baseShareUrl?: string
	currentFile?: {
		id: string
		name: string
		type: string
		url?: string
	}
	className?: string
	// New prop for default expand state
	defaultExpandAll?: boolean
	allowEdit?: boolean
}

interface FileTreeItemProps {
	node: FileTreeNode
	level: number
	expandedNodes: Set<string>
	onToggleExpand: (path: string) => void
	isMobile?: boolean
	isAllFileType?: boolean
}

/**
 * 递归计算目录下所有文件的总大小
 */
function calculateDirectorySize(node: FileTreeNode): number {
	if (!node.is_directory) {
		return node.file_size || 0
	}

	if (!node.children || node.children.length === 0) {
		return 0
	}

	return node.children.reduce((total, child) => {
		return total + calculateDirectorySize(child)
	}, 0)
}

/**
 * 递归收集所有目录路径
 */
function collectAllDirectoryPaths(
	nodes: FileTreeNode[],
	paths: Set<string> = new Set(),
): Set<string> {
	nodes.forEach((node) => {
		if (node.is_directory && node.children && node.children.length > 0) {
			paths.add(node.relative_file_path)
			collectAllDirectoryPaths(node.children, paths)
		}
	})
	return paths
}

function FileTreeItem({
	node,
	level,
	expandedNodes,
	onToggleExpand,
	isMobile = false,
	isAllFileType = false,
}: FileTreeItemProps) {
	const { styles } = useStyles({ isAllFileType })

	const isExpanded = expandedNodes.has(node.relative_file_path)
	const isDirectory = !!node.is_directory
	const hasChildren = !!node.children && node.children.length > 0

	// 计算显示的文件大小
	const displaySize = useMemo(() => {
		if (node.is_directory) {
			const totalSize = calculateDirectorySize(node)
			return totalSize > 0 ? formatFileSize(totalSize) : "-"
		} else {
			return node.file_size ? formatFileSize(node.file_size) : "-"
		}
	}, [node])

	const handleToggle = () => {
		if (hasChildren) {
			onToggleExpand(node.relative_file_path)
		}
	}

	// 处理整行点击事件
	const handleRowClick = () => {
		// 只有目录且有子项时才响应点击
		if (isDirectory && hasChildren) {
			handleToggle()
		}
	}

	const getFileExtension = (fileName: string) => {
		if (node.is_directory) return "folder"
		const lastDot = fileName.lastIndexOf(".")
		return lastDot > 0 ? fileName.substring(lastDot + 1) : ""
	}

	// 格式化修改时间
	const formatModifiedTime = (time: string) => {
		if (!time) return "-"
		if (isMobile) {
			// 移动端使用较短的格式
			return formatTime(time, "MM/DD HH:mm")
		}
		return formatTime(time, "YYYY/MM/DD HH:mm:ss")
	}

	// 计算缩进级别的CSS变量
	const indentLevel = level
	const indentSize = isMobile ? 16 : 26

	return (
		<>
			<div
				className={cx(styles.tableRow, isDirectory && hasChildren && styles.clickableRow)}
				onClick={handleRowClick}
			>
				{/* 名称列 */}
				<div
					className={styles.nameCell}
					style={
						{
							"--indent-level": indentLevel,
							"--indent-size": `${indentSize}px`,
						} as React.CSSProperties
					}
				>
					<Flex
						align="center"
						gap={isMobile ? 4 : 8}
						className={styles.fileNameContainer}
					>
						{hasChildren ? (
							<button
								className={styles.expandButton}
								onClick={(e) => {
									e.stopPropagation() // 阻止事件冒泡
									handleToggle()
								}}
							>
								<MagicIcon
									component={isExpanded ? IconChevronDown : IconChevronRight}
									size={isMobile ? 14 : 18}
									color="currentColor"
									stroke={2}
								/>
							</button>
						) : (
							<div
								className={cx(
									styles.expandButtonPlaceholder,
									isAllFileType && styles.allFileTypeExpandButtonPlaceholder,
								)}
							/>
						)}
						<div className={styles.fileIconWrapper}>
							{isDirectory ? (
								<img src={FoldIcon} alt="folder" width={18} height={18} />
							) : (
								<MagicFileIcon
									type={getFileExtension(node.file_name)}
									size={isMobile ? 14 : 18}
								/>
							)}
						</div>
						<span className={styles.fileName} title={node.file_name}>
							{node.file_name}
						</span>
					</Flex>
				</div>

				{/* 修改时间列 - 始终显示 */}
				<div className={styles.timeCell}>
					<span className={styles.cellContent} title={node.updated_at}>
						{formatModifiedTime(node.updated_at)}
					</span>
				</div>

				{/* 大小列 */}
				<div className={styles.sizeCell}>
					<span className={styles.cellContent} title={displaySize}>
						{displaySize}
					</span>
				</div>
			</div>

			{/* 子节点 */}
			{isExpanded &&
				hasChildren &&
				node.children?.map((child) => (
					<FileTreeItem
						key={child.relative_file_path}
						node={child}
						level={level + 1}
						expandedNodes={expandedNodes}
						onToggleExpand={onToggleExpand}
						isMobile={isMobile}
					/>
				))}
		</>
	)
}

export default memo(function FileTree(props: FileTreeProps) {
	const {
		data,
		isFromNode,
		// Props from Render component
		type,
		onFullscreen,
		onDownload,
		isFullscreen,
		// New props for ActionButtons functionality
		viewMode,
		onViewModeChange,
		onCopy,
		// File sharing props
		currentFile,
		className,
		// New prop
		defaultExpandAll = true,
		allowEdit,
	} = props

	const { styles, cx } = useStyles({ isAllFileType: false })
	const { t } = useTranslation("super")
	const responsive = useResponsive()
	const isMobile = responsive.mobile

	// 获取所有目录路径
	const allDirectoryPaths = useMemo(() => {
		if (!data?.tree) return new Set<string>()
		return collectAllDirectoryPaths(data.tree)
	}, [data?.tree])

	// 初始化展开状态
	const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
		return defaultExpandAll ? new Set(allDirectoryPaths) : new Set()
	})

	// 当 defaultExpandAll 或数据变化时更新展开状态
	useEffect(() => {
		if (defaultExpandAll) {
			setExpandedNodes(new Set(allDirectoryPaths))
		}
	}, [defaultExpandAll, allDirectoryPaths])

	// 判断当前是否所有目录都已展开
	const isAllExpanded = useMemo(() => {
		return (
			allDirectoryPaths.size > 0 &&
			allDirectoryPaths.size === expandedNodes.size &&
			Array.from(allDirectoryPaths).every((path) => expandedNodes.has(path))
		)
	}, [allDirectoryPaths, expandedNodes])

	// 一键展开所有目录
	const handleExpandAll = () => {
		setExpandedNodes(new Set(allDirectoryPaths))
	}

	// 一键折叠所有目录
	const handleCollapseAll = () => {
		setExpandedNodes(new Set())
	}

	const handleToggleExpand = (path: string) => {
		const newExpanded = new Set(expandedNodes)
		if (newExpanded.has(path)) {
			newExpanded.delete(path)
		} else {
			newExpanded.add(path)
		}
		setExpandedNodes(newExpanded)
	}

	const getContentToCopy = () => {
		if (!data?.tree) return ""

		const formatTree = (nodes: FileTreeNode[], level = 0): string => {
			return nodes
				.map((node) => {
					const indent = "  ".repeat(level)
					const prefix = node.is_directory ? "📁" : "📄"
					const size = node.is_directory
						? ""
						: ` (${node.file_size ? formatFileSize(node.file_size) : "unknown"})`
					let result = `${indent}${prefix} ${node.file_name}${size}\n`

					if (node.children && node.children.length > 0) {
						result += formatTree(node.children, level + 1)
					}

					return result
				})
				.join("")
		}

		return formatTree(data.tree)
	}

	const isAllFileType = useMemo(() => {
		return data?.tree?.every((node) => node.is_directory === false)
	}, [data])

	const headerActionConfig = useMemo(() => {
		if (allDirectoryPaths.size === 0) {
			return undefined
		}

		return {
			customActions: [
				{
					key: "file-tree-expand-collapse",
					zone: "primary" as const,
					render: () => (
						<Flex gap="small" align="center">
							{isAllExpanded ? (
								<ActionButton
									icon={IconCornerLeftUp}
									onClick={handleCollapseAll}
									title={t("fileTree.collapseAll")}
									text={!isMobile ? t("fileTree.collapseAll") : undefined}
									showText={!isMobile}
								/>
							) : (
								<ActionButton
									icon={IconCornerRightDown}
									onClick={handleExpandAll}
									title={t("fileTree.expandAll")}
									text={!isMobile ? t("fileTree.expandAll") : undefined}
									showText={!isMobile}
								/>
							)}
						</Flex>
					),
				},
			],
		}
	}, [allDirectoryPaths.size, handleCollapseAll, handleExpandAll, isAllExpanded, isMobile, t])

	return (
		<div
			className={cx(styles.fileTreeContainer, className, isMobile && styles.mobileOptimized)}
		>
			<CommonHeaderV2
				type={type}
				onFullscreen={onFullscreen}
				onDownload={onDownload}
				isFromNode={isFromNode}
				isFullscreen={isFullscreen}
				// Pass new props for ActionButtons functionality
				viewMode={viewMode}
				onViewModeChange={onViewModeChange}
				onCopy={onCopy}
				fileContent={getContentToCopy()}
				// File sharing props
				currentFile={currentFile}
				allowEdit={allowEdit}
				actionConfig={headerActionConfig}
			/>
			<div className={styles.content}>
				{/* 表格容器 - 支持横向滚动 */}
				<div className={styles.tableContainer}>
					<div className={styles.tableWrapper}>
						{/* 表格头部 */}
						<div className={styles.tableHeader}>
							<div className={cx(styles.headerCell, styles.cell)}>
								<span className={styles.headerTitle}>{t("fileTree.name")}</span>
							</div>
							<div className={cx(styles.headerTimeCell, styles.cell)}>
								<span className={styles.headerTitle}>
									{t("fileTree.modifiedTime")}
								</span>
							</div>
							<div className={cx(styles.headerSizeCell, styles.cell)}>
								<span className={styles.headerTitle}>{t("fileTree.size")}</span>
							</div>
						</div>

						{/* 文件树内容 */}
						<div className={styles.treeContent}>
							{data?.tree?.map((node) => (
								<FileTreeItem
									key={node.relative_file_path}
									node={node}
									level={0}
									expandedNodes={expandedNodes}
									onToggleExpand={handleToggleExpand}
									isMobile={isMobile}
									isAllFileType={isAllFileType}
								/>
							))}

							{(!data?.tree || data.tree.length === 0) && (
								<Flex
									className={styles.emptyState}
									align="center"
									justify="center"
									vertical
								>
									<img src={EmptyFiles} alt="empty" />
									<span>{t("fileTree.empty")}</span>
								</Flex>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
})
