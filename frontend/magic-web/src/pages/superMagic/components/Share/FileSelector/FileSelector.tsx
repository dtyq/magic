import { memo, useState, useMemo, useEffect, useCallback, useRef } from "react"
import { Tooltip } from "antd"
import { IconChevronDown, IconChevronRight, IconHomeDot, IconHomeCheck } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import MagicIcon from "@/components/base/MagicIcon"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import FoldIcon from "@/pages/superMagic/assets/svg/file-folder.svg"
import useStyles from "./style"
import type { FileSelectorProps } from "./types"
import { useTreeData } from "@/pages/superMagic/components/TopicFilesButton/hooks/useTreeData"
import CustomTree from "@/pages/superMagic/components/TopicFilesButton/components/CustomTree/CustomTree"
import type { TreeNodeData } from "@/pages/superMagic/components/TopicFilesButton/utils/treeDataConverter"
import { getNodePath } from "@/pages/superMagic/components/TopicFilesButton/utils/treeDataConverter"
import { getAttachmentType } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import {
	findFileInTree,
	getAllDescendantIds,
	getParentId,
	getSiblingIds,
	isNodeSelected,
} from "@/pages/superMagic/components/TopicFilesButton/hooks/fileSelectionUtils"
import { canSetAsDefault, hasValidFileForShare } from "./utils"
import { useResponsive } from "ahooks"
import { useLocateFile } from "./hooks/useLocateFile"
import magicToast from "@/components/base/MagicToaster/utils"

export default memo(function FileSelector(props: FileSelectorProps) {
	const {
		attachments,
		selectedFileIds,
		onSelectionChange,
		defaultOpenFileId,
		onDefaultOpenFileChange,
		disabled = false,
		allowSetDefaultOpen = false,
		className,
	} = props
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")
	const [searchValue] = useState("")
	const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
	const [initialized, setInitialized] = useState(false)
	const [hoveredItemId, setHoveredItemId] = useState<string | null>(null)
	const isMobile = useResponsive().md === false
	const treeAreaRef = useRef<HTMLDivElement>(null)

	// Filter files based on search
	const filteredFiles = useMemo(() => {
		if (!searchValue) return attachments

		const lowerSearch = searchValue.toLowerCase()
		return attachments.filter((file) => {
			const name = file.name || file.file_name || file.display_filename || ""
			return name.toLowerCase().includes(lowerSearch)
		})
	}, [attachments, searchValue])

	// Generate tree data using the same hook as TopicFilesCore
	const { treeData } = useTreeData({
		mergedFiles: filteredFiles,
		renamingItemId: null,
	})

	// Use locate file hook
	const { locatingFileId, handleLocateFileInTree } = useLocateFile({
		treeData,
		expandedKeys,
		setExpandedKeys,
		treeAreaRef,
	})

	// Check if file is the default open file
	const isDefaultOpenFile = useCallback(
		(fileId: string): boolean => {
			return defaultOpenFileId === fileId
		},
		[defaultOpenFileId],
	)

	// Initialize: expand parent folders for selected files and locate to default open file
	useEffect(() => {
		if (initialized || !selectedFileIds || selectedFileIds.length === 0 || !treeData.length)
			return

		// Collect all parent folder keys for all selected files
		const parentKeysSet = new Set<React.Key>()
		for (const fileId of selectedFileIds) {
			const path = getNodePath(treeData, fileId)
			if (path.length > 0) {
				// Expand all parent folders (exclude the file itself)
				const parentKeys = path.slice(0, -1)
				parentKeys.forEach((key) => parentKeysSet.add(key))
			}
		}

		if (parentKeysSet.size > 0) {
			setExpandedKeys(Array.from(parentKeysSet))
		}

		setInitialized(true)

		// Locate to default open file after expansion
		if (defaultOpenFileId) {
			// Delay to ensure tree is fully rendered and expanded
			setTimeout(() => {
				handleLocateFileInTree(defaultOpenFileId)
			}, 100)
		}
	}, [selectedFileIds, treeData, initialized, handleLocateFileInTree, defaultOpenFileId])

	// Memoize checkbox states for all nodes to avoid O(n²) complexity
	const nodeCheckStates = useMemo(() => {
		const states = new Map<string, "checked" | "unchecked" | "indeterminate">()
		const selectedSet = new Set(selectedFileIds)

		// Build a map for fast node lookup
		const nodeMap = new Map<string, any>()
		const buildNodeMap = (nodes: any[]) => {
			for (const node of nodes) {
				const nodeId = node.file_id || node.id
				if (nodeId) {
					nodeMap.set(nodeId, node)
				}
				if (node.children && Array.isArray(node.children)) {
					buildNodeMap(node.children)
				}
			}
		}
		buildNodeMap(attachments)

		// Helper: check if node is selected (including parent selection)
		const isSelected = (nodeId: string): boolean => {
			if (selectedSet.has(nodeId)) return true

			// Check if any parent is selected
			let current = nodeMap.get(nodeId)
			while (current) {
				const parentId = current.parent_id || current.parent_file_id
				if (!parentId) break
				if (selectedSet.has(parentId)) return true
				current = nodeMap.get(parentId)
			}
			return false
		}

		// Helper: calculate state for a node
		const calculateState = (node: any): "checked" | "unchecked" | "indeterminate" => {
			const nodeId = node.file_id || node.id

			// File node: check if selected (including parent selection)
			if (!node.is_directory) {
				return isSelected(nodeId) ? "checked" : "unchecked"
			}

			// Empty folder: check self and parent selection
			if (!node.children || node.children.length === 0) {
				return isSelected(nodeId) ? "checked" : "unchecked"
			}

			// 🐛 FIX: If folder itself is selected, return checked
			if (selectedSet.has(nodeId)) {
				return "checked"
			}

			// Folder with children: check children states
			// 🐛 FIX: Filter out hidden files
			const visibleChildren = node.children.filter((child: any) => !child.is_hidden)

			// If no visible children, check self only
			if (visibleChildren.length === 0) {
				return isSelected(nodeId) ? "checked" : "unchecked"
			}

			let checkedCount = 0
			let indeterminateFound = false

			for (const child of visibleChildren) {
				const childState = states.get(child.file_id || child.id)
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

		// Post-order traversal to calculate states bottom-up
		const calculateStates = (nodes: any[]) => {
			for (const node of nodes) {
				// Process children first
				if (node.children && Array.isArray(node.children) && node.children.length > 0) {
					calculateStates(node.children)
				}

				// Then calculate this node's state
				const nodeId = node.file_id || node.id
				if (nodeId) {
					states.set(nodeId, calculateState(node))
				}
			}
		}

		calculateStates(attachments)
		return states
	}, [selectedFileIds, attachments])

	// Handle file selection toggle
	const handleFileToggle = useCallback(
		(fileId: string) => {
			const node = findFileInTree(attachments, fileId)
			if (!node) return

			// 使用缓存的状态而非重新计算
			const checkState = nodeCheckStates.get(fileId) || "unchecked"
			let newSelectedIds: string[]

			// 情况1: 未选中 → 选中
			if (checkState === "unchecked") {
				// 直接添加该节点ID（无论是文件夹还是文件）
				newSelectedIds = [...selectedFileIds, fileId]
			}
			// 情况2: 全选中 → 取消
			else if (checkState === "checked") {
				if (selectedFileIds.includes(fileId)) {
					// 直接选中的节点 - 直接移除
					newSelectedIds = selectedFileIds.filter((id) => id !== fileId)
				} else {
					// 因父级选中或所有子级选中而间接显示为选中的节点
					const parentId = getParentId(fileId, attachments)
					if (parentId && selectedFileIds.includes(parentId)) {
						// 情况A：父级在数据层中 → 取消父级，展开其他兄弟（排除当前节点）
						const siblingIds = getSiblingIds(fileId, attachments)
						newSelectedIds = selectedFileIds
							.filter((id) => id !== parentId)
							.concat(siblingIds.filter((id) => id !== fileId))
					} else {
						// 情况B：父级不在数据层
						// 说明这个节点的所有子级都被单独选中了
						// 取消这个节点意味着取消它的所有子级
						if (node.is_directory) {
							const descendantIds = getAllDescendantIds(node)
							newSelectedIds = selectedFileIds.filter(
								(id) => !descendantIds.includes(id),
							)
						} else {
							// 文件节点不应该走到这里，但为了安全
							newSelectedIds = selectedFileIds
						}
					}
				}
			}
			// 情况3: 半选 → 全选（清除所有子级的选中状态，只保留当前节点）
			else if (checkState === "indeterminate") {
				// 获取所有子级ID
				const allDescendants = getAllDescendantIds(node)
				// 移除所有子级的选中状态，添加当前节点
				newSelectedIds = selectedFileIds
					.filter((id) => !allDescendants.includes(id))
					.concat([fileId])
			} else {
				return
			}

			// 构建新的选中文件列表
			const newSelectedFiles = newSelectedIds
				.map((id) => findFileInTree(attachments, id))
				.filter(Boolean) as Record<string, unknown>[]

			// 验证：检查是否还有至少一个文件或携带metadata的文件夹
			const hasValidFile = hasValidFileForShare(newSelectedIds, attachments)
			if (!hasValidFile) {
				// 如果没有有效文件，阻止操作并提示
				magicToast.warning(
					t("share.atLeastOneFileRequired") ||
					"至少需要选中一个文件或携带metadata的文件夹",
				)
				return
			}

			// 如果取消选中的文件是默认打开文件，需要清除默认打开文件
			if (
				defaultOpenFileId &&
				!isNodeSelected(defaultOpenFileId, newSelectedIds, attachments)
			) {
				onDefaultOpenFileChange?.(null)
			}

			onSelectionChange(newSelectedIds, newSelectedFiles)
		},
		[
			nodeCheckStates,
			selectedFileIds,
			attachments,
			onSelectionChange,
			t,
			defaultOpenFileId,
			onDefaultOpenFileChange,
		],
	)

	// Render tree node title (simplified version of TopicFilesCore's titleRender)
	const titleRender = useCallback(
		(node: TreeNodeData) => {
			const item = node.item || {}
			const itemId = node.key
			const hasChildren = node.children && node.children.length > 0
			const isExpanded = expandedKeys.includes(node.key)
			const indentWidth = node.level * 10

			// Check if this file is being located
			const isLocating = locatingFileId === itemId

			// 使用缓存的 checkbox 状态（避免重复计算）
			const checkState = nodeCheckStates.get(itemId) || "unchecked"
			const checkedValue =
				checkState === "checked"
					? true
					: checkState === "indeterminate"
						? "indeterminate"
						: false

			// Render expand/collapse icon
			const renderExpandIcon = () => {
				if (!hasChildren) {
					return <div style={{ width: 16, height: 16 }} /> // Placeholder
				}

				return (
					<MagicIcon
						component={isExpanded ? IconChevronDown : IconChevronRight}
						size={16}
						stroke={1.5}
						style={{
							cursor: "pointer",
							color: "rgba(28, 29, 35, 0.6)",
						}}
						onClick={(e: React.MouseEvent) => {
							e.stopPropagation()
							const newExpandedKeys = isExpanded
								? expandedKeys.filter((key) => key !== node.key)
								: [...expandedKeys, node.key]
							setExpandedKeys(newExpandedKeys)
						}}
					/>
				)
			}

			// Check if can set as default open file
			const canSetDefault = canSetAsDefault(item)
			const isDefault = isDefaultOpenFile(itemId)

			// Render default open file icon
			const renderDefaultOpenIcon = () => {
				// 如果 disabled 为 true，但 allowSetDefaultOpen 也为 true，则允许设置默认打开文件
				if (!canSetDefault || (disabled && !allowSetDefaultOpen)) return null

				if (isDefault) {
					// Already set as default - always show
					return (
						<div
							className={styles.defaultOpenIconWrapper}
							onClick={(e) => {
								e.stopPropagation()
								onDefaultOpenFileChange?.(null)
							}}
						>
							<MagicIcon
								component={IconHomeCheck}
								size={18}
								stroke={2}
								className={styles.defaultOpenIconActive}
							/>
						</div>
					)
				}

				// Not set as default - show on hover
				if (hoveredItemId === itemId) {
					return (
						<Tooltip title={t("share.setAsDefaultOpenFile") || "设为默认打开的文件"}>
							<div
								className={styles.defaultOpenIconWrapper}
								onClick={(e) => {
									e.stopPropagation()
									// 验证是否可以设置为默认打开文件
									if (!canSetDefault) {
										return
									}
									// If file is not selected and not disabled, select it first
									// 如果 disabled 为 true 但 allowSetDefaultOpen 为 true，则不需要先选中文件
									const isSelected = isNodeSelected(
										itemId,
										selectedFileIds,
										attachments,
									)
									if (!isSelected && !disabled) {
										handleFileToggle(itemId)
									}
									// Then set as default open file
									onDefaultOpenFileChange?.(itemId)
								}}
							>
								<MagicIcon
									component={IconHomeDot}
									size={18}
									className={
										isDefault
											? styles.defaultOpenIconActive
											: styles.defaultOpenIcon
									}
									stroke={2}
								/>
							</div>
						</Tooltip>
					)
				}

				return null
			}

			return (
				<div
					className={cx(
						styles.fileItem,
						isMobile && styles.mobileFileItem,
						isLocating && styles.locatingFileItem,
					)}
					data-selector-file-id={itemId}
					onMouseEnter={() => setHoveredItemId(itemId)}
					onMouseLeave={() => setHoveredItemId(null)}
					onClick={(e) => {
						e.stopPropagation()
						if (!disabled) {
							handleFileToggle(itemId)
						}
					}}
					style={{
						cursor: "pointer",
					}}
				>
					<div
						className={cx(
							styles.fileTitle,
							isMobile && styles.mobileFileTitle,
							"magic-file-title",
						)}
						style={{
							paddingLeft: indentWidth + "px",
						}}
					>
						{/* Expand/collapse icon */}
						<div className={styles.iconWrapper}>{renderExpandIcon()}</div>

						{/* Checkbox */}
						{!disabled && (
							<div className={styles.iconWrapper}>
								<Checkbox
									checked={checkedValue}
									onCheckedChange={() => {
										handleFileToggle(itemId)
									}}
									onClick={(e) => e.stopPropagation()}
								/>
							</div>
						)}

						{/* File/Folder icon */}
						<div className={styles.iconWrapper}>
							{item?.is_directory && !item?.metadata?.type ? (
								<img
									src={FoldIcon as unknown as string}
									alt="folder"
									width={16}
									height={16}
								/>
							) : (
								<MagicFileIcon
									type={getAttachmentType(item?.metadata) || item?.file_extension}
									size={16}
								/>
							)}
						</div>

						{/* File name */}
						<div className={cx(styles.fileName, isMobile && styles.mobileFileName)}>
							{item?.name || item?.file_name}
						</div>

						{/* Default open file icon */}
						{renderDefaultOpenIcon()}
					</div>
				</div>
			)
		},
		[
			nodeCheckStates,
			selectedFileIds,
			expandedKeys,
			isDefaultOpenFile,
			cx,
			styles.fileItem,
			styles.mobileFileItem,
			styles.fileTitle,
			styles.mobileFileTitle,
			styles.iconWrapper,
			styles.fileName,
			styles.mobileFileName,
			styles.defaultOpenIconWrapper,
			styles.defaultOpenIconActive,
			styles.defaultOpenIcon,
			styles.locatingFileItem,
			isMobile,
			hoveredItemId,
			onDefaultOpenFileChange,
			t,
			handleFileToggle,
			attachments,
			disabled,
			allowSetDefaultOpen,
			locatingFileId,
		],
	)

	// Handle expand
	const handleExpand = useCallback((newExpandedKeys: React.Key[]) => {
		setExpandedKeys(newExpandedKeys)
	}, [])

	// Memoize CustomTree to prevent unnecessary re-renders
	const customTreeMemo = useMemo(
		() => (
			<CustomTree
				treeData={treeData}
				switcherIcon={() => null}
				onExpand={handleExpand}
				expandedKeys={expandedKeys}
				titleRender={titleRender}
				showIcon={false}
				blockNode
				className={styles.treeArea}
			/>
		),
		[treeData, handleExpand, expandedKeys, titleRender, styles.treeArea],
	)

	return (
		<div className={cx(styles.container, isMobile && styles.containerMobile, className)}>
			{/* Search input */}
			{/* <Input
				placeholder={t("common.searchFiles")}
				value={searchValue}
				onChange={(e) => setSearchValue(e.target.value)}
				className={styles.searchBox}
				size="small"
			/> */}

			{/* File tree */}
			<div ref={treeAreaRef} className={styles.treeArea}>
				{treeData.length > 0 ? (
					customTreeMemo
				) : (
					<div className={styles.emptyState}>{t("common.notFound")}</div>
				)}
			</div>
		</div>
	)
})
