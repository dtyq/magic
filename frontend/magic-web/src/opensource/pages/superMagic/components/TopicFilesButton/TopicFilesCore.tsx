import { IconChevronDown, IconChevronRight, IconDots } from "@tabler/icons-react"
import { Loader2, ChevronDown } from "lucide-react"
import { Flex } from "antd"
import { Checkbox } from "@/opensource/components/shadcn-ui/checkbox"
import { useMemo, useImperativeHandle, forwardRef } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import MagicFileIcon from "@/opensource/components/base/MagicFileIcon"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import FoldIcon from "@/opensource/pages/superMagic/assets/svg/file-folder.svg"
import CustomTree from "./components/CustomTree/CustomTree"
import EmptyState from "./components/EmptyState"
import { useStyles } from "./style"
import { useMemoizedFn, useResponsive } from "ahooks"
import { useSuperMagicDropdown } from "../SuperMagicDropdown"
import {
	useRename,
	useFileOperations,
	useContextMenu,
	useFileSelection,
	useBatchDownload,
	useFileFilter,
	useVirtualFile,
	useVirtualFolder,
	useVirtualDesignProject,
	useTreeUI,
	useDragMove,
	useTreeData,
	useDropHandler,
	useFileListAreaDrag,
	useMoveFile,
	useSelectedFilesManager,
	isInRootDirectory,
	useAutoExpandFolder,
	createFileDragHandlers,
	useShareFile,
} from "./hooks"
import { useFileShortcuts } from "./hooks/useFileShortcuts"
import { useCrossProjectFileOperation } from "./hooks/useCrossProjectFileOperation"
import CrossProjectFileOperationModal from "../SelectPathModal/components/CrossProjectFileOperationModal"
import { useDragUpload } from "./hooks/useDragUpload"
import { type PresetFileType } from "./constant"
import { useDuplicateFileHandler } from "./hooks/useDuplicateFileHandler"

import { useLocateFile } from "./hooks/useLocateFile"
import type { AttachmentItem } from "./hooks/types"
import { SuperMagicApi } from "@/opensource/apis"

import ShareModal from "../Share/Modal"
import ShareSuccessModal from "../Share/FileShareModal/ShareSuccessModal"
import SimilarSharesDialog from "../Share/SimilarSharesDialog"
import SimilarSharesDrawer from "../Share/SimilarSharesDrawer"
import { generateShareUrl } from "../ShareManagement/utils/shareTypeHelpers"
import { ShareMode, ShareType } from "../Share/types"
import { findTreeNodeByKey, type TreeNodeData } from "./utils/treeDataConverter"
import { DuplicateFileModal } from "./components/DuplicateFileModal"
import { InputWithError } from "./components"
import {
	getAppEntryFile,
	getAttachmentType,
} from "@/opensource/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import { isEmpty } from "lodash-es"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { useOrganization } from "@/opensource/models/user/hooks/useOrganization"
import MagicProgressToast from "@/opensource/components/base/MagicProgressToast"
import { SelectDirectoryModal } from "../SelectPathModal"
import { getParentPathFromFileId } from "../SelectPathModal/utils/attachmentUtils"
import { handleAttachmentDragEnd } from "../MessageEditor/utils/drag"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import SmartTooltip from "@/opensource/components/other/SmartTooltip"
import mentionPanelStore from "@/opensource/components/business/MentionPanel/store"

import { useDownloadImageMenu } from "../Detail/contents/Image/hooks/useDownloadImageMenu"
import { DownloadImageMode } from "../../pages/Workspace/types"
import { userStore } from "@/opensource/models/user"
import { MagicDropdown } from "@/opensource/components/base"
import { detectContentTypeRender } from "../Detail/components/FilesViewer/utils/preview"
import type { FileItem } from "../Detail/components/FilesViewer/types"

interface TopicFilesCoreProps {
	className?: string
	attachments?: AttachmentItem[]
	setUserSelectDetail?: (detail: any) => void
	onFileClick?: (fileItem: any) => void
	projectId?: string
	fileFilters?: {
		documents: boolean
		multimedia: boolean
		code: boolean
	}
	handleDownloadAll?: () => void
	allLoading?: boolean
	activeFileId?: string | null
	selectedTopic?: any
	isSelectMode?: boolean
	onSelectModeChange?: (isSelectMode: boolean) => void
	onSelectAll?: () => void
	onDeselectAll?: () => void
	onSelectionChange?: (selectedCount: number, totalCount: number) => void
	allowEdit?: boolean
	onUpdateAttachments?: () => void
	afterAddFileToNewTopic?: () => void
	afterAddFileToCurrentTopic?: () => void
	// 添加直接更新attachments的回调
	onAttachmentsChange?: (attachments: AttachmentItem[]) => void
	selectedProject?: any
	handleReplaceFile?: (item: AttachmentItem) => void
	// 外部传入的同名文件处理 handler（可选）
	duplicateFileHandler?: ReturnType<typeof useDuplicateFileHandler>
	// 跨项目操作所需的props
	selectedWorkspace?: any
	projects?: any[]
	workspaces?: any[]
	isInProject?: boolean
	// 外部传入的搜索值
	externalSearchValue?: string
	// 自定义菜单项过滤器
	filterMenuItems?: (menuItems: any[]) => any[]
	// 自定义批量下载菜单过滤器
	filterBatchDownloadLayerMenuItems?: (menuItems: any[]) => any[]
	// 是否允许下载（用于分享页面权限控制）
	allowDownload?: boolean
}

// 定义 ref 暴露的方法接口
export interface TopicFilesCoreRef {
	createVirtualFile: (type: PresetFileType, key?: string, parentPath?: string) => void
	createVirtualFolder: (key?: string, parentPath?: string) => void
	createDesignProject: (parentPath?: string) => Promise<any>
	handleUploadFile: (item?: any) => void
	handleUploadFolder: (item?: any) => void
	resetAllStates: () => void
}

const TopicFilesCore = forwardRef<TopicFilesCoreRef, TopicFilesCoreProps>(function TopicFilesCore(
	{
		className,
		attachments = [],
		setUserSelectDetail,
		onFileClick,
		projectId,
		fileFilters = {
			documents: true,
			multimedia: true,
			code: true,
		},
		handleDownloadAll,
		allLoading,
		activeFileId,
		selectedTopic,
		isSelectMode = false,
		onSelectModeChange,
		onSelectionChange,
		allowEdit = true,
		onUpdateAttachments,
		afterAddFileToNewTopic,
		afterAddFileToCurrentTopic,
		onAttachmentsChange,
		selectedProject,
		handleReplaceFile,
		duplicateFileHandler: externalDuplicateHandler,
		selectedWorkspace,
		projects = [],
		workspaces = [],
		isInProject = false,
		externalSearchValue,
		filterMenuItems,
		filterBatchDownloadLayerMenuItems,
		allowDownload,
	},
	ref,
) {
	const { t, i18n } = useTranslation("super")
	const { styles, cx } = useStyles({ isExpanded: true })
	const isMobile = useResponsive().md === false
	const { organizationCode } = useOrganization()
	// 有userId，认为有登录状态
	const hasLogin = userStore.user?.userInfo?.user_id

	const workspaceId = selectedProject?.workspace_id

	// 创建共享的同名文件处理 handler（单例）
	// 优先使用外部传入的 handler，否则创建内部 handler
	const internalDuplicateHandler = useDuplicateFileHandler({
		attachments: attachments || [],
	})
	const sharedDuplicateHandler = externalDuplicateHandler || internalDuplicateHandler

	// 拖拽上传 hook
	const { handleUploadFiles } = useDragUpload({
		allowUpload: allowEdit,
		projectId,
		selectedProject,
		selectedTopic,
		workspaceId,
		debug: process.env.NODE_ENV === "development",
		attachments,
		duplicateFileHandler: sharedDuplicateHandler,
	})

	// 使用hooks
	const {
		renamingItemId,
		renameValue,
		setRenameValue,
		renameInputRef,
		renameErrorMessage,
		handleStartRename,
		handleRenameConfirm,
		handleRenameKeyDown,
		getItemId,
		isFileRenaming,
		resetRename,
	} = useRename({
		projectId,
		onRenameSuccess: (oldName, newName) => {
			console.log("重命名成功:", oldName, "->", newName)
		},
		onRenameError: (error) => {
			console.error("重命名失败:", error)
		},
		onUpdateAttachments,
		attachments,
		onAttachmentsChange,
	})

	const {
		handleUploadFile,
		handleUploadFolder,
		handleDeleteItem,
		handleDownloadOriginal,
		handleDownloadPdf,
		handleDownloadPpt,
		handleOpenFile,
		handleMoveFile,
		shareModalVisible,
		setShareModalVisible,
		shareFileInfo,
		setShareFileInfo,
		handleShareSave,
		exportingFiles,
		isExportingPdf,
		pdfExportProgress,
		isExportingPpt,
		pptExportProgress,
		isBatchExportingPdf,
		batchPdfExportProgress,
		isBatchExportingPpt,
		batchPptExportProgress,
		createFileAndUpload,
		createFolderAndUpload,
		createDesignProject,
		movingFiles,
		downloadingFolders,
		isFolderDownloading,
		resetFileOperations,
		removeFile,
		onBatchPdfExportStart,
		onBatchPdfExportProgress,
		onBatchPdfExportEnd,
		onBatchPptExportStart,
		onBatchPptExportProgress,
		onBatchPptExportEnd,
	} = useFileOperations({
		setUserSelectDetail,
		onFileClick,
		attachments,
		selectedTopic,
		projectId,
		// 添加文件创建成功回调
		onFileCreated: (fileItem: any) => {
			console.log("🔵 文件创建成功回调:", fileItem)
			// 如果有 onFileClick 回调，调用它来打开文件Tab
			if (onFileClick) {
				// 等待一小段时间确保文件列表已更新
				setTimeout(() => {
					onFileClick(fileItem)
				}, 100)
			}
		},
		onUpdateAttachments,
		onAttachmentsChange,
		getItemId,
		selectedProject,
		duplicateFileHandler: sharedDuplicateHandler,
	})

	const {
		agreementModal,
		handleDownloadNoWaterMark,
		isFreeTrialVersion,
		preloadWaterMarkFreeModal,
	} = useDownloadImageMenu({
		onDownload: (mode?: DownloadImageMode, item?: AttachmentItem | object) =>
			handleDownloadOriginal(item as AttachmentItem, mode),
	})

	// 文件过滤 hook - 传递外部搜索值
	const { filteredFiles, matchedItemPaths, resetFilter } = useFileFilter({
		attachments,
		fileFilters,
		externalSearchValue,
	})

	// UI 状态 hook - 需要在虚拟文件hooks之前定义，传递搜索相关参数以自动展开父级
	const treeUI = useTreeUI({
		organizationCode,
		projectId,
		enableCache: true,
		searchValue: externalSearchValue,
		matchedItemPaths,
	})
	const {
		hoveredItem,
		setHoveredItem,
		contextMenuItemId,
		setContextMenuItemId,
		expandedKeys,
		setExpandedKeys,
		selectedKeys,
		handleExpand,
		handleSelect: handleTreeSelect,
		resetUI,
		cacheLoaded,
	} = treeUI

	const {
		editingVirtualId: editingVirtualFileId,
		virtualFileName,
		setVirtualFileName,
		errorMessage: fileErrorMessage,
		virtualInputRef: virtualFileInputRef,
		createVirtualFile,
		cancelVirtualFile,
		handleVirtualFileKeyDown,
		mergeVirtualFiles,
		confirmVirtualFile,
		resetVirtualFile,
	} = useVirtualFile({
		attachments,
		setExpandedKeys,
		expandedKeys,
		onFileCreate: createFileAndUpload,
		onAttachmentsChange,
	})

	const {
		editingVirtualId: editingVirtualFolderId,
		virtualFolderName,
		setVirtualFolderName,
		errorMessage: folderErrorMessage,
		virtualInputRef: virtualFolderInputRef,
		createVirtualFolder,
		cancelVirtualFolder,
		handleVirtualFolderKeyDown,
		mergeVirtualFolders,
		confirmVirtualFolder,
		resetVirtualFolder,
	} = useVirtualFolder({
		attachments,
		setExpandedKeys,
		expandedKeys,
		onFolderCreate: createFolderAndUpload,
		onAttachmentsChange,
	})

	const {
		editingVirtualId: editingVirtualDesignProjectId,
		virtualDesignProjectName,
		setVirtualDesignProjectName,
		errorMessage: designProjectErrorMessage,
		virtualInputRef: virtualDesignProjectInputRef,
		createVirtualDesignProject,
		cancelVirtualDesignProject,
		handleVirtualDesignProjectKeyDown,
		mergeVirtualDesignProjects,
		confirmVirtualDesignProject,
		resetVirtualDesignProject,
	} = useVirtualDesignProject({
		attachments,
		setExpandedKeys,
		expandedKeys,
		onDesignProjectCreate: createDesignProject,
		onAttachmentsChange,
	})

	// 合并虚拟文件和虚拟文件夹和虚拟画布项目和真实文件
	const mergedFiles = useMemo(() => {
		const withVirtualFiles = mergeVirtualFiles(filteredFiles)
		const withVirtualFolders = mergeVirtualFolders(withVirtualFiles)
		return mergeVirtualDesignProjects(withVirtualFolders)
	}, [filteredFiles, mergeVirtualFiles, mergeVirtualFolders, mergeVirtualDesignProjects])

	// 树形数据 hook
	const { treeData, getAllFileIds, getTotalCount } = useTreeData({
		mergedFiles,
		renamingItemId,
	})

	// 文件定位 hook
	const { locatingFileId } = useLocateFile({
		treeData,
		expandedKeys,
		setExpandedKeys,
		selectedProjectId: selectedProject?.id || projectId,
	})

	// 拖拽处理 hook
	const { handleDrop } = useDropHandler({
		treeData,
		handleMoveFile,
	})

	// 文件选择 hook (需要先声明，因为 moveFileHook 需要使用 selectedItems)
	const {
		selectedItems,
		setSelectedItems,
		handleItemSelect,
		getFolderSelectionState,
		isItemDisabled,
		resetSelection,
		handleEnterMultiSelectMode,
		isItemSelected,
	} = useFileSelection({
		projectId,
		getItemId,
		treeData,
		isSelectMode,
		onSelectionChange,
		onSelectModeChange,
		getAllFileIds,
		getTotalCount,
	})

	// 文件分享 hook
	const {
		handleShareItem: handleShareItemFromHook,
		shareSuccessInfo,
		closeSuccessModal,
		similarSharesInfo,
		closeSimilarSharesDialog,
		handleSelectSimilarShare,
		handleCreateNewShare,
		handleCancelShare,
		handleEditShare,
		setSimilarShares,
	} = useShareFile({
		getItemId,
		selectedItems,
		mergedFiles,
		setShareFileInfo,
		setShareModalVisible,
		selectedProject,
	})

	// 使用移动文件 hook (需要先声明，因为 useDragMove 需要使用它的状态)
	const moveFileHook = useMoveFile({
		projectId,
		attachments,
		onMoveSuccess: () => {
			pubsub.publish(PubSubEvents.Update_Attachments)
			onUpdateAttachments?.()
		},
		handleMoveFile,
		selectedItems,
		allFiles: mergedFiles,
		getItemId,
	})

	// 解构移动进度状态
	const { isMoving, moveProgress } = moveFileHook

	const {
		dragState,
		handleDragStart: handleFileDragStart,
		handleDragEnd: handleFileDragEnd,
		handleDragEnter,
		handleDragLeave,
		handleDragOver,
		handleDrop: handleFileDrop,
		isDropTarget,
		handleTreeNodeDragEnter,
		handleTreeNodeDragLeave,
		handleTreeNodeDragOver,
		handleTreeNodeDrop,
	} = useDragMove({
		allowMove: allowEdit,
		onMoveFiles: async (fileIds: string[], targetFolderId: string | null) => {
			// 复用现有的批量移动逻辑
			if (fileIds.length === 0) return

			await moveFileHook.batchMoveFiles({
				fileIds,
				projectId: selectedProject?.id || "",
				targetParentId: targetFolderId || "",
			})
		},
		debug: process.env.NODE_ENV === "development",
		isMoving: moveFileHook.isMoving, // 传递移动状态
		// 外部文件上传支持
		allowExternalDrop: allowEdit,
		onUploadFiles: handleUploadFiles,
		attachments,
	})

	// 检查是否可以移动到根目录的函数
	const canMoveToRoot = useMemoizedFn(() => {
		// 如果没有在拖拽，或者没有拖拽项，则不允许
		if (!dragState.isDragging || !dragState.draggingItems?.length) {
			return false
		}

		// 检查所有被拖拽的文件是否已经在根目录
		for (const item of dragState.draggingItems) {
			if (isInRootDirectory(item)) {
				return false // 如果有任何文件已经在根目录，则不允许移动到根目录
			}
		}

		return true // 所有文件都不在根目录，允许移动
	})

	// 自动展开文件夹 hook
	const {
		handleDragEnter: handleAutoExpandDragEnter,
		handleDragLeave: handleAutoExpandDragLeave,
	} = useAutoExpandFolder({
		delay: 1000,
		enabled: allowEdit && (dragState.isDragging || dragState.isExternalDrag), // 只在编辑模式且正在拖拽时启用
		debug: process.env.NODE_ENV === "development",
	})

	// 文件列表区域拖拽 hook
	const {
		isDragOverFileListArea,
		handleTreeDragStart,
		handleTreeDragEnd,
		handleFileListAreaDragEnter,
		handleFileListAreaDragOver,
		handleFileListAreaDragLeave,
		handleFileListAreaDragEnd,
		handleFileListAreaDrop,
	} = useFileListAreaDrag({
		allowEdit,
		handleDrop,
		// 传递新的拖拽移动处理器
		handleFileDragEnter: handleDragEnter,
		handleFileDragLeave: handleDragLeave,
		handleFileDragOver: handleDragOver,
		handleFileDrop,
		// 传递检查函数
		canMoveToRoot,
		// 外部文件上传支持
		allowExternalDrop: allowEdit,
		onUploadFiles: handleUploadFiles,
	})

	// 为TreeNode提供的拖拽目标检查函数
	const isDropTargetNode = useMemoizedFn((node: TreeNodeData) => {
		const item = node.item
		if (!item) return false
		return isDropTarget(item)
	})

	// 使用选中文件管理 hook
	const {
		handleAddMultipleFilesToCurrentChat,
		handleAddMultipleFilesToNewChat,
		handleAddToCurrentChat,
		handleAddToNewChat,
		handleDragStart,
	} = useSelectedFilesManager({
		selectedItems,
		mergedFiles,
		getItemId,
		afterAddFileToCurrentTopic,
		afterAddFileToNewTopic,
		selectedWorkspace,
		selectedProject,
	})

	// 确认移动：交由 hook 内部批量处理
	const handleBatchMoveConfirm = useMemoizedFn(async ({ path }: { path: AttachmentItem[] }) => {
		await moveFileHook.confirmMove({ path })
	})

	// 跨项目文件操作 Hook
	const crossProjectOperation = useCrossProjectFileOperation({
		projectId,
		selectedWorkspace: selectedWorkspace || null,
		selectedProject: selectedProject || null,
		projects,
		onSuccess: () => {
			pubsub.publish(PubSubEvents.Update_Attachments)
			onUpdateAttachments?.()
		},
	})

	// 创建移动文件处理函数的适配器
	const handleMoveFileAdapter = useMemoizedFn((item: AttachmentItem) => {
		// 如果有跨项目操作所需的数据，使用新的跨项目 Modal
		if (selectedWorkspace && selectedProject && projects.length > 0) {
			if (item.file_id) {
				// 获取文件的父目录路径
				const parentPath = getParentPathFromFileId(item.file_id, attachments)
				crossProjectOperation.openMoveModal([item.file_id], parentPath)
			}
		} else {
			// 否则使用原来的 SelectDirectoryModal
			moveFileHook.showMoveSelector(item)
		}
	})

	// 创建复制文件处理函数的适配器
	const handleCopyFileAdapter = useMemoizedFn((fileIds: string[]) => {
		// 获取第一个文件的父目录路径作为默认路径
		const firstFileId = fileIds[0]
		if (firstFileId) {
			const parentPath = getParentPathFromFileId(firstFileId, attachments)
			crossProjectOperation.openCopyModal(fileIds, parentPath)
		} else {
			crossProjectOperation.openCopyModal(fileIds)
		}
	})

	// 文件快捷键 hook（需要在 useContextMenu 之前调用）
	const { getShortcutHint } = useFileShortcuts({
		hoveredItem,
		contextMenuItemId,
		treeData,
		editingVirtualFileId,
		editingVirtualFolderId,
		editingVirtualDesignProjectId,
		renamingItemId,
		handleAddToCurrentChat,
		selectedProjectId: selectedProject?.id || projectId,
		isSelectMode,
		selectedItems,
		handleAddMultipleFilesToCurrentChat,
	})

	const { getMenuItems, getBatchDownloadLayerMenuItems } = useContextMenu({
		handleUploadFile,
		handleUploadFolder,
		handleShareItem: handleShareItemFromHook,
		handleDeleteItem,
		handleDownloadOriginal,
		handleDownloadPdf,
		handleDownloadPpt,
		handleOpenFile,
		handleStartRename,
		handleAddToCurrentChat,
		handleAddToNewChat,
		handleMoveFile: handleMoveFileAdapter,
		handleReplaceFile,
		onCopyFile: handleCopyFileAdapter,
		createVirtualFile,
		createVirtualFolder,
		createVirtualDesignProject,
		isMoving,
		selectedItems,
		handleAddMultipleFilesToCurrentChat,
		handleAddMultipleFilesToNewChat,
		handleDownloadNoWaterMark,
		preloadWaterMarkFreeModal,
		isFreeTrialVersion,
		getShortcutHint,
		handleEnterMultiSelectMode,
		isSelectMode,
		filterMenuItems,
		filterBatchDownloadLayerMenuItems,
	})

	// 重置所有状态的方法
	const resetAllStates = () => {
		resetSelection()
		resetFilter()
		resetUI()
		resetRename()
		resetFileOperations()
		resetVirtualFile()
		resetVirtualFolder()
		resetVirtualDesignProject()
	}

	// 使用 useImperativeHandle 暴露内部方法
	useImperativeHandle(ref, () => ({
		createVirtualFile,
		createVirtualFolder,
		createDesignProject: (parentPath?: string) => {
			// 调用虚拟画布项目创建函数
			createVirtualDesignProject(undefined, parentPath)
			// 返回一个 Promise，在确认创建时 resolve
			return new Promise((resolve) => {
				// 这里我们无法直接等待确认，所以返回一个立即 resolve 的 Promise
				// 实际的创建逻辑在 confirmVirtualDesignProject 中处理
				resolve(null)
			})
		},
		handleUploadFile,
		handleUploadFolder,
		resetAllStates,
	}))

	// 选择处理
	const handleSelect = (selectedKeys: React.Key[]) => {
		handleTreeSelect(selectedKeys)
		// 处理文件选择逻辑
		if (selectedKeys.length > 0) {
			const node = findTreeNodeByKey(treeData, selectedKeys[0] as string)
			if (node) {
				handleItemSelect(node.item)
			}
		}
	}

	// 在树形数据中查找文件的辅助函数
	const findFileInTree = useMemoizedFn((fileId: string): AttachmentItem | undefined => {
		const node = findTreeNodeByKey(treeData, fileId)
		return node?.item
	})

	// 检查文件是否在文件夹的直接子项中（只检查一级，不递归）
	const isFileInFolder = useMemoizedFn(
		(folderItem: AttachmentItem, targetFileId: string): boolean => {
			if (!folderItem?.children || folderItem.children.length === 0) {
				return false
			}

			// 只检查直接子项，不递归检查嵌套文件夹
			return folderItem.children.some((child) => child.file_id === targetFileId)
		},
	)

	// 渲染节点标题
	const titleRender = useMemoizedFn((node: TreeNodeData) => {
		const item = node.item || {}
		const itemId = node.key
		const { metadata } = item
		const isSelected = isItemSelected(itemId)
		const isActiveFile = activeFileId === item?.file_id
		const hasChildren = node.children && node.children.length > 0
		const isExpanded = expandedKeys.includes(node.key)

		const showCheckbox = isSelectMode || (!allowEdit && hasLogin && allowDownload)

		// 检查文件是否在已打开的tabs中
		const currentTabs = mentionPanelStore.getCurrentTabs()
		const isFileOpened =
			!item.is_directory &&
			currentTabs.some((tab: any) => tab?.data?.file_id === item.file_id)

		// 检查是否正在定位此文件
		const isLocating = locatingFileId === item.file_id

		const indentWidth = node.level * 10

		// 渲染展开/折叠图标
		const renderExpandIcon = () => {
			if (!hasChildren) {
				return <div style={{ width: 16, height: 16 }} /> // 占位符，保持对齐
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
					onClick={(e: any) => {
						e.stopPropagation()
						const newExpandedKeys = isExpanded
							? expandedKeys.filter((key) => key !== node.key)
							: [...expandedKeys, node.key]
						setExpandedKeys(newExpandedKeys)
					}}
				/>
			)
		}

		// 如果是虚拟项目，使用特殊渲染
		if (node.isVirtual) {
			const isVirtualFolder = item?.is_directory && node.isVirtual
			const isVirtualDesignProject = editingVirtualDesignProjectId === itemId
			const isVirtualNormalFolder = isVirtualFolder && !isVirtualDesignProject

			return (
				<div
					className={cx(
						styles.fileItem,
						contextMenuItemId === itemId && styles.contextMenuActiveItem,
					)}
					onMouseEnter={() => setHoveredItem(itemId)}
					onMouseLeave={() => setHoveredItem(null)}
					draggable={false}
					onDragStart={(e) => {
						handleDragStart(e, item)
					}}
					onDragEnd={(e) => {
						handleAttachmentDragEnd(e)
					}}
				>
					<div
						className={styles.fileTitle}
						style={{
							paddingLeft: indentWidth + "px",
						}}
					>
						{/* 展开/折叠图标 */}
						<div className={styles.iconWrapper}>{renderExpandIcon()}</div>

						<div className={styles.iconWrapper}>
							{isVirtualDesignProject ? (
								<MagicFileIcon type="design" size={16} />
							) : isVirtualNormalFolder ? (
								<img
									src={FoldIcon as unknown as string}
									alt="folder"
									width={16}
									height={16}
								/>
							) : (
								<MagicFileIcon type={item?.file_extension} size={16} />
							)}
						</div>

						{/* 虚拟项目名输入框 */}
						<InputWithError
							ref={
								isVirtualDesignProject
									? virtualDesignProjectInputRef
									: isVirtualNormalFolder
										? virtualFolderInputRef
										: virtualFileInputRef
							}
							value={
								isVirtualDesignProject
									? virtualDesignProjectName
									: isVirtualNormalFolder
										? virtualFolderName
										: virtualFileName
							}
							onChange={(e: any) => {
								if (isVirtualDesignProject) {
									setVirtualDesignProjectName(e.target.value)
								} else if (isVirtualNormalFolder) {
									setVirtualFolderName(e.target.value)
								} else {
									setVirtualFileName(e.target.value)
								}
							}}
							onFocus={(e) => {
								e.target.scrollIntoView({ behavior: "smooth", block: "center" })
							}}
							onBlur={
								isVirtualDesignProject
									? confirmVirtualDesignProject
									: isVirtualNormalFolder
										? confirmVirtualFolder
										: confirmVirtualFile
							}
							onKeyDown={
								isVirtualDesignProject
									? handleVirtualDesignProjectKeyDown
									: isVirtualNormalFolder
										? handleVirtualFolderKeyDown
										: handleVirtualFileKeyDown
							}
							onClick={(e: any) => e.stopPropagation()}
							errorMessage={
								isVirtualDesignProject
									? designProjectErrorMessage
									: isVirtualNormalFolder
										? folderErrorMessage
										: fileErrorMessage
							}
							showError={
								isVirtualDesignProject
									? !!designProjectErrorMessage
									: isVirtualNormalFolder
										? !!folderErrorMessage
										: !!fileErrorMessage
							}
						/>

						{showCheckbox && (
							<div className={styles.iconWrapper}>
								<Checkbox
									checked={isSelected}
									onCheckedChange={() => {
										handleItemSelect(item)
									}}
									onClick={(e) => e.stopPropagation()}
								/>
							</div>
						)}
					</div>
				</div>
			)
		}

		// 文件夹渲染
		if (item?.is_directory) {
			const folderSelectionState = getFolderSelectionState(item)
			const isFolderSelected = folderSelectionState === "all"
			const isFolderIndeterminate = folderSelectionState === "partial"

			// 检查是否应该高亮文件夹：
			// 1. 如果打开的文件是 index.html，并且该文件夹有 metadata，且该文件在文件夹的子项中
			// 2. 或者文件夹本身是 activeFileId
			const activeFile = activeFileId ? findFileInTree(activeFileId) : undefined
			const isActiveFileIndexHtml =
				activeFile?.file_name === "index.html" ||
				activeFile?.filename === "index.html" ||
				activeFile?.display_filename === "index.html"
			const shouldHighlightFolder =
				// 情况1：子文件是 index.html
				(isActiveFileIndexHtml &&
					!!metadata?.type &&
					activeFileId &&
					isFileInFolder(item, activeFileId)) ||
				// 情况2：文件夹本身是 activeFileId
				(activeFileId === item?.file_id && !!metadata?.type)

			// 使用 createFileDragHandlers 获取拖拽事件处理器
			const folderDragHandlers = createFileDragHandlers({
				item,
				node,
				allowEdit,
				isExpanded,
				dragState,
				selectedItems,
				handleDragStart,
				handleFileDragStart,
				handleFileDragEnd,
				handleAutoExpandDragEnter,
				handleAutoExpandDragLeave,
				getItemId,
				findFileInTree,
				setExpandedKeys,
			})

			return (
				<div
					className={cx(
						styles.fileItem,
						shouldHighlightFolder && styles.activeFileItemWrapper,
						contextMenuItemId === itemId && styles.contextMenuActiveItem,
					)}
					onClick={(e) => {
						e.stopPropagation()
						if (isSelectMode) {
							handleItemSelect(item)
							return
						}

						if (isEmpty(item.metadata)) {
							// 普通文件夹，没有 metadata，直接展开/折叠
							const newExpandedKeys = isExpanded
								? expandedKeys.filter((key) => key !== node.key)
								: [...expandedKeys, node.key]
							setExpandedKeys(newExpandedKeys)
						} else {
							// 有 metadata 的文件或文件夹，需要判断是内容类型渲染还是文件预览
							// 1. 先检查是否是内容类型渲染（不依赖文件内容，有自己的 detail render content）
							// 需要将 AttachmentItem 转换为 FileItem 格式
							const fileItem: FileItem = {
								file_id: item.file_id || "",
								file_name: item.name || item.file_name || "",
								display_filename: item.name || item.file_name,
								is_directory: item.is_directory,
								children: item.children as FileItem[] | undefined,
								metadata: item.metadata,
								file_extension: item.file_extension,
								file_size: item.file_size,
							}
							const contentTypeConfig = detectContentTypeRender(fileItem)

							if (contentTypeConfig) {
								// 内容类型渲染：不依赖文件内容，直接渲染对应的 detail render content
								// 打开标签页
								if (onFileClick && item.file_id) {
									onFileClick(item)
								}

								// 设置详情，使用内容类型渲染
								const transformedData = contentTypeConfig.dataTransformer
									? contentTypeConfig.dataTransformer(fileItem)
									: item

								setUserSelectDetail?.({
									type: contentTypeConfig.detailType,
									data: {
										...item,
										...transformedData,
										file_id: item.file_id,
										file_name: item.name || item.file_name,
										metadata: item.metadata,
									},
									currentFileId: item.file_id,
									attachments,
								})
							} else {
								// 文件预览模式（默认）：查找并加载入口文件（如 index.html）
								const appEntryFile = getAppEntryFile(item?.children || [])
								if (appEntryFile) {
									handleOpenFile(appEntryFile)
								} else {
									// 如果没有入口文件，可能是普通文件夹，展开/折叠
									const newExpandedKeys = isExpanded
										? expandedKeys.filter((key) => key !== node.key)
										: [...expandedKeys, node.key]
									setExpandedKeys(newExpandedKeys)
								}
							}
						}
					}}
					draggable={renamingItemId !== itemId}
					{...folderDragHandlers}
					onMouseEnter={() => setHoveredItem(itemId)}
					onMouseLeave={() => setHoveredItem(null)}
					onContextMenu={(e) => delegateProps.onDropdownContextMenuClick?.(e, item)}
				>
					<div
						className={styles.fileTitle}
						style={{
							paddingLeft: indentWidth + "px",
						}}
					>
						{/* 展开/折叠图标 */}
						<div
							className={styles.iconWrapper}
							onClick={(e) => {
								if (!isEmpty(metadata)) {
									e.stopPropagation()
									const newExpandedKeys = isExpanded
										? expandedKeys.filter((key) => key !== node.key)
										: [...expandedKeys, node.key]
									setExpandedKeys(newExpandedKeys)
								}
							}}
						>
							{renderExpandIcon()}
						</div>

						<div className={styles.iconWrapper}>
							{isFileRenaming(item) ? (
								<Loader2 className="mr-1 animate-spin" size={16} />
							) : movingFiles.has(item?.file_id || "") ? (
								<Loader2 className="mr-1 animate-spin" size={16} />
							) : isFolderDownloading(item) ? (
								<Loader2 className="mr-1 animate-spin" size={16} />
							) : metadata?.type ? (
								<MagicFileIcon
									type={getAttachmentType(item?.metadata) || item?.file_extension}
									size={16}
								/>
							) : (
								<img
									src={FoldIcon as unknown as string}
									alt="folder"
									width={16}
									height={16}
								/>
							)}
						</div>

						{/* 文件夹名称或重命名输入框 */}
						{renamingItemId === itemId ? (
							<InputWithError
								ref={renameInputRef}
								value={renameValue}
								onChange={(e: any) => setRenameValue(e.target.value)}
								onBlur={handleRenameConfirm}
								onKeyDown={handleRenameKeyDown}
								className={styles.renameInput}
								onClick={(e: any) => e.stopPropagation()}
								errorMessage={renameErrorMessage}
								showError={!!renameErrorMessage}
								style={{ flex: 1, marginLeft: "4px" }}
							/>
						) : (
							<SmartTooltip
								placement="right"
								className={cx(
									styles.ellipsis,
									shouldHighlightFolder && styles.activeFileItem,
								)}
								sideOffset={20}
							>
								{item?.name}
							</SmartTooltip>
						)}
					</div>

					{/* 更多按钮 */}
					{!showCheckbox &&
						(hoveredItem === itemId || isMobile) &&
						renamingItemId !== itemId &&
						allowEdit &&
						!(filterMenuItems && allowDownload === false) && (
							<MagicIcon
								className={styles.attachmentAction}
								onClick={(e: any) => {
									e.stopPropagation()
									delegateProps.onDropdownActionClick?.(e, item)
								}}
								component={IconDots}
								stroke={2}
								size={16}
							/>
						)}

					{/* 文件夹的 Checkbox */}
					{showCheckbox && (
						<div className={styles.iconWrapper}>
							<Checkbox
								checked={isFolderIndeterminate ? "indeterminate" : isFolderSelected}
								disabled={isItemDisabled()}
								onCheckedChange={() => {
									handleItemSelect(item)
								}}
								onClick={(e) => e.stopPropagation()}
							/>
						</div>
					)}
				</div>
			)
		}

		// 文件渲染
		// 使用 createFileDragHandlers 获取拖拽事件处理器
		const fileDragHandlers = createFileDragHandlers({
			item,
			node,
			allowEdit,
			isExpanded,
			dragState,
			selectedItems,
			handleDragStart,
			handleFileDragStart,
			handleFileDragEnd,
			handleAutoExpandDragEnter,
			handleAutoExpandDragLeave,
			getItemId,
			findFileInTree,
			setExpandedKeys,
		})

		return (
			<div
				className={cx(
					styles.fileItem,
					isLocating && styles.locatingFileItem,
					isActiveFile && "bg-blue-500/10",
					contextMenuItemId === itemId && styles.contextMenuActiveItem,
				)}
				data-file-id={item.file_id}
				onClick={(e) => {
					console.log("file_id", item.file_id)
					e.stopPropagation()
					if (isSelectMode) {
						handleItemSelect(item)
						return
					}

					if (renamingItemId !== itemId) {
						// 检查是否是内容类型渲染（不依赖文件内容，有自己的 detail render content）
						if (item.metadata?.type) {
							const fileItem: FileItem = {
								file_id: item.file_id || "",
								file_name: item.file_name || item.name || "",
								display_filename: item.file_name || item.name,
								is_directory: item.is_directory,
								children: item.children as FileItem[] | undefined,
								metadata: item.metadata,
								file_extension: item.file_extension,
								file_size: item.file_size,
							}
							const contentTypeConfig = detectContentTypeRender(fileItem)

							if (contentTypeConfig) {
								// 内容类型渲染：不依赖文件内容，直接渲染对应的 detail render content
								// 打开标签页
								if (onFileClick && item.file_id) {
									onFileClick(item)
								}

								// 设置详情，使用内容类型渲染
								const transformedData = contentTypeConfig.dataTransformer
									? contentTypeConfig.dataTransformer(fileItem)
									: item

								setUserSelectDetail?.({
									type: contentTypeConfig.detailType,
									data: {
										...item,
										...transformedData,
										file_id: item.file_id,
										file_name: item.file_name || item.name,
										metadata: item.metadata,
									},
									currentFileId: item.file_id,
									attachments,
								})
								return
							}
						}

						// 文件预览模式（默认）：基于文件扩展名
						handleOpenFile(item)
					}
				}}
				draggable={renamingItemId !== itemId}
				{...fileDragHandlers}
				onMouseEnter={() => setHoveredItem(itemId)}
				onMouseLeave={() => setHoveredItem(null)}
				onContextMenu={(e) => delegateProps.onDropdownContextMenuClick?.(e, item)}
			>
				<div
					className={cx(styles.fileTitle)}
					style={{
						paddingLeft: indentWidth + "px",
					}}
				>
					{/* 展开/折叠图标 */}
					<div className={styles.iconWrapper}>{renderExpandIcon()}</div>

					<div className={styles.iconWrapper}>
						{exportingFiles.has(item?.file_id || "") ? (
							<Loader2 className="mr-1 flex-shrink-0 animate-spin" size={16} />
						) : isFileRenaming(item) ? (
							<Loader2 className="mr-1 flex-shrink-0 animate-spin" size={16} />
						) : movingFiles.has(item?.file_id || "") ? (
							<Loader2 className="mr-1 flex-shrink-0 animate-spin" size={16} />
						) : null}
						<MagicFileIcon
							type={getAttachmentType(item?.metadata) || item?.file_extension}
							size={16}
						/>
					</div>

					{/* 文件名称或重命名输入框 */}
					{renamingItemId === itemId ? (
						<InputWithError
							ref={renameInputRef}
							value={renameValue}
							onChange={(e: any) => setRenameValue(e.target.value)}
							onBlur={handleRenameConfirm}
							onKeyDown={handleRenameKeyDown}
							onClick={(e: any) => e.stopPropagation()}
							errorMessage={renameErrorMessage}
							showError={!!renameErrorMessage}
							style={{
								flex: 1,
								marginLeft: "4px",
							}}
						/>
					) : (
						<SmartTooltip
							placement="right"
							className={cx(
								styles.ellipsis,
								isActiveFile && "font-medium",
								// isFileOpened && styles.openedFileItem
							)}
							sideOffset={20}
						>
							{item?.file_name}
						</SmartTooltip>
					)}
				</div>

				{/* 更多按钮 */}
				{!showCheckbox &&
					(hoveredItem === itemId || contextMenuItemId === itemId || isMobile) &&
					renamingItemId !== itemId &&
					(allowEdit || (filterMenuItems && allowDownload !== false)) && (
						<MagicIcon
							className={styles.attachmentAction}
							onClick={(e: any) => {
								e.stopPropagation()
								delegateProps.onDropdownActionClick?.(e, item)
							}}
							component={IconDots}
							stroke={2}
							size={16}
						/>
					)}

				{/* 文件的 Checkbox */}
				{showCheckbox && (
					<div className={styles.iconWrapper}>
						<Checkbox
							checked={isSelected}
							disabled={isItemDisabled()}
							onCheckedChange={() => {
								handleItemSelect(item)
							}}
							onClick={(e) => e.stopPropagation()}
						/>
					</div>
				)}
			</div>
		)
	})

	const { batchLoading, showBatchDownload, batchMenuItems } = useBatchDownload({
		projectId,
		getItemId,
		selectedItems,
		setSelectedItems,
		filteredFiles: mergedFiles,
		onSelectModeChange,
		// 批量移动和复制所需的依赖
		attachments,
		selectedWorkspace,
		selectedProject,
		projects,
		crossProjectOperation,
		moveFileHook,
		onUpdateAttachments,
		removeFile,
		isMoving,
		// 批量导出进度回调
		onBatchPdfExportStart,
		onBatchPdfExportProgress,
		onBatchPdfExportEnd,
		onBatchPptExportStart,
		onBatchPptExportProgress,
		onBatchPptExportEnd,
		allowEdit,
		// 批量分享回调
		onBatchShareClick: async (fileIds: string[]) => {
			if (fileIds.length > 0) {
				// 检查是否存在相似分享
				try {
					const similarShares = await SuperMagicApi.findSimilarShares({
						file_ids: fileIds,
					})

					if (similarShares && similarShares.length > 0) {
						// 显示相似分享选择弹窗
						setSimilarShares(similarShares, fileIds)
						return
					}
				} catch (error) {
					console.error("Check similar shares failed:", error)
				}

				// 无相似分享，直接打开分享弹窗
				setShareFileInfo({
					projectName: selectedProject?.project_name,
					fileIds,
				})
				setShareModalVisible(true)
			}
		},
		isInProject,
	})

	// 配置右键菜单 - 根据选中状态和语言动态调整宽度
	const { dropdownContent, delegateProps } = useSuperMagicDropdown<AttachmentItem>({
		width: i18n.language.startsWith("en") ? 240 : 220,
		getMenuItems,
		fixedWidth: true, // 跳过 DOM 测量，强制使用配置的 width
		mobileProps: {
			title: t("super:shortcut.fileOperations"),
		},
		onOpenChange: (open, itemData) => {
			// 右键菜单打开时，记录当前文件ID以保持 hover 样式
			// 关闭时清空
			setContextMenuItemId(open && itemData ? getItemId(itemData) : null)
		},
	})

	// 配置批量下载层右键菜单
	const {
		dropdownContent: batchDownloadDropdownContent,
		delegateProps: fileListAreaDelegateProps,
	} = useSuperMagicDropdown<null>({
		width: 180,
		getMenuItems: getBatchDownloadLayerMenuItems,
		mobileProps: {
			title: t("super:topicFiles.batchOperation"),
		},
	})

	return (
		<div className={cx(className, "flex h-[calc(100%-32px)] overflow-auto flex-col")}>
			{/* 右键菜单内容 */}
			{(allowEdit || filterMenuItems) && dropdownContent}
			{allowEdit && batchDownloadDropdownContent}
			{/* Content area */}
			{/* <div className={styles.contentArea}> */}
			{/* File tree */}
			<div
				className={cx(styles.fileListArea, "px-2 pb-2", {
					[styles.dragTargetFolder]: isDragOverFileListArea || dragState.isDragOverRoot, // 添加拖拽悬停样式
				})}
				onContextMenu={(e) =>
					fileListAreaDelegateProps.onDropdownContextMenuClick?.(e, null)
				}
				onDragEnter={handleFileListAreaDragEnter}
				onDragOver={handleFileListAreaDragOver}
				onDragLeave={handleFileListAreaDragLeave}
				onDragEnd={handleFileListAreaDragEnd}
				onDrop={handleFileListAreaDrop}
			>
				{treeData.length > 0 ? (
					<CustomTree
						treeData={treeData}
						// draggable={
						// 	allowEdit
						// 		? {
						// 				icon: false,
						// 		  }
						// 		: false
						// }
						switcherIcon={() => null}
						// onDragStart={handleTreeDragStart}
						// onDragEnd={handleTreeDragEnd}
						// onDrop={handleDrop}
						onExpand={handleExpand}
						onSelect={handleSelect}
						expandedKeys={expandedKeys}
						selectedKeys={selectedKeys}
						titleRender={titleRender}
						showIcon={false}
						blockNode
						className={styles.fileListArea}
						// height={treeHeight}
						dragTargetNodeClass={styles.dragTargetFolder}
						isDragTargetNode={isDropTargetNode}
						onDragEnter={handleTreeNodeDragEnter}
						onDragLeave={handleTreeNodeDragLeave}
						onDragOver={handleTreeNodeDragOver}
						onDrop={handleTreeNodeDrop}
					/>
				) : (
					<EmptyState
						onAddFile={createVirtualFile}
						onAddDesign={createVirtualDesignProject}
						onUploadFile={() => handleUploadFile()}
						allowEdit={allowEdit}
					/>
				)}
			</div>
			{/* </div> */}
			{/* Batch download layer */}
			<div
				className={cx(styles.batchDownloadLayer, {
					[styles.hidden]:
						(!isMobile && !showBatchDownload) || (isMobile && attachments.length <= 0),
					[styles.pcBatchDownloadLayer]: !isMobile,
				})}
			>
				{!isMobile && showBatchDownload && (
					<Flex className={styles.batchOperations}>
						<MagicDropdown
							menu={{ items: batchMenuItems, style: { width: "100%" } }}
							placement="topLeft"
							trigger={["click"]}
						>
							<div style={{ width: "100%" }}>
								<Button
									className={styles.batchDownloadButtonPC}
									disabled={batchLoading}
									style={{ flex: 1, width: "100%" }}
								>
									<Flex align="center" gap={2} justify="center">
										{batchLoading ? (
											<Loader2 className="mr-1 animate-spin" size={16} />
										) : null}
										<span className={styles.batchDownloadButtonPCText}>
											{t("topicFiles.batchOperations")}
										</span>
										<IconChevronDown size={16} stroke={1.5} color="#fff" />
									</Flex>
								</Button>
							</div>
						</MagicDropdown>
					</Flex>
				)}
				{isMobile && isSelectMode && (
					<Button
						variant="secondary"
						className="shadow-xs h-9 px-8 py-2 text-sm font-medium"
						onClick={() => pubsub.publish(PubSubEvents.Cancel_File_Selection)}
					>
						{t("topicFiles.cancelSelect")}
					</Button>
				)}
				{isMobile && isSelectMode && (
					<MagicDropdown
						menu={{ items: batchMenuItems }}
						placement="topLeft"
						trigger={["click"]}
						disabled={!showBatchDownload || batchLoading}
					>
						<Button
							variant="default"
							className="shadow-xs h-9 w-[253px] gap-2 px-4 py-2 text-sm font-medium"
							disabled={!showBatchDownload || batchLoading}
						>
							{batchLoading ? <Loader2 className="animate-spin" size={16} /> : null}
							<span>{t("topicFiles.batchOperation")}</span>
							<ChevronDown size={16} />
						</Button>
					</MagicDropdown>
				)}
				{/* {isMobile && attachments.length > 0 && hasLogin && (
					<>
						<div className={styles.batchDownloadSeparator} />
						<button
							className={styles.batchDownloadButton}
							onClick={handleDownloadAll}
							type="button"
							disabled={allLoading}
						>
							{allLoading ? (
								<Loader2 className="mr-1 animate-spin" size={16} />
							) : null}
							<IconFolderDown size={20} stroke={1.5} color="rgba(28, 29, 35, 0.8)" />
							<span>{t("topicFiles.downloadAllTitle")}</span>
						</button>
					</>
				)} */}
			</div>
			{/* 文件分享模态框 */}
			{shareFileInfo && (
				<ShareModal
					open={shareModalVisible}
					onCancel={() => {
						setShareModalVisible(false)
						setShareFileInfo(null)
					}}
					shareMode={ShareMode.File}
					types={[ShareType.PasswordProtected, ShareType.Public, ShareType.Organization]}
					attachments={attachments}
					resourceId={
						shareFileInfo.resourceId || shareSuccessInfo?.shareInfo?.resource_id
					}
					defaultSelectedFileIds={shareFileInfo.fileIds}
					projectName={shareFileInfo.projectName}
				/>
			)}
			{/* 文件分享成功Modal - 用于已存在的分享 */}
			{shareSuccessInfo && (
				<ShareSuccessModal
					open={true}
					onClose={closeSuccessModal}
					onCancelShare={handleCancelShare}
					onEditShare={handleEditShare}
					shareName={shareSuccessInfo.shareInfo.resource_name || ""}
					projectName={shareSuccessInfo.shareInfo.project_name}
					fileCount={shareSuccessInfo.shareInfo?.extend?.file_count || 1}
					mainFileName={shareSuccessInfo.shareInfo.main_file_name || t("share.untitled")}
					shareUrl={generateShareUrl(
						shareSuccessInfo.shareInfo.resource_id,
						shareSuccessInfo.shareInfo.password,
						"files",
					)}
					password={shareSuccessInfo.shareInfo.password}
					expire_at={shareSuccessInfo.shareInfo.expire_at}
					shareType={shareSuccessInfo.shareInfo.share_type}
					shareProject={shareSuccessInfo.shareInfo.share_project}
					fileIds={shareSuccessInfo.shareInfo.file_ids}
				/>
			)}
			{/* 相似分享Dialog/Drawer */}
			{similarSharesInfo &&
				(isMobile ? (
					<SimilarSharesDrawer
						open={true}
						onClose={closeSimilarSharesDialog}
						shares={similarSharesInfo.similarShares}
						onSelectShare={handleSelectSimilarShare}
						onCreateNew={handleCreateNewShare}
					/>
				) : (
					<SimilarSharesDialog
						open={true}
						onClose={closeSimilarSharesDialog}
						shares={similarSharesInfo.similarShares}
						onSelectShare={handleSelectSimilarShare}
						onCreateNew={handleCreateNewShare}
					/>
				))}
			{/* 同名文件处理 Modal - 只在使用内部 handler 时渲染 */}
			{!externalDuplicateHandler && (
				<DuplicateFileModal
					visible={sharedDuplicateHandler.modalVisible}
					fileName={sharedDuplicateHandler.currentFileName}
					totalDuplicates={sharedDuplicateHandler.totalDuplicates}
					onCancel={sharedDuplicateHandler.handleCancel}
					onReplace={sharedDuplicateHandler.handleReplace}
					onKeepBoth={sharedDuplicateHandler.handleKeepBoth}
				/>
			)}
			{/* 移动文件选择器 */}
			{
				<SelectDirectoryModal
					{...{
						...moveFileHook.selectorConfig,
						visible: moveFileHook.selectorConfig.visible,
						onSubmit: handleBatchMoveConfirm,
					}}
				/>
			}
			{/* 跨项目文件操作 Modal */}
			{selectedWorkspace && selectedProject && projects.length > 0 && workspaces && (
				<CrossProjectFileOperationModal
					visible={crossProjectOperation.visible}
					title={
						crossProjectOperation.operationType === "move"
							? t("topicFiles.contextMenu.moveTo")
							: t("topicFiles.contextMenu.copyTo")
					}
					operationType={crossProjectOperation.operationType}
					selectedWorkspace={selectedWorkspace}
					selectedProject={selectedProject}
					workspaces={workspaces}
					fileIds={crossProjectOperation.fileIds}
					sourceAttachments={attachments}
					initialPath={crossProjectOperation.initialPath}
					onClose={crossProjectOperation.closeModal}
					onSubmit={
						crossProjectOperation.operationType === "move"
							? crossProjectOperation.executeMoveOperation
							: crossProjectOperation.executeCopyOperation
					}
				/>
			)}
			{/* 跨项目移动/复制同名文件处理 Modal */}
			<DuplicateFileModal
				visible={crossProjectOperation.duplicateModalVisible}
				fileName={crossProjectOperation.currentDuplicateFileName}
				totalDuplicates={crossProjectOperation.totalDuplicates}
				onCancel={crossProjectOperation.handleDuplicateCancel}
				onReplace={crossProjectOperation.handleDuplicateReplace}
				onKeepBoth={crossProjectOperation.handleDuplicateKeepBoth}
			/>
			{/* 移动/复制进度提示 - 使用 Portal 渲染到 body */}
			{createPortal(
				<MagicProgressToast
					visible={isMoving || crossProjectOperation.isOperating}
					progress={
						crossProjectOperation.isOperating
							? crossProjectOperation.operationProgress
							: moveProgress
					}
					text={
						crossProjectOperation.isOperating &&
						crossProjectOperation.operationType === "copy"
							? t("topicFiles.copying")
							: t("topicFiles.moving")
					}
					position="top"
					width={280}
					showPercentage={true}
					progressHeight={4}
					zIndex={99999}
				/>,
				document.body,
			)}
			{/* PDF 导出进度提示 - 使用 Portal 渲染到 body */}
			{createPortal(
				<MagicProgressToast
					visible={isExportingPdf}
					progress={pdfExportProgress}
					text={t("topicFiles.exportingPdf")}
					position="top"
					width={280}
					showPercentage={true}
					progressHeight={4}
					zIndex={99999}
				/>,
				document.body,
			)}
			{/* PPT 导出进度提示 - 使用 Portal 渲染到 body */}
			{createPortal(
				<MagicProgressToast
					visible={isExportingPpt}
					progress={pptExportProgress}
					text={t("topicFiles.exportingPpt")}
					position="top"
					width={280}
					showPercentage={true}
					progressHeight={4}
					zIndex={99999}
				/>,
				document.body,
			)}
			{/* 批量 PDF 导出进度提示 - 使用 Portal 渲染到 body */}
			{createPortal(
				<MagicProgressToast
					visible={isBatchExportingPdf}
					progress={batchPdfExportProgress}
					text={t("topicFiles.batchExportingPdf")}
					position="top"
					width={280}
					showPercentage={true}
					progressHeight={4}
					zIndex={99999}
				/>,
				document.body,
			)}
			{/* 批量 PPT 导出进度提示 - 使用 Portal 渲染到 body */}
			{createPortal(
				<MagicProgressToast
					visible={isBatchExportingPpt}
					progress={batchPptExportProgress}
					text={t("topicFiles.batchExportingPpt")}
					position="top"
					width={280}
					showPercentage={true}
					progressHeight={4}
					zIndex={99999}
				/>,
				document.body,
			)}
			{/* 下载无水印图片协议弹窗 */}
			{agreementModal}
		</div>
	)
})

export default TopicFilesCore
