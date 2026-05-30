import { memo, useState, useMemo, useEffect, useCallback, useRef } from "react"
import { Tooltip } from "antd"
import { IconChevronDown, IconChevronRight, IconHomeDot, IconHomeCheck } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import MagicIcon from "@/components/base/MagicIcon"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import { CustomFolderMagicIcon } from "@/pages/superMagic/components/TopicFilesButton/components/CustomFolderMagicIcon"
import FoldIcon from "@/pages/superMagic/assets/svg/file-folder.svg"
import useStyles from "./style"
import type { FileSelectorProps } from "./types"
import { CheckboxState } from "./types"
import { useTreeData } from "@/pages/superMagic/components/TopicFilesButton/hooks/useTreeData"
import CustomTree from "@/pages/superMagic/components/TopicFilesButton/components/CustomTree/CustomTree"
import type { TreeNodeData } from "@/pages/superMagic/components/TopicFilesButton/utils/treeDataConverter"
import { getNodePath } from "@/pages/superMagic/components/TopicFilesButton/utils/treeDataConverter"
import {
	getAttachmentType,
	getChildrenForCustomMetadataIconPath,
	getFileTreeIconType,
} from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
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
		showSelectAll = false,
		supportedFileExtensions,
		allowEmptySelection = false,
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

	/**
	 * 检查文件是否受支持
	 * @param node 文件节点
	 * @returns true 表示支持，false 表示不支持
	 */
	const isFileSupported = useCallback(
		(node: any): boolean => {
			// 如果没有指定支持的文件扩展名，则所有文件都支持
			if (!supportedFileExtensions || supportedFileExtensions.length === 0) {
				return true
			}

			// 文件夹始终支持
			if (node.is_directory || node.metadata?.type) {
				return true
			}

			// 获取文件扩展名
			const fileName = node.name || node.file_name || node.display_filename || ""
			const lastDotIndex = fileName.lastIndexOf(".")
			if (lastDotIndex === -1) {
				// 没有扩展名的文件不支持
				return false
			}

			const extension = fileName.slice(lastDotIndex + 1).toLowerCase()
			return supportedFileExtensions.includes(extension)
		},
		[supportedFileExtensions],
	)

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
		const states = new Map<string, CheckboxState>()
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
		const calculateState = (node: any): CheckboxState => {
			const nodeId = node.file_id || node.id

			// File node: check if selected (including parent selection)
			if (!node.is_directory) {
				return isSelected(nodeId) ? CheckboxState.Checked : CheckboxState.Unchecked
			}

			// Empty folder: check self and parent selection
			if (!node.children || node.children.length === 0) {
				return isSelected(nodeId) ? CheckboxState.Checked : CheckboxState.Unchecked
			}

			// 🐛 FIX: If folder itself is selected, return checked
			if (selectedSet.has(nodeId)) {
				return CheckboxState.Checked
			}

			// Folder with children: check children states
			// 🐛 FIX: Filter out hidden files
			const visibleChildren = node.children.filter((child: any) => !child.is_hidden)

			// If no visible children, check self only
			if (visibleChildren.length === 0) {
				return isSelected(nodeId) ? CheckboxState.Checked : CheckboxState.Unchecked
			}

			let checkedCount = 0
			let indeterminateFound = false

			for (const child of visibleChildren) {
				const childState = states.get(child.file_id || child.id)
				if (childState === CheckboxState.Checked) {
					checkedCount++
				} else if (childState === CheckboxState.Indeterminate) {
					indeterminateFound = true
				}
			}

			if (indeterminateFound || (checkedCount > 0 && checkedCount < visibleChildren.length)) {
				return CheckboxState.Indeterminate
			}
			return checkedCount === visibleChildren.length
				? CheckboxState.Checked
				: CheckboxState.Unchecked
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

			// 检查文件是否支持
			if (!isFileSupported(node)) {
				// 不支持的文件不能被选中
				return
			}

			// 使用缓存的状态而非重新计算
			const checkState = nodeCheckStates.get(fileId) || CheckboxState.Unchecked
			let newSelectedIds: string[]

			// 情况1: 未选中 → 选中
			if (checkState === CheckboxState.Unchecked) {
				// 直接添加该节点ID（无论是文件夹还是文件）
				newSelectedIds = [...selectedFileIds, fileId]
			}
			// 情况2: 全选中 → 取消
			else if (checkState === CheckboxState.Checked) {
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
			else if (checkState === CheckboxState.Indeterminate) {
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

			// 验证：检查是否还有至少一个文件或携带metadata的文件夹（如果不允许空选择）
			if (!allowEmptySelection) {
				const hasValidFile = hasValidFileForShare(newSelectedIds, attachments)
				if (!hasValidFile) {
					// 如果没有有效文件，阻止操作并提示
					magicToast.warning(
						t("share.atLeastOneFileRequired") ||
							"至少需要选中一个文件或携带metadata的文件夹",
					)
					return
				}
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
			isFileSupported,
			allowEmptySelection,
		],
	)

	// 计算全选状态
	const selectAllState = useMemo(() => {
		if (!showSelectAll || attachments.length === 0) return CheckboxState.Unchecked

		// 获取根级别的所有项目ID
		const rootItemIds = attachments
			.filter((item) => !item.is_hidden)
			.map((item) => item.file_id || item.id)
			.filter(Boolean)

		if (rootItemIds.length === 0) return CheckboxState.Unchecked

		// 检查有多少根级别项目被选中
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
	}, [showSelectAll, attachments, nodeCheckStates])

	// 处理全选/取消全选
	const handleSelectAll = useCallback(() => {
		// 获取根级别的所有项目ID
		const rootItemIds = attachments
			.filter((item) => !item.is_hidden)
			.map((item) => item.file_id || item.id)
			.filter(Boolean)

		if (rootItemIds.length === 0) return

		let newSelectedIds: string[]

		if (selectAllState === CheckboxState.Checked) {
			// 当前全选 → 取消全选
			// 移除所有根级别项目ID
			newSelectedIds = selectedFileIds.filter((id) => !rootItemIds.includes(id))
		} else {
			// 当前未全选或半选 → 全选
			// 添加所有根级别项目ID（去重）
			const existingIds = new Set(selectedFileIds)
			rootItemIds.forEach((id) => existingIds.add(id))
			newSelectedIds = Array.from(existingIds)
		}

		// 构建新的选中文件列表
		const newSelectedFiles = newSelectedIds
			.map((id) => findFileInTree(attachments, id))
			.filter(Boolean) as Record<string, unknown>[]

		onSelectionChange(newSelectedIds, newSelectedFiles)
	}, [attachments, selectAllState, selectedFileIds, onSelectionChange])

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
			const checkState = nodeCheckStates.get(itemId) || CheckboxState.Unchecked
			const checkedValue =
				checkState === CheckboxState.Checked
					? true
					: checkState === CheckboxState.Indeterminate
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

			// Check if this file is supported
			const fileSupported = isFileSupported(item)
			// 文件级别的禁用：全局禁用 或 文件不支持
			const isFileDisabled = disabled || !fileSupported

			// Render default open file icon
			const renderDefaultOpenIcon = () => {
				// 如果不允许设置默认打开文件，直接返回 null
				if (!allowSetDefaultOpen) return null

				if (!canSetDefault) return null

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
									// If file is not selected, select it first
									const isSelected = isNodeSelected(
										itemId,
										selectedFileIds,
										attachments,
									)
									if (!isSelected) {
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
						if (!isFileDisabled) {
							handleFileToggle(itemId)
						}
					}}
					style={{
						cursor: isFileDisabled ? "not-allowed" : "pointer",
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
									checked={fileSupported ? checkedValue : false}
									disabled={!fileSupported}
									className={
										!fileSupported
											? "border-border bg-muted hover:bg-muted"
											: undefined
									}
									onCheckedChange={() => {
										if (fileSupported) {
											handleFileToggle(itemId)
										}
									}}
									onClick={(e) => e.stopPropagation()}
								/>
							</div>
						)}

						{/* File/Folder icon */}
						<div className={cx(styles.iconWrapper, !fileSupported && "opacity-50")}>
							{item?.is_directory && !item?.display_config?.type ? (
								<img
									src={FoldIcon as unknown as string}
									alt="folder"
									width={16}
									height={16}
								/>
							) : item?.metadata?.type === "custom" ||
							  (item?.metadata?.type === "micro-app" && item?.is_directory) ? (
								<CustomFolderMagicIcon
									displayConfig={item?.display_config}
									childrenItems={getChildrenForCustomMetadataIconPath(
										item,
										(id) =>
											attachments?.length
												? findFileInTree(
														attachments as Record<string, unknown>[],
														id,
													)
												: null,
									)}
									typeFallback={item?.metadata?.type}
									size={16}
								/>
							) : (
								<MagicFileIcon
									type={
										getFileTreeIconType(item) ||
										getAttachmentType(item) ||
										item?.file_extension
									}
									size={16}
								/>
							)}
						</div>

						{/* File name */}
						<div
							className={cx(
								styles.fileName,
								isMobile && styles.mobileFileName,
								!fileSupported && "text-muted-foreground/50",
							)}
						>
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
			isFileSupported,
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
			{/* Select All Checkbox */}
			{showSelectAll && !disabled && (
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
					<span className="text-sm text-muted-foreground">{t("share.selectAll")}</span>
				</div>
			)}

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
