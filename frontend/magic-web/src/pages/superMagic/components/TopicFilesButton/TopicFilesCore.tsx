import { useFileTagVisibility } from "./hooks/useFileTagVisibility"
import { FileResourceIcon } from "./components/FileResourceIcon"
import { getFilePresentationIndex, resolveFilePresentation } from "./utils/file-presentation"
import type { FileHelpContext } from "./utils/magic-system-folder"
import { ProjectFileTag } from "./components/TopicFileTag"
import { useFileAccess } from "@/pages/superMagic/providers/FileAccessProvider"
import { IconChevronDown, IconChevronRight, IconDots } from "@tabler/icons-react"
import { Loader2, ChevronDown, Files, ArrowRight } from "lucide-react"
import { Flex, message } from "antd"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { useMemo, useImperativeHandle, forwardRef, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "react-i18next"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import MagicSpin from "@/components/base/MagicSpin"
import MagicIcon from "@/components/base/MagicIcon"
import FoldIcon from "@/pages/superMagic/assets/svg/file-folder.svg"
import CustomTree from "./components/CustomTree/CustomTree"
import EmptyState from "./components/EmptyState"
import { useStyles } from "./style"
import { useMemoizedFn } from "ahooks"
import { useSuperMagicDropdown } from "../SuperMagicDropdown"
import { useIsMobile } from "@/hooks/useIsMobile"
import {
	useRename,
	useFileOperations,
	useContextMenu,
	useFileInfoPanel,
	useFileSelection,
	useBatchDownload,
	useFileFilter,
	useVirtualFile,
	useVirtualFolder,
	useVirtualDesignProject,
	useVirtualSelfMediaProject,
	useVirtualAICardProject,
	useTreeUI,
	useDragMove,
	useTopicFilesTreeDerivation,
	useFileListAreaDrag,
	useMoveFile,
	useSelectedFilesManager,
	useTopicFilesPerfSession,
	measureMergedFilesBuild,
	isInRootDirectory,
	useAutoExpandFolder,
	createFileDragHandlers,
	useShareFile,
	useStableTreeNodeDragHandlers,
	useTopicFileRowRenderVersion,
	useCrossProjectMoveCompensation,
	useCopyFileSelector,
} from "./hooks"
import { useFileShortcuts } from "./hooks/useFileShortcuts"
import {
	useCrossProjectFileOperation,
	type CrossProjectOperationSuccessResult,
} from "./hooks/useCrossProjectFileOperation"
import { useImportFromOtherProject } from "./hooks/useImportFromOtherProject"
import CrossProjectFileOperationModal from "../SelectPathModal/components/CrossProjectFileOperationModal"
import ImportFromOtherProjectModal from "../SelectPathModal/components/ImportFromOtherProjectModal"
import { useDragUpload } from "./hooks/useDragUpload"
import { useUploadWithModal } from "./hooks/useUploadWithModal"
import { getDuplicateFileModalProps } from "./components/duplicateFileModalProps"
import { type PresetFileType } from "./constant"
import { useDuplicateFileHandler } from "./hooks/useDuplicateFileHandler"

import { useLocateFile } from "./hooks/useLocateFile"
import type { AttachmentItem } from "./hooks/types"
import { SuperMagicApi } from "@/apis"

import ShareModal from "../Share/Modal"
import ShareSuccessModal from "../Share/FileShareModal/ShareSuccessModal"
import SimilarSharesDialog from "../Share/SimilarSharesDialog"
import SimilarSharesDrawer from "../Share/SimilarSharesDrawer"
import { generateShareUrl } from "../ShareManagement/utils/shareTypeHelpers"
import { ShareMode, ShareType } from "../Share/types"
import ProjectShareSheet from "@/pages/superMagicMobile/components/ProjectShareSheet"
import type { TreeNodeData } from "./utils/treeDataConverter"
import { DuplicateFileModal } from "./components/DuplicateFileModal"
import { FolderConflictModal } from "./components/FolderConflictModal"
import {
	ProjectFileImagePreviewProvider,
	resolveProjectFileImagePreviewSource,
	useProjectFileImagePreviewManager,
} from "./components/ProjectFileImagePreviewProvider"
import { ProjectFileImageThumbnailIcon } from "./components/ProjectFileImageThumbnailIcon"
import { ProjectFileImageSmartTooltip } from "./components/ProjectFileImageSmartTooltip"
import { InputWithError } from "./components"
import { getAppEntryFile } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import { isEmpty } from "lodash-es"
import { Button } from "@/components/shadcn-ui/button"
import { useOrganization } from "@/models/user/hooks/useOrganization"
import MagicProgressToast from "@/components/base/MagicProgressToast"
import { SelectDirectoryModal } from "../SelectPathModal"
import { handleAttachmentDragEnd } from "../MessageEditor/utils/drag"
import SmartTooltip from "@/components/other/SmartTooltip"
import { isCachedChatWorkspaceProject } from "@/pages/superMagic/utils/isChatWorkspaceProject"

import { useDownloadImageMenu } from "../Detail/contents/Image/hooks/useDownloadImageMenu"
import { DownloadImageMode } from "../../pages/Workspace/types"
import { useDownloadProgress } from "@/pages/superMagic/hooks/useDownloadProgress"
import { userStore } from "@/models/user"
import { MagicDropdown } from "@/components/base"
import { detectContentTypeRender } from "../Detail/components/FilesViewer/utils/preview"
import { markProjectFileListScrollActivity } from "@/pages/superMagic/utils/fileListScrollActivity"
import type { FileItem } from "../Detail/components/FilesViewer/types"
import type { TopicFileRowDecorationResolver } from "./topic-file-row-decoration.types"
import { DetailType } from "../Detail/types"
import SelfMediaPostRowPlatformIcon from "../Detail/components/SelfMediaRootRender/components/SelfMediaPostRowPlatformIcon"
import { useSelfMediaTreeNavigation } from "./hooks/useSelfMediaTreeNavigation"
import { useAICardTreeNavigation } from "./hooks/useAICardTreeNavigation"
import { useAICardCreateDialog } from "../Detail/components/SelfMediaRootRender/components/AICardCreateDialog"
import { isNoHoverCoarsePointer } from "@/utils/devices"
import { useActiveTreeSelection } from "./hooks/useActiveTreeSelection"
import {
	shouldEnableTopicFileSelection,
	shouldShowMobileBatchActions,
} from "./utils/batch-selection"
import { isSlidesTemplateFolder, toSlidesTemplatePreviewItem } from "./utils/slides-template-folder"
import { resolveTopicFilesCapabilities, type TopicFilesSpaceConfig } from "./file-space"
import { getAttachmentKey } from "./utils/getAttachmentKey"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/shadcn-ui/dialog"
import type { ProjectFilesStore } from "@/stores/projectFiles"

export interface TopicFilesExpansionState {
	hasExpandableFolders: boolean
	allFoldersExpanded: boolean
}

interface TopicFilesCoreProps {
	/** 所属定义工作区；用户挂载文件仍以自己的空间身份为准。 */
	fileHelpContext?: FileHelpContext
	className?: string
	fitContent?: boolean
	showEmptyState?: boolean
	scrollElementRef?: React.RefObject<HTMLElement>
	attachments?: AttachmentItem[]
	setUserSelectDetail?: (detail: any) => void
	onFileClick?: (fileItem: any) => void
	projectId?: string
	shareCode?: string
	sharePassword?: string
	onCrossProjectOperationSuccess?: (result: CrossProjectOperationSuccessResult) => void
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
	onExpansionStateChange?: (state: TopicFilesExpansionState) => void
	allowEdit?: boolean
	onUpdateAttachments?: (sourceProjectId?: string) => void
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
	filterMenuItems?: (menuItems: any[], item?: AttachmentItem) => any[]
	// 自定义批量下载菜单过滤器
	filterBatchDownloadLayerMenuItems?: (menuItems: any[]) => any[]
	// 是否允许下载（用于分享页面权限控制）
	allowDownload?: boolean
	// 是否允许只读分享场景中的已登录用户复制文件到自己的项目
	allowCopyTo?: boolean
	// Allow a read-only host such as a public share to expose batch selection without login.
	allowReadonlySelection?: boolean
	resolveTopicFileRowDecoration?: TopicFileRowDecorationResolver
	// 刷新加载状态
	refreshLoading?: boolean
	onSaveSlidesTemplate?: (item: AttachmentItem) => void
	onConvertToSlidesTemplate?: (item: AttachmentItem) => void
	/** 文件树所属空间及其能力配置。 */
	spaceConfig?: TopicFilesSpaceConfig
	/** 判断节点是否允许参与移动和多选等变更操作。 */
	isItemSelectable?: (item: AttachmentItem) => boolean
	/** 特殊文件空间允许操作的固定根目录。 */
	operationRoot?: AttachmentItem
	projectFilesStore?: ProjectFilesStore
}

const DEFAULT_ITEM_SELECTABLE = () => true

// 定义 ref 暴露的方法接口
export interface TopicFilesCoreRef {
	selectAll: () => void
	deselectAll: () => void
	createVirtualFile: (type: PresetFileType, key?: string, parentPath?: string) => void
	createVirtualFolder: (key?: string, parentPath?: string) => void
	createDesignProject: (parentPath?: string) => Promise<any>
	createSelfMediaProject: (parentPath?: string) => void
	createAICardProject: (parentPath?: string) => void
	handleUploadFile: (item?: any) => void
	handleUploadFolder: (item?: any) => void
	handleImportFromOtherProject: (item?: any) => void
	openBatchMoveByFileIds: (fileIds: string[]) => void
	toggleAllFolders: () => void
	resetAllStates: () => void
}

const TopicFilesCore = forwardRef<TopicFilesCoreRef, TopicFilesCoreProps>(function TopicFilesCore(
	{
		className,
		fitContent = false,
		showEmptyState = true,
		scrollElementRef,
		attachments = [],
		setUserSelectDetail,
		onFileClick: onFileClickProp,
		projectId,
		shareCode,
		sharePassword,
		onCrossProjectOperationSuccess,
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
		onExpansionStateChange,
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
		allowCopyTo = false,
		allowReadonlySelection = false,
		resolveTopicFileRowDecoration,
		fileHelpContext,
		refreshLoading = false,
		onSaveSlidesTemplate,
		onConvertToSlidesTemplate,
		spaceConfig,
		isItemSelectable = DEFAULT_ITEM_SELECTABLE,
		operationRoot,
		projectFilesStore,
	},
	ref,
) {
	const { permissions: access } = useFileAccess()
	// Folder, keyboard and custom display entries all use this callback to open a file.
	const guardedFileClick = useCallback<NonNullable<TopicFilesCoreProps["onFileClick"]>>(
		(item) => {
			if (access.view && access.preview) onFileClickProp?.(item)
		},
		[access.view, access.preview, onFileClickProp],
	)
	const onFileClick = onFileClickProp ? guardedFileClick : undefined
	const { t, i18n } = useTranslation("super")
	const { styles, cx } = useStyles({ isExpanded: true })
	const isMobile = useIsMobile()
	const capabilities = resolveTopicFilesCapabilities(spaceConfig?.capabilities)
	const directorySource = spaceConfig?.directorySource
	const operations = spaceConfig?.operations
	// Mobile layouts and no-hover desktop touch layouts must keep file actions reachable.
	const shouldShowInlineFileAction = isMobile || isNoHoverCoarsePointer()
	const fileListAreaRef = useRef<HTMLDivElement>(null)
	useFileTagVisibility(fileListAreaRef)
	const shortcutContainerRef = useRef<HTMLDivElement>(null)
	const { organizationCode } = useOrganization()
	// 有userId，认为有登录状态
	const hasLogin = Boolean(userStore.user?.userInfo?.user_id)
	const selectionEnabledByPermission = shouldEnableTopicFileSelection({
		isSelectMode,
		allowEdit,
		allowDownload,
		allowCopyTo,
		hasLogin,
		allowReadonlySelection,
	})
	const selectionEnabled = capabilities.multiSelect && selectionEnabledByPermission
	const isChatProject = isCachedChatWorkspaceProject(selectedProject)
	const canUseDesktopCrossProjectMove = capabilities.crossProject && !isChatProject && !isMobile
	const { handleShowInfo, fileInfoPanel } = useFileInfoPanel()
	const downloadProgress = useDownloadProgress()

	// AI 卡片创建弹窗 hook
	const { open: openAICardDialog, dialogElement: aiCardDialogElement } = useAICardCreateDialog({
		projectId,
	})

	const workspaceId = selectedProject?.workspace_id
	useTopicFilesPerfSession({
		attachments,
		projectId,
		selectedProjectId: selectedProject?.id,
	})

	// 创建共享的同名文件处理 handler（单例）
	// 优先使用外部传入的 handler，否则创建内部 handler
	const internalDuplicateHandler = useDuplicateFileHandler({
		attachments: attachments || [],
	})
	const sharedDuplicateHandler = externalDuplicateHandler || internalDuplicateHandler

	// 拖拽上传 hook
	const { handleUploadFiles: handleUploadFilesInternal } = useDragUpload({
		allowUpload: allowEdit && capabilities.upload,
		projectId,
		fileScope: spaceConfig?.scope,
		selectedProject,
		selectedTopic,
		workspaceId,
		debug: process.env.NODE_ENV === "development",
		attachments,
		duplicateFileHandler: sharedDuplicateHandler,
		onUpdateAttachments,
	})

	// 使用hooks
	const {
		renamingItemId,
		renamePending,
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
		fileScope: spaceConfig?.scope,
		isCurrent: operations?.isCurrent,
		allowDotStart: operations?.allowDotStart,
		resolveSiblings: operations?.resolveSiblings,
		beforeRename: operations?.beforeRename,
		onRenameSuccess: (oldName, newName) => {
			operations?.onRenameSuccess?.(oldName, newName)
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
		handleUploadFile: handleUploadFileInternal,
		handleUploadFolder: handleUploadFolderInternal,
		handleDeleteItem,
		handleDownloadOriginal,
		handleDownloadPdf,
		handleDownloadPptx,
		handleDownloadImage,
		handleOpenFile,
		handleMoveFile,
		shareModalVisible,
		setShareModalVisible,
		shareFileInfo,
		setShareFileInfo,
		handleShareSave,
		exportingFiles,
		createFileAndUpload,
		downloadSelectedFiles,
		createFolderAndUpload,
		createDesignProject,
		createSelfMediaProject,
		createAICardProject,
		movingFiles,
		downloadingFolders,
		isFolderDownloading,
		removeFile,
	} = useFileOperations({
		isCurrent: operations?.isCurrent,
		resolveCreateParent: operations?.resolveCreateParent,
		onNodeCreated: operations?.onNodeCreated,
		setUserSelectDetail,
		onFileClick,
		attachments,
		selectedTopic,
		projectId,
		projectFilesStore,
		fileScope: spaceConfig?.scope,
		// 添加文件创建成功回调
		onFileCreated: (fileItem: any) => {
			console.log("🔵 文件创建成功回调:", fileItem)
			// 如果有 onFileClick 回调，调用它来打开文件Tab
			if (onFileClick) {
				// 等待一小段时间确保文件列表已更新
				setTimeout(() => {
					if (operations?.isCurrent && !operations.isCurrent()) return
					onFileClick(fileItem)
				}, 100)
			}
		},
		onUpdateAttachments,
		onAttachmentsChange,
		getItemId,
		selectedProject,
		duplicateFileHandler: sharedDuplicateHandler,
		downloadProgress,
	})

	const {
		agreementModal,
		handleDownloadNoWaterMark,
		isFreeTrialVersion,
		preloadWaterMarkFreeModal,
		shouldUseSingleDownloadEntry,
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
		enableCache: !directorySource,
		expandedKeys: directorySource?.expandedKeys,
		onExpandedKeysChange: directorySource?.onExpandedKeysChange,
		searchValue: externalSearchValue,
		matchedItemPaths,
	})
	const {
		hoveredItemRef,
		setHoveredItem,
		contextMenuItemId,
		setContextMenuItemId,
		expandedKeys,
		setExpandedKeys,
		selectedKeys,
		handleSelect: handleTreeSelect,
		resetUI,
		cacheLoaded,
	} = treeUI

	const {
		editingVirtualId: editingVirtualFileId,
		isCreating: isCreatingFile,
		virtualFileName,
		setVirtualFileName,
		errorMessage: fileErrorMessage,
		virtualInputRef: virtualFileInputRef,
		createVirtualFile: createVirtualFileInternal,
		handleVirtualFileKeyDown,
		mergeVirtualFiles,
		confirmVirtualFile,
		resetVirtualFile,
	} = useVirtualFile({
		resolveSiblings: operations?.resolveCreateSiblings,
		allowDotStart: operations?.allowDotStart,
		isCurrent: operations?.isCurrent,
		attachments,
		setExpandedKeys,
		expandedKeys,
		onFileCreate: createFileAndUpload,
		onAttachmentsChange,
	})

	const {
		editingVirtualId: editingVirtualFolderId,
		isCreating: isCreatingFolder,
		virtualFolderName,
		setVirtualFolderName,
		errorMessage: folderErrorMessage,
		virtualInputRef: virtualFolderInputRef,
		createVirtualFolder: createVirtualFolderInternal,
		handleVirtualFolderKeyDown,
		mergeVirtualFolders,
		confirmVirtualFolder,
		resetVirtualFolder,
	} = useVirtualFolder({
		resolveSiblings: operations?.resolveCreateSiblings,
		allowDotStart: operations?.allowDotStart,
		isCurrent: operations?.isCurrent,
		attachments,
		setExpandedKeys,
		expandedKeys,
		onFolderCreate: createFolderAndUpload,
		onAttachmentsChange,
	})

	/** 获取特殊文件空间固定根目录的标准路径。 */
	const operationRootPath = useMemo(() => {
		if (!operationRoot) return undefined
		if (directorySource) return operationRoot.relative_file_path

		const rootName = operationRoot.file_name || operationRoot.name || operationRoot.filename
		return operationRoot.relative_file_path || (rootName ? `/${rootName}` : undefined)
	}, [operationRoot, directorySource])

	/** 在未指定父目录时，将新文件创建到特殊文件空间的固定根目录。 */
	const createVirtualFile = useMemoizedFn(
		(type: PresetFileType, key?: string, parentPath?: string) => {
			// 显示根不是树中的一行；根部新建在当前列表编辑，实际目标由空间回调决定。
			if (directorySource && (!key || key === operationRoot?.file_id)) {
				createVirtualFileInternal(type)
				return
			}
			createVirtualFileInternal(
				type,
				key ?? operationRoot?.file_id,
				parentPath ?? operationRootPath,
			)
		},
	)

	/** 在未指定父目录时，将新目录创建到特殊文件空间的固定根目录。 */
	const createVirtualFolder = useMemoizedFn((key?: string, parentPath?: string) => {
		if (directorySource && (!key || key === operationRoot?.file_id)) {
			createVirtualFolderInternal()
			return
		}
		createVirtualFolderInternal(key ?? operationRoot?.file_id, parentPath ?? operationRootPath)
	})

	const uploadTargetRef = useRef<AttachmentItem>()
	const directoryUpload = useUploadWithModal({
		projectId,
		fileScope: spaceConfig?.scope,
		title: t("userSpace.title"),
		resolveUploadTarget: operations
			? () => operations.resolveUploadTarget(uploadTargetRef.current)
			: undefined,
	})
	const cancelDirectoryUpload = useMemoizedFn(directoryUpload.cancelDirectUpload)
	useEffect(
		() => () => cancelDirectoryUpload(),
		[directorySource?.identityKey, cancelDirectoryUpload],
	)

	/** 在未指定目标目录时，将文件选择上传定位到特殊文件空间的固定根目录。 */
	const handleUploadFile = useMemoizedFn((item?: AttachmentItem) => {
		if (operations) {
			uploadTargetRef.current = item
			directoryUpload.handleCustomUploadFile()
			return
		}
		handleUploadFileInternal(item ?? operationRoot)
	})

	/** 在未指定目标目录时，将目录选择上传定位到特殊文件空间的固定根目录。 */
	const handleUploadFolder = useMemoizedFn((item?: AttachmentItem) => {
		handleUploadFolderInternal(item ?? operationRoot)
	})

	/** 在未指定拖拽目标时，将外部文件上传到特殊文件空间的固定根目录。 */
	const handleUploadFiles = useMemoizedFn(
		async (files: File[], targetItem: AttachmentItem | undefined, isFolder: boolean) => {
			if (operations) {
				if (isFolder) return
				uploadTargetRef.current = targetItem
				await directoryUpload.handleFilesSelected(files)
				return
			}
			await handleUploadFilesInternal(files, targetItem ?? operationRoot, isFolder)
		},
	)

	const {
		editingVirtualId: editingVirtualDesignProjectId,
		virtualDesignProjectName,
		setVirtualDesignProjectName,
		errorMessage: designProjectErrorMessage,
		virtualInputRef: virtualDesignProjectInputRef,
		createVirtualDesignProject,
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
		isCurrent: operations?.isCurrent,
	})

	const {
		editingVirtualId: editingVirtualSelfMediaProjectId,
		virtualSelfMediaProjectName,
		setVirtualSelfMediaProjectName,
		errorMessage: selfMediaProjectErrorMessage,
		virtualInputRef: virtualSelfMediaProjectInputRef,
		createVirtualSelfMediaProject,
		handleVirtualSelfMediaProjectKeyDown,
		mergeVirtualSelfMediaProjects,
		confirmVirtualSelfMediaProject,
		resetVirtualSelfMediaProject,
	} = useVirtualSelfMediaProject({
		attachments,
		setExpandedKeys,
		expandedKeys,
		onSelfMediaProjectCreate: createSelfMediaProject,
		onAttachmentsChange,
	})

	const {
		editingVirtualId: editingVirtualAICardProjectId,
		virtualAICardProjectName,
		setVirtualAICardProjectName,
		errorMessage: aiCardProjectErrorMessage,
		virtualInputRef: virtualAICardProjectInputRef,
		createVirtualAICardProject,
		handleVirtualAICardProjectKeyDown,
		mergeVirtualAICardProjects,
		confirmVirtualAICardProject,
		resetVirtualAICardProject,
	} = useVirtualAICardProject({
		attachments,
		setExpandedKeys,
		expandedKeys,
		onAICardProjectCreate: createAICardProject,
		onAttachmentsChange,
	})

	// 合并虚拟文件和虚拟文件夹和虚拟画布项目和虚拟自媒体项目和虚拟AI卡片项目和真实文件
	const mergedFiles = useMemo(() => {
		return measureMergedFilesBuild(filteredFiles.length, () => {
			const withVirtualFiles = mergeVirtualFiles(filteredFiles)
			const withVirtualFolders = mergeVirtualFolders(withVirtualFiles)
			const withVirtualDesignProjects = mergeVirtualDesignProjects(withVirtualFolders)
			const withVirtualSelfMediaProjects =
				mergeVirtualSelfMediaProjects(withVirtualDesignProjects)
			return mergeVirtualAICardProjects(withVirtualSelfMediaProjects)
		})
	}, [
		filteredFiles,
		mergeVirtualFiles,
		mergeVirtualFolders,
		mergeVirtualDesignProjects,
		mergeVirtualSelfMediaProjects,
		mergeVirtualAICardProjects,
	])
	const { treeIndex, expandedKeySet, visibleRows, visibleNodes, visibleNodeIndexByKey } =
		useTopicFilesTreeDerivation({
			attachments,
			mergedFiles,
			expandedKeys,
			externalSearchValue,
			renamingItemId,
			refreshLoading,
			selectedProjectId: selectedProject?.id || projectId,
		})

	const helpProjectId = String(selectedProject?.id || projectId || "")
	const helpOwner = fileHelpContext?.kind ?? (helpProjectId ? "project" : "unknown")
	const helpOwnerId =
		fileHelpContext && "projectId" in fileHelpContext
			? fileHelpContext.projectId
			: helpProjectId
	const resolvedFileHelpContext = useMemo<FileHelpContext>(
		() =>
			helpOwner === "user" || helpOwner === "unknown"
				? { kind: helpOwner }
				: { kind: helpOwner, projectId: helpOwnerId },
		[helpOwner, helpOwnerId],
	)
	// treeIndex 已经过搜索过滤，可能不含包入口；用途必须基于已加载原始快照，不能随搜索变更。
	const skillFiles = useMemo(() => getFilePresentationIndex(attachments).skills, [attachments])
	const fileHelpVersion = `${resolvedFileHelpContext.kind}:${"projectId" in resolvedFileHelpContext ? resolvedFileHelpContext.projectId : ""}`

	// 复用现有索引收集非空目录，避免在大文件树上再次递归 attachments。
	useEffect(() => {
		if (!directorySource) return
		for (const key of expandedKeys) {
			const item = treeIndex.getItemById(String(key))
			if (item?.directoryLoadState === "unloaded")
				void directorySource.loadDirectory(String(key)).catch(() => undefined)
		}
	}, [directorySource, expandedKeys, treeIndex])

	useEffect(() => {
		if (!directorySource?.locateFileId) return
		const keys = directorySource
			.getPath(directorySource.locateFileId)
			.filter((item) => item.is_directory)
			.map((item) => String(item.file_id))
		setExpandedKeys((previous) => Array.from(new Set([...previous, ...keys])))
	}, [directorySource?.locateFileId])

	const expandableFolderKeys = useMemo(() => {
		const folderKeys: string[] = []
		treeIndex.childKeysByKey.forEach((childKeys, key) => {
			if (childKeys.length > 0) folderKeys.push(key)
		})
		return folderKeys
	}, [treeIndex])
	const expansionState = useMemo<TopicFilesExpansionState>(() => {
		const hasExpandableFolders = expandableFolderKeys.length > 0
		return {
			hasExpandableFolders,
			allFoldersExpanded:
				hasExpandableFolders &&
				expandableFolderKeys.every((key) => expandedKeySet.has(key)),
		}
	}, [expandableFolderKeys, expandedKeySet])

	// 项目切换时也重新上报，避免 Header 沿用上一个项目的展开摘要。
	useEffect(() => {
		onExpansionStateChange?.(expansionState)
	}, [expansionState, onExpansionStateChange, projectId])

	const toggleAllFolders = useMemoizedFn(() => {
		setExpandedKeys(expansionState.allFoldersExpanded ? [] : expandableFolderKeys)
	})

	const getFolderSubtreeKeys = useMemoizedFn((item: AttachmentItem): string[] => {
		const folderEntry =
			treeIndex.getEntryById(item.file_id) || treeIndex.getEntryByKey(getAttachmentKey(item))
		if (!folderEntry) return []

		return [folderEntry.key, ...treeIndex.getDescendantKeysByKey(folderEntry.key)]
	})

	const getExpandableFolderSubtreeKeys = useMemoizedFn((item: AttachmentItem): string[] => {
		// 展开状态只需要目录 key，文件节点无需写入 expandedKeys。
		return getFolderSubtreeKeys(item).filter(
			(key) => (treeIndex.childKeysByKey.get(key)?.length || 0) > 0,
		)
	})

	const isFolderContentsExpanded = useMemoizedFn((item: AttachmentItem): boolean => {
		const expandableSubtreeKeys = getExpandableFolderSubtreeKeys(item)
		return (
			expandableSubtreeKeys.length > 0 &&
			expandableSubtreeKeys.every((key) => expandedKeySet.has(key))
		)
	})

	const handleExpandFolderContents = useMemoizedFn((item: AttachmentItem) => {
		const expandableSubtreeKeys = getExpandableFolderSubtreeKeys(item)
		if (expandableSubtreeKeys.length === 0) return

		setExpandedKeys((currentKeys) =>
			Array.from(new Set([...currentKeys.map(String), ...expandableSubtreeKeys])),
		)
	})

	const handleCollapseFolderContents = useMemoizedFn((item: AttachmentItem) => {
		const subtreeKeySet = new Set(getFolderSubtreeKeys(item))
		if (subtreeKeySet.size === 0) return

		setExpandedKeys((currentKeys) =>
			currentKeys.filter((key) => !subtreeKeySet.has(String(key))),
		)
	})

	const handleToggleFolderContents = useMemoizedFn((item: AttachmentItem) => {
		if (isFolderContentsExpanded(item)) {
			handleCollapseFolderContents(item)
			return
		}

		handleExpandFolderContents(item)
	})

	// 文件定位 hook
	const { locatingFileId } = useLocateFile({
		treeIndex,
		expandedKeys,
		setExpandedKeys,
		selectedProjectId: selectedProject?.id || projectId,
	})

	// 文件选择 hook (需要先声明，因为 moveFileHook 需要使用 selectedItems)
	const {
		selectedItems,
		setSelectedItems,
		handleItemSelect,
		getFolderSelectionState,
		isItemDisabled,
		resetSelection,
		handleSelectAll,
		handleDeselectAll,
		handleEnterMultiSelectMode,
		isItemSelected,
	} = useFileSelection({
		listenGlobalEvents: !directorySource,
		projectId,
		getItemId,
		treeIndex,
		isSelectMode,
		selectionEnabled,
		onSelectionChange,
		onSelectModeChange,
		isItemSelectable,
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
		directorySource,
		isCurrent: operations?.isCurrent,
		onDirectoryMoveComplete: operations?.onDirectoryMoveComplete,
		setSelectedItems,
		projectId,
		attachments,
		attachmentIndex: treeIndex,
		onMoveSuccess: () => {
			onUpdateAttachments?.()
		},
		handleMoveFile,
		selectedItems,
		allFiles: mergedFiles,
		getItemId,
		useDetailedDuplicateConflict: !capabilities.crossProject,
	})
	const copyFileHook = useCopyFileSelector({
		directorySource,
		projectId,
		attachments,
		onCopySuccess: () => onUpdateAttachments?.(),
	})

	// 解构移动进度状态
	const { isMoving, moveProgress } = moveFileHook

	const handleCrossProjectOperationSuccess = useCrossProjectMoveCompensation({
		attachments,
		onAttachmentsChange,
		onUpdateAttachments,
	})

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
		allowMove: allowEdit && capabilities.move,
		onMoveFiles: async (fileIds: string[], targetFolderId: string | null) => {
			if (fileIds.length === 0) return
			if (directorySource) {
				const movableIds = fileIds.filter((id) => {
					const item = treeIndex.getItemById(id)
					return item && isItemSelectable(item)
				})
				await moveFileHook.moveWithinDirectorySource(
					directorySource.getPath(targetFolderId ?? operationRoot?.file_id ?? ""),
					movableIds,
				)
				return
			}

			await moveFileHook.batchMoveFilesWithDuplicateCheck({
				fileIds,
				projectId: selectedProject?.id || projectId || "",
				targetParentId: targetFolderId || operationRoot?.file_id || "",
			})
		},
		debug: process.env.NODE_ENV === "development",
		isMoving: moveFileHook.isMoving, // 传递移动状态
		// 外部文件上传支持
		allowExternalDrop: allowEdit && capabilities.upload,
		onUploadFiles: handleUploadFiles,
	})

	// 检查是否可以移动到根目录的函数
	const canMoveToRoot = useMemoizedFn(() => {
		// 如果没有在拖拽，或者没有拖拽项，则不允许
		if (!dragState.isDragging || !dragState.draggingItems?.length) {
			return false
		}

		// 检查所有被拖拽的文件是否已经在根目录
		for (const item of dragState.draggingItems) {
			const isInOperationRoot = operationRoot
				? String(item.parent_id || "") === String(operationRoot.file_id || "")
				: isInRootDirectory(item)
			if (isInOperationRoot) {
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
		handleFileListAreaDragEnter,
		handleFileListAreaDragOver,
		handleFileListAreaDragLeave,
		handleFileListAreaDragEnd,
		handleFileListAreaDrop,
	} = useFileListAreaDrag({
		allowEdit: allowEdit && (capabilities.move || capabilities.upload),
		// 传递新的拖拽移动处理器
		handleFileDragEnter: handleDragEnter,
		handleFileDragLeave: handleDragLeave,
		handleFileDragOver: handleDragOver,
		handleFileDrop,
		// 传递检查函数
		canMoveToRoot,
		// 外部文件上传支持
		allowExternalDrop: allowEdit && capabilities.upload,
		onUploadFiles: handleUploadFiles,
	})

	// 为TreeNode提供的拖拽目标检查函数
	const isDropTargetNode = useMemoizedFn((node: TreeNodeData) => {
		const item = node.item
		if (!item) return false
		return isDropTarget(item)
	})
	const treeNodeDragHandlers = useStableTreeNodeDragHandlers({
		onDragEnter: handleTreeNodeDragEnter,
		onDragLeave: handleTreeNodeDragLeave,
		onDragOver: handleTreeNodeDragOver,
		onDrop: handleTreeNodeDrop,
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
		selectedWorkspace: spaceConfig?.chatContext?.selectedWorkspace ?? selectedWorkspace,
		selectedProject: spaceConfig?.chatContext?.selectedProject ?? selectedProject,
		createAttachmentMention: spaceConfig?.chatContext?.createAttachmentMention,
		fileSpaceType: spaceConfig?.chatContext?.fileSpaceType,
	})

	// 确认移动：交由 hook 内部批量处理
	const handleBatchMoveConfirm = useMemoizedFn(
		async ({ path, targetProjectId, targetAttachments, sourceAttachments }) => {
			if (targetProjectId && targetAttachments && sourceAttachments) {
				await crossProjectOperation.executeMoveOperation({
					fileIds: moveFileHook.selectorConfig.pendingMoveFileIds,
					targetProjectId,
					targetPath: path,
					targetAttachments,
					sourceAttachments,
				})
				return
			}

			const targetPath = path.length === 0 && operationRoot ? [operationRoot] : path
			await moveFileHook.confirmMove({ path: targetPath })
		},
	)

	const handleCopyConfirm = useMemoizedFn(async ({ path }: { path: AttachmentItem[] }) => {
		if (!projectId && !directorySource) return
		await crossProjectOperation.executeCopyOperation({
			fileIds: copyFileHook.pendingCopyFileIds,
			targetProjectId: projectId ?? "",
			targetPath: path.length || !directorySource ? path : [directorySource.root],
			targetAttachments: attachments,
			sourceAttachments: attachments,
		})
		copyFileHook.notifyCopySuccess()
	})

	// 跨项目文件操作 Hook
	const crossProjectOperation = useCrossProjectFileOperation({
		isCurrent: operations?.isCurrent,
		fileScope: spaceConfig?.scope,
		projectId,
		shareCode,
		sharePassword,
		selectedWorkspace: selectedWorkspace || null,
		selectedProject: selectedProject || null,
		projects,
		onSuccess: (result) => {
			handleCrossProjectOperationSuccess(result)
			if (result) onCrossProjectOperationSuccess?.(result)
		},
	})

	// 导入操作 Hook
	const importOperation = useImportFromOtherProject({
		projectId,
		selectedWorkspace: selectedWorkspace || null,
		selectedProject: selectedProject || null,
		workspaces: workspaces || [],
		attachments,
		onSuccess: () => {
			onUpdateAttachments?.()
		},
	})

	const duplicateFileModalProps = getDuplicateFileModalProps({
		externalDuplicateHandler: operations ? undefined : externalDuplicateHandler,
		sharedDuplicateHandler: operations
			? {
					...directoryUpload.duplicateFileHandler,
					handleCancel: directoryUpload.cancelDirectUpload,
				}
			: sharedDuplicateHandler,
		moveDuplicateHandler: moveFileHook,
		crossProjectDuplicateHandler: crossProjectOperation,
		importDuplicateHandler: importOperation,
	})
	const noopFolderConflictHandler = () => undefined
	const folderConflictModalProps =
		!externalDuplicateHandler && sharedDuplicateHandler.folderConflictModalVisible
			? {
					visible: true,
					folderName: sharedDuplicateHandler.currentFolderName,
					totalConflicts: sharedDuplicateHandler.totalFolderConflicts,
					canMerge: sharedDuplicateHandler.canMergeFolderConflict,
					onCancel: sharedDuplicateHandler.handleFolderConflictCancel,
					onMerge: sharedDuplicateHandler.handleFolderConflictMerge,
					onKeepBoth: sharedDuplicateHandler.handleFolderConflictKeepBoth,
					onReplace: sharedDuplicateHandler.handleFolderConflictReplace,
				}
			: moveFileHook.folderConflictModalVisible
				? {
						visible: true,
						folderName: moveFileHook.currentFolderConflictName,
						totalConflicts: moveFileHook.totalFolderConflicts,
						canMerge: moveFileHook.canMergeFolderConflict,
						onCancel: moveFileHook.handleFolderConflictCancel,
						onMerge: moveFileHook.handleFolderConflictMerge,
						onKeepBoth: moveFileHook.handleFolderConflictKeepBoth,
					}
				: crossProjectOperation.folderConflictModalVisible
					? {
							visible: true,
							folderName: crossProjectOperation.currentFolderConflictName,
							totalConflicts: crossProjectOperation.totalFolderConflicts,
							canMerge: crossProjectOperation.canMergeFolderConflict,
							onCancel: crossProjectOperation.handleFolderConflictCancel,
							onMerge: crossProjectOperation.handleFolderConflictMerge,
							onKeepBoth: crossProjectOperation.handleFolderConflictKeepBoth,
						}
					: importOperation.folderConflictModalVisible
						? {
								visible: true,
								folderName: importOperation.currentFolderConflictName,
								totalConflicts: importOperation.totalFolderConflicts,
								canMerge: importOperation.canMergeFolderConflict,
								onCancel: importOperation.handleFolderConflictCancel,
								onMerge: importOperation.handleFolderConflictMerge,
								onKeepBoth: importOperation.handleFolderConflictKeepBoth,
							}
						: {
								visible: false,
								folderName: "",
								totalConflicts: 0,
								canMerge: false,
								onCancel: noopFolderConflictHandler,
								onMerge: noopFolderConflictHandler,
								onKeepBoth: noopFolderConflictHandler,
							}

	// Route desktop project moves to the cross-project selector.
	const handleMoveFileAdapter = useMemoizedFn((item: AttachmentItem) => {
		if (!isItemSelectable(item)) return
		if (canUseDesktopCrossProjectMove) {
			if (item.file_id) {
				const parentPath = getParentPathByFileId(item.file_id)
				crossProjectOperation.openMoveModal([item.file_id], parentPath)
			}
		} else {
			// Mobile and chat projects keep the directory selector.
			moveFileHook.showMoveSelector(item)
		}
	})

	// 创建复制文件处理函数的适配器
	const handleCopyFileAdapter = useMemoizedFn((fileIds: string[]) => {
		if (!capabilities.crossProject) {
			const parentPath = fileIds[0] ? getParentPathByFileId(fileIds[0]) : []
			copyFileHook.openBatchCopyByFileIds(fileIds, parentPath)
			return
		}
		// 获取第一个文件的父目录路径作为默认路径
		const firstFileId = fileIds[0]
		if (firstFileId) {
			const parentPath = getParentPathByFileId(firstFileId)
			crossProjectOperation.openCopyModal(fileIds, parentPath)
		} else {
			crossProjectOperation.openCopyModal(fileIds)
		}
	})

	// 从其他项目导入文件处理函数
	const handleImportFromOtherProject = useMemoizedFn((item?: AttachmentItem) => {
		if (item && item.is_directory && item.file_id) {
			// 如果是文件夹，导入到该文件夹
			const parentPath = getParentPathByFileId(item.file_id)
			const targetPath = [...parentPath, item]
			importOperation.openImportModal(targetPath)
		} else {
			// 如果是空白区域，导入到根目录
			importOperation.openImportModal([])
		}
	})

	// 文件快捷键 hook（需要在 useContextMenu 之前调用）
	const { getShortcutHint } = useFileShortcuts({
		enabled: capabilities.addToChat,
		containerRef: shortcutContainerRef,
		activeFileId,
		useProjectCache: !directorySource,
		hoveredItemRef,
		contextMenuItemId,
		treeIndex,
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

	const getParentPathByFileId = useMemoizedFn((fileId: string): AttachmentItem[] => {
		return treeIndex.getParentItemsById(fileId)
	})

	const {
		batchLoading,
		showBatchDownload,
		batchMenuItems,
		deleteConfirmNode: batchDeleteConfirmNode,
		deleteWithConfirm,
	} = useBatchDownload({
		onDownloadSelected: directorySource ? downloadSelectedFiles : undefined,
		fileScope: spaceConfig?.scope,
		isCurrent: operations?.isCurrent,
		resolveDeleteItems: operations?.resolveDeleteItems,
		beforeDelete: operations?.beforeDelete,
		onFilesDeleted: operations?.onFilesDeleted,
		projectId,
		getItemId,
		selectedItems,
		setSelectedItems,
		filteredFiles: mergedFiles,
		onSelectModeChange,
		// 批量移动和复制所需的依赖
		attachments,
		getParentPathByFileId,
		selectedWorkspace,
		selectedProject,
		crossProjectOperation,
		moveFileHook,
		onUpdateAttachments,
		removeFile,
		isMoving,
		allowEdit,
		allowDownload,
		allowCopyTo,
		allowMove: capabilities.move,
		allowCopy: capabilities.copy && (capabilities.crossProject || allowCopyTo),
		allowShare: capabilities.share,
		downloadProgress,
		// 批量分享回调
		onBatchShareClick: capabilities.share
			? async (fileIds: string[]) => {
					if (fileIds.length === 0) return

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
			: undefined,
		isInProject,
	})

	const { getMenuItems, getBatchDownloadLayerMenuItems, deleteConfirmNode } = useContextMenu({
		handleUploadFile: capabilities.upload ? handleUploadFile : undefined,
		handleUploadFolder:
			capabilities.upload && !directorySource ? handleUploadFolder : undefined,
		handleImportFromOtherProject: capabilities.importFromOtherProject
			? handleImportFromOtherProject
			: undefined,
		handleShareItem: capabilities.share ? handleShareItemFromHook : undefined,
		handleDeleteItem,
		handleDeleteWithConfirm: operations ? (item) => void deleteWithConfirm([item]) : undefined,
		handleDownloadOriginal,
		handleDownloadPdf,
		handleDownloadPptx,
		handleDownloadImage,
		handleOpenFile,
		handleStartRename: (item) => {
			if (isItemSelectable(item)) handleStartRename(item)
		},
		handleShowInfo,
		handleAddToCurrentChat: capabilities.addToChat ? handleAddToCurrentChat : undefined,
		handleAddToNewChat: capabilities.addToChat ? handleAddToNewChat : undefined,
		handleMoveFile: capabilities.move ? handleMoveFileAdapter : undefined,
		handleReplaceFile: capabilities.replace ? handleReplaceFile : undefined,
		onCopyFile: capabilities.copy ? handleCopyFileAdapter : undefined,
		createVirtualFile,
		createVirtualFolder,
		createVirtualDesignProject: capabilities.projectContentCreation
			? createVirtualDesignProject
			: undefined,
		createVirtualSelfMediaProject: capabilities.projectContentCreation
			? createVirtualSelfMediaProject
			: undefined,
		createVirtualAICardProject: capabilities.projectContentCreation
			? (_key?: string, parentPath?: string) => {
					openAICardDialog(parentPath)
				}
			: undefined,
		isMoving: directorySource
			? isMoving || renamePending || isCreatingFile || isCreatingFolder || batchLoading
			: isMoving,
		selectedItems,
		handleAddMultipleFilesToCurrentChat: capabilities.addToChat
			? handleAddMultipleFilesToCurrentChat
			: undefined,
		handleAddMultipleFilesToNewChat: capabilities.addToChat
			? handleAddMultipleFilesToNewChat
			: undefined,
		handleDownloadNoWaterMark,
		preloadWaterMarkFreeModal,
		isFreeTrialVersion,
		shouldUseSingleDownloadEntry: directorySource ? true : shouldUseSingleDownloadEntry,
		getShortcutHint,
		handleEnterMultiSelectMode: capabilities.multiSelect
			? handleEnterMultiSelectMode
			: undefined,
		isSelectMode,
		filterMenuItems,
		filterBatchDownloadLayerMenuItems,
		treeIndex,
		isFolderContentsExpanded: externalSearchValue ? undefined : isFolderContentsExpanded,
		handleToggleFolderContents: externalSearchValue ? undefined : handleToggleFolderContents,
		attachments,
		handleSaveSlidesTemplate: onSaveSlidesTemplate,
		handleConvertToSlidesTemplate: onConvertToSlidesTemplate,
	})

	// 重置所有状态的方法
	const resetAllStates = () => {
		resetSelection()
		resetFilter()
		resetUI()
		resetRename()
		resetVirtualFile()
		resetVirtualFolder()
		resetVirtualDesignProject()
		resetVirtualSelfMediaProject()
		resetVirtualAICardProject()
	}

	// 使用 useImperativeHandle 暴露内部方法
	useImperativeHandle(ref, () => ({
		selectAll: handleSelectAll,
		deselectAll: handleDeselectAll,
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
		createSelfMediaProject: (parentPath?: string) => {
			createVirtualSelfMediaProject(undefined, parentPath)
		},
		createAICardProject: (parentPath?: string) => {
			openAICardDialog(parentPath)
		},
		handleUploadFile,
		handleUploadFolder,
		handleImportFromOtherProject,
		openBatchMoveByFileIds: (fileIds: string[]) => {
			moveFileHook.openBatchMoveByFileIds(fileIds)
		},
		toggleAllFolders,
		resetAllStates,
	}))

	// 选择处理
	const handleSelect = useMemoizedFn((selectedKeys: React.Key[]) => {
		handleTreeSelect(selectedKeys)
		// In browse mode, tree clicks only update the tree state and must not
		// add files or folders to the batch selection.
		if (isSelectMode && selectedKeys.length > 0) {
			const item = treeIndex.getItemByKey(selectedKeys[0] as string)
			if (item) {
				handleItemSelect(item)
			}
		}
	})

	const activeFile = activeFileId ? treeIndex.getItemById(activeFileId) : undefined
	const { activeTreeSelectionKey, effectiveSelectedKeys } = useActiveTreeSelection({
		activeFileId,
		treeIndex,
		expandedKeySet,
		selectedKeys,
	})
	const isActiveFileIndexHtml =
		activeFile?.file_name === "index.html" ||
		activeFile?.filename === "index.html" ||
		activeFile?.display_filename === "index.html"

	const { getRowRenderVersion, rowRenderContextVersion } = useTopicFileRowRenderVersion({
		expandedKeySet,
		selection: {
			enabled: selectionEnabled,
			isSelectMode,
			selectedItemsSize: selectedItems.size,
			getFolderSelectionState,
			isItemSelected,
		},
		active: {
			activeFileId,
			isActiveFileIndexHtml,
			locatingFileId,
			contextMenuItemId,
		},
		rename: {
			renamingItemId,
			renameValue,
			renameErrorMessage,
			isFileRenaming,
		},
		virtualEdit: {
			editingVirtualFileId,
			virtualFileName,
			fileErrorMessage,
			editingVirtualFolderId,
			virtualFolderName,
			folderErrorMessage,
			editingVirtualDesignProjectId,
			virtualDesignProjectName,
			designProjectErrorMessage,
		},
		busy: {
			movingFiles,
			exportingFiles,
			downloadingFoldersSize: downloadingFolders.size,
			isFolderDownloading,
		},
		drag: {
			isDragging: dragState.isDragging,
			isExternalDrag: dragState.isExternalDrag,
			draggingItemsCount: dragState.draggingItems?.length || 0,
		},
	})

	const getFileRowRenderVersion = useMemoizedFn(
		(row: Parameters<typeof getRowRenderVersion>[0]) =>
			`${getRowRenderVersion(row)}:${skillFiles.kinds.get(String(row.node.key)) ?? ""}:${skillFiles.paths.get(String(row.node.key)) ?? ""}:${fileHelpVersion}`,
	)

	// 在树形数据中查找文件的辅助函数
	const findFileInTree = useMemoizedFn((fileId: string): AttachmentItem | undefined => {
		return treeIndex.getItemById(fileId)
	})

	const selfMediaNavigation = useSelfMediaTreeNavigation({
		attachments,
		findFileInTree,
		onFileClick,
		setUserSelectDetail,
	})
	const { tryOpenSelfMediaFromPostRootFolder } = selfMediaNavigation

	const { tryOpenAICardFromSubFolder } = useAICardTreeNavigation({
		attachments,
		findFileInTree,
		onFileClick,
		setUserSelectDetail,
	})

	const openSlidesTemplate = useMemoizedFn((item: AttachmentItem) => {
		const previewItem = toSlidesTemplatePreviewItem(item)
		onFileClick?.(previewItem)
		setUserSelectDetail?.({
			type: DetailType.SlidesTemplate,
			data: {
				...previewItem,
				file_id: item.file_id,
				file_name: item.file_name || item.name || item.display_filename,
			},
			currentFileId: item.file_id,
			attachments,
		})
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
		const { display_config } = item
		const isActiveFile = activeTreeSelectionKey === String(itemId)
		const hasChildren = !node.isLeaf
		const isExpanded = expandedKeySet.has(String(node.key))

		const showCheckbox = selectionEnabled && isItemSelectable(item)
		const isSelected = showCheckbox ? isItemSelected(itemId) : false

		// 检查是否正在定位此文件
		const isLocating = locatingFileId === item.file_id

		const indentWidth = node.level * 10
		const decoration =
			resolveTopicFileRowDecoration?.({
				item,
				node,
				isVirtual: !!node.isVirtual,
			}) || undefined
		const skillKind = node.isVirtual ? undefined : skillFiles.kinds.get(String(node.key))
		const filePath = skillFiles.paths.get(String(node.key))
		const presentation = resolveFilePresentation(item, {
			context: resolvedFileHelpContext,
			index: getFilePresentationIndex(attachments),
			skillKind,
			path: filePath,
		})
		const systemKind = presentation.systemKind
		const tag = node.isVirtual
			? undefined
			: (decoration?.tag ??
				((skillKind && skillKind !== "support") ||
				systemKind ||
				presentation.userKind ||
				presentation.clawKind ||
				presentation.projectKind ? (
					<ProjectFileTag
						presentation={presentation}
						item={item}
						skillKind={skillKind}
						path={filePath}
						context={resolvedFileHelpContext}
					/>
				) : undefined))
		const renderDecorationTag = () => {
			if (!tag) return null
			return (
				<div data-file-tag className={styles.rowTagSlot}>
					{tag}
				</div>
			)
		}

		// 渲染展开/折叠图标
		const renderExpandIcon = () => {
			if (item.directoryLoadState === "loading")
				return <Loader2 size={16} className="animate-spin" />
			if (!hasChildren) {
				return (
					<div
						style={{ width: 16, height: 16 }}
						data-testid="file-expand-icon-placeholder"
					/>
				) // 占位符，保持对齐
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
					data-testid="file-expand-icon"
					onClick={(e: any) => {
						e.stopPropagation()
						if (item.directoryLoadState === "error" && directorySource) {
							void directorySource
								.loadDirectory(String(item.file_id))
								.catch(() => undefined)
							setExpandedKeys((previous) =>
								Array.from(new Set([...previous, node.key])),
							)
							return
						}
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
			const isVirtualSelfMediaProject = editingVirtualSelfMediaProjectId === itemId
			const isVirtualAICardProject = editingVirtualAICardProjectId === itemId
			const isVirtualNormalFolder =
				isVirtualFolder &&
				!isVirtualDesignProject &&
				!isVirtualSelfMediaProject &&
				!isVirtualAICardProject
			const virtualErrorMessage = isVirtualDesignProject
				? designProjectErrorMessage
				: isVirtualSelfMediaProject
					? selfMediaProjectErrorMessage
					: isVirtualAICardProject
						? aiCardProjectErrorMessage
						: isVirtualNormalFolder
							? folderErrorMessage
							: fileErrorMessage
			const showVirtualError = !!virtualErrorMessage

			return (
				<div
					className={cx(
						styles.fileItem,
						Boolean(tag) && styles.fileItemWithTag,
						decoration?.className,
						contextMenuItemId === itemId && styles.contextMenuActiveItem,
					)}
					data-testid="file-item-virtual"
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
						className={cx(
							styles.fileTitle,
							Boolean(tag) && styles.fileTitleWithTag,
							showVirtualError && styles.fileTitleTopAligned,
						)}
						style={{
							paddingLeft: indentWidth + "px",
							alignItems:
								designProjectErrorMessage || folderErrorMessage || fileErrorMessage
									? "flex-start"
									: undefined,
						}}
					>
						{/* 展开/折叠图标 */}
						<div className={styles.iconWrapper}>{renderExpandIcon()}</div>

						<div className={styles.iconWrapper} data-testid="file-virtual-row-icon">
							{decoration?.icon ? (
								decoration.icon
							) : isVirtualDesignProject ? (
								<MagicFileIcon type="design" size={16} />
							) : isVirtualSelfMediaProject ? (
								<MagicFileIcon type="self-media" size={16} />
							) : isVirtualAICardProject ? (
								<MagicFileIcon type="ai-card" size={16} />
							) : isVirtualNormalFolder ? (
								<img
									src={FoldIcon as unknown as string}
									alt="folder"
									width={16}
									height={16}
									data-testid="file-virtual-folder-icon-image"
								/>
							) : (
								<MagicFileIcon type={item?.file_extension} size={16} />
							)}
						</div>

						{/* 虚拟项目名输入框 */}
						<div className={styles.rowTitleText}>
							<InputWithError
								disabled={Boolean(
									directorySource && (isCreatingFile || isCreatingFolder),
								)}
								ref={
									isVirtualDesignProject
										? virtualDesignProjectInputRef
										: isVirtualSelfMediaProject
											? virtualSelfMediaProjectInputRef
											: isVirtualAICardProject
												? virtualAICardProjectInputRef
												: isVirtualNormalFolder
													? virtualFolderInputRef
													: virtualFileInputRef
								}
								data-testid={
									isVirtualDesignProject
										? "design-project-name-input-virtual"
										: isVirtualSelfMediaProject
											? "self-media-project-name-input-virtual"
											: isVirtualAICardProject
												? "ai-card-project-name-input-virtual"
												: isVirtualNormalFolder
													? "folder-name-input-virtual"
													: "file-name-input-virtual"
								}
								value={
									isVirtualDesignProject
										? virtualDesignProjectName
										: isVirtualSelfMediaProject
											? virtualSelfMediaProjectName
											: isVirtualAICardProject
												? virtualAICardProjectName
												: isVirtualNormalFolder
													? virtualFolderName
													: virtualFileName
								}
								onChange={(e: any) => {
									if (isVirtualDesignProject) {
										setVirtualDesignProjectName(e.target.value)
									} else if (isVirtualSelfMediaProject) {
										setVirtualSelfMediaProjectName(e.target.value)
									} else if (isVirtualAICardProject) {
										setVirtualAICardProjectName(e.target.value)
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
										: isVirtualSelfMediaProject
											? confirmVirtualSelfMediaProject
											: isVirtualAICardProject
												? confirmVirtualAICardProject
												: isVirtualNormalFolder
													? confirmVirtualFolder
													: confirmVirtualFile
								}
								onKeyDown={
									isVirtualDesignProject
										? handleVirtualDesignProjectKeyDown
										: isVirtualSelfMediaProject
											? handleVirtualSelfMediaProjectKeyDown
											: isVirtualAICardProject
												? handleVirtualAICardProjectKeyDown
												: isVirtualNormalFolder
													? handleVirtualFolderKeyDown
													: handleVirtualFileKeyDown
								}
								onClick={(e: any) => e.stopPropagation()}
								errorMessage={virtualErrorMessage}
								showError={showVirtualError}
							/>
						</div>
						{renderDecorationTag()}

						{showCheckbox && (
							<div className={styles.iconWrapper}>
								<Checkbox
									data-testid="file-virtual-row-checkbox"
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
			const folderSelectionState = showCheckbox ? getFolderSelectionState(item) : "none"
			const isFolderSelected = folderSelectionState === "all"
			const isFolderIndeterminate = folderSelectionState === "partial"

			// 检查是否应该高亮文件夹：
			// 1. 如果打开的文件是 index.html，并且该文件夹有 display_config，且该文件在文件夹的子项中
			// 2. 或者文件夹本身是 activeFileId
			const appEntryResolvedForHighlight =
				display_config?.type === "custom"
					? getAppEntryFile(item?.children || [], display_config)
					: null
			const isActiveCustomEntry =
				display_config?.type === "custom" &&
				activeFileId &&
				appEntryResolvedForHighlight?.file_id === activeFileId
			const shouldHighlightFolder =
				// 情况1：子文件是 index.html（非 custom 入口）
				(isActiveFileIndexHtml &&
					!!display_config?.type &&
					display_config?.type !== "custom" &&
					activeFileId &&
					isFileInFolder(item, activeFileId)) ||
				// 情况1b：custom 类型，当前打开的是 index 解析出的入口文件
				isActiveCustomEntry ||
				// 情况2：文件夹本身是 activeFileId
				(activeFileId === item?.file_id && !!display_config?.type)
			const isFolderBusy =
				isFileRenaming(item) ||
				movingFiles.has(item?.file_id || "") ||
				isFolderDownloading(item)

			const { folderIconPlatform: selfMediaRowPlatform } = attachments?.length
				? { folderIconPlatform: selfMediaNavigation.resolveNodeFolderIconPlatform(item) }
				: { folderIconPlatform: null }

			// 使用 createFileDragHandlers 获取拖拽事件处理器
			const folderDragHandlers = createFileDragHandlers({
				item,
				node,
				allowEdit: allowEdit && capabilities.move && isItemSelectable(item),
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
						Boolean(tag) && styles.fileItemWithTag,
						decoration?.className,
						(shouldHighlightFolder || isActiveFile) && styles.activeFileItemWrapper,
						isActiveFile && "bg-blue-500/10",
						contextMenuItemId === itemId && styles.contextMenuActiveItem,
					)}
					data-testid="folder-item"
					onClick={(e) => {
						e.stopPropagation()
						if (isSelectMode) {
							handleItemSelect(item)
							return
						}

						if (tryOpenSelfMediaFromPostRootFolder(item)) return
						if (tryOpenAICardFromSubFolder(item)) return
						if (isSlidesTemplateFolder(item)) {
							openSlidesTemplate(item)
							return
						}

						if (isEmpty(item.display_config)) {
							// 普通文件夹，没有 display_config，直接展开/折叠
							const newExpandedKeys = isExpanded
								? expandedKeys.filter((key) => key !== node.key)
								: [...expandedKeys, node.key]
							setExpandedKeys(newExpandedKeys)
						} else {
							// 有 display_config 的文件或文件夹，需要判断是内容类型渲染还是文件预览
							// 1. 先检查是否是内容类型渲染（不依赖文件内容，有自己的 detail render content）
							// 需要将 AttachmentItem 转换为 FileItem 格式
							const fileItem: FileItem = {
								file_id: item.file_id || "",
								file_name: item.name || item.file_name || "",
								display_filename: item.name || item.file_name,
								is_directory: item.is_directory,
								children: item.children as FileItem[] | undefined,
								relative_file_path: item.relative_file_path,
								parent_id: item.parent_id,
								display_config: item.display_config,
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
										display_config: item.display_config,
									},
									currentFileId: item.file_id,
									attachments,
								})
							} else {
								// 文件预览模式（默认）：custom 用 index，其它默认 index.html
								const appEntryFile = getAppEntryFile(
									item?.children || [],
									item.display_config,
								)
								if (appEntryFile) {
									handleOpenFile(appEntryFile)
								} else if (item.display_config?.type === "custom") {
									message.error(t("topicFiles.customMainFileNotFound"))
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
					draggable={
						renamingItemId !== itemId && capabilities.move && isItemSelectable(item)
					}
					{...folderDragHandlers}
					onMouseEnter={() => setHoveredItem(itemId)}
					onMouseLeave={() => setHoveredItem(null)}
					onContextMenu={(e) => delegateProps.onDropdownContextMenuClick?.(e, item)}
				>
					<div
						className={cx(
							styles.fileTitle,
							Boolean(tag) && styles.fileTitleWithTag,
							renamingItemId === itemId &&
								!!renameErrorMessage &&
								styles.fileTitleTopAligned,
						)}
						style={{
							paddingLeft: indentWidth + "px",
							alignItems: renameErrorMessage ? "flex-start" : undefined,
						}}
						data-file-label-row
						data-testid="folder-content"
					>
						{/* 展开/折叠图标 */}
						<div
							className={styles.iconWrapper}
							onClick={(e) => {
								if (!isEmpty(display_config)) {
									e.stopPropagation()
									const newExpandedKeys = isExpanded
										? expandedKeys.filter((key) => key !== node.key)
										: [...expandedKeys, node.key]
									setExpandedKeys(newExpandedKeys)
								}
							}}
							data-testid="folder-expand-trigger"
						>
							{renderExpandIcon()}
						</div>

						<div className={styles.iconWrapper} data-testid="folder-icon">
							{isFileRenaming(item) ? (
								<Loader2 className="mr-1 animate-spin" size={16} />
							) : movingFiles.has(item?.file_id || "") ? (
								<Loader2 className="mr-1 animate-spin" size={16} />
							) : isFolderDownloading(item) ? (
								<Loader2 className="mr-1 animate-spin" size={16} />
							) : decoration?.icon && !isFolderBusy ? (
								decoration.icon
							) : selfMediaRowPlatform && !isFolderBusy ? (
								<SelfMediaPostRowPlatformIcon
									platform={selfMediaRowPlatform}
									size={16}
								/>
							) : (
								<FileResourceIcon
									presentation={presentation}
									size={16}
									folderTestId="folder-icon-image"
								/>
							)}
						</div>

						{/* 文件夹名称或重命名输入框 */}
						<div
							data-file-name-container
							data-file-name
							className={styles.rowTitleText}
							data-testid="folder-name"
						>
							{renamingItemId === itemId ? (
								<InputWithError
									ref={renameInputRef}
									disabled={Boolean(directorySource && renamePending)}
									value={renameValue}
									data-testid="file-name-input-rename"
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
									fileName
									placement="bottom"
									align="start"
									className={cx(
										styles.ellipsis,
										(shouldHighlightFolder || isActiveFile) &&
											styles.activeFileItem,
									)}
									sideOffset={4}
									disabled={
										contextMenuItemId === itemId ||
										dragState.isDragging ||
										dragState.isExternalDrag
									}
								>
									{decoration?.name ?? item?.name}
								</SmartTooltip>
							)}
						</div>
						{renderDecorationTag()}
					</div>

					{/* 更多按钮 */}
					{!showCheckbox &&
						renamingItemId !== itemId &&
						allowEdit &&
						!(filterMenuItems && allowDownload === false) && (
							<MagicIcon
								className={cx(
									styles.attachmentAction,
									"file-item-action",
									(contextMenuItemId === itemId || shouldShowInlineFileAction) &&
										"file-item-action-visible",
								)}
								data-testid="file-more-actions-button"
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
								data-testid="folder-checkbox"
								checked={isFolderIndeterminate ? "indeterminate" : isFolderSelected}
								disabled={isItemDisabled(item)}
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
			allowEdit: allowEdit && capabilities.move && isItemSelectable(item),
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
		const isFileBusy =
			exportingFiles.has(item?.file_id || "") ||
			isFileRenaming(item) ||
			movingFiles.has(item?.file_id || "")
		const imagePreviewSource = resolveProjectFileImagePreviewSource(item)

		return (
			<div
				className={cx(
					styles.fileItem,
					Boolean(tag) && styles.fileItemWithTag,
					decoration?.className,
					isLocating && styles.locatingFileItem,
					isActiveFile && "bg-blue-500/10",
					contextMenuItemId === itemId && styles.contextMenuActiveItem,
				)}
				data-file-id={item.file_id}
				data-testid="file-item"
				onClick={(e) => {
					e.stopPropagation()
					if (isSelectMode) {
						handleItemSelect(item)
						return
					}

					if (tryOpenSelfMediaFromPostRootFolder(item)) return
					if (tryOpenAICardFromSubFolder(item)) return

					if (renamingItemId !== itemId) {
						// 检查是否是内容类型渲染（不依赖文件内容，有自己的 detail render content）
						if (item.display_config?.type) {
							const fileItem: FileItem = {
								file_id: item.file_id || "",
								file_name: item.file_name || item.name || "",
								display_filename: item.file_name || item.name,
								is_directory: item.is_directory,
								children: item.children as FileItem[] | undefined,
								relative_file_path: item.relative_file_path,
								parent_id: item.parent_id,
								display_config: item.display_config,
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
										display_config: item.display_config,
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
				draggable={renamingItemId !== itemId && capabilities.move && isItemSelectable(item)}
				{...fileDragHandlers}
				onMouseEnter={() => {
					setHoveredItem(itemId)
				}}
				onMouseLeave={() => {
					setHoveredItem(null)
				}}
				onContextMenu={(e) => delegateProps.onDropdownContextMenuClick?.(e, item)}
			>
				<div
					className={cx(
						styles.fileTitle,
						Boolean(tag) && styles.fileTitleWithTag,
						renamingItemId === itemId &&
							!!renameErrorMessage &&
							styles.fileTitleTopAligned,
					)}
					style={{
						paddingLeft: indentWidth + "px",
						alignItems: renameErrorMessage ? "flex-start" : undefined,
					}}
					data-file-label-row
					data-testid="file-content"
				>
					{/* 展开/折叠图标 */}
					<div className={styles.iconWrapper}>{renderExpandIcon()}</div>

					<div className={styles.iconWrapper} data-testid="file-icon">
						{exportingFiles.has(item?.file_id || "") ? (
							<Loader2 className="mr-1 flex-shrink-0 animate-spin" size={16} />
						) : isFileRenaming(item) ? (
							<Loader2 className="mr-1 flex-shrink-0 animate-spin" size={16} />
						) : movingFiles.has(item?.file_id || "") ? (
							<Loader2 className="mr-1 flex-shrink-0 animate-spin" size={16} />
						) : null}
						{decoration?.icon && !isFileBusy ? (
							decoration.icon
						) : (
							<ProjectFileImageThumbnailIcon
								item={item}
								size={16}
								fallback={
									<FileResourceIcon presentation={presentation} size={16} />
								}
							/>
						)}
					</div>

					{/* 文件名称或重命名输入框 */}
					<div
						data-file-name-container
						data-file-name
						className={styles.rowTitleText}
						data-testid="file-name"
					>
						{renamingItemId === itemId ? (
							<InputWithError
								ref={renameInputRef}
								disabled={Boolean(directorySource && renamePending)}
								value={renameValue}
								data-testid="file-name-input-rename"
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
							<>
								{imagePreviewSource ? (
									<ProjectFileImageSmartTooltip
										source={imagePreviewSource}
										allowDownload={allowDownload}
										className={cx(
											"min-w-0 flex-1",
											styles.ellipsis,
											isActiveFile && "font-medium",
										)}
										sideOffset={20}
									>
										{decoration?.name ?? item?.file_name}
									</ProjectFileImageSmartTooltip>
								) : (
									<SmartTooltip
										fileName
										placement="bottom"
										align="start"
										className={cx(
											styles.ellipsis,
											isActiveFile && "font-medium",
										)}
										sideOffset={4}
										disabled={
											contextMenuItemId === itemId ||
											dragState.isDragging ||
											dragState.isExternalDrag
										}
									>
										{decoration?.name ?? item?.file_name}
									</SmartTooltip>
								)}
							</>
						)}
					</div>
					{renderDecorationTag()}
				</div>

				{/* 更多按钮 */}
				{!showCheckbox &&
					renamingItemId !== itemId &&
					(allowEdit ||
						(filterMenuItems && (allowDownload !== false || allowCopyTo))) && (
						<MagicIcon
							className={cx(
								styles.attachmentAction,
								"file-item-action",
								(contextMenuItemId === itemId || shouldShowInlineFileAction) &&
									"file-item-action-visible",
							)}
							data-testid="file-more-actions-button"
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
							data-testid="file-checkbox"
							checked={isSelected}
							disabled={isItemDisabled(item)}
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

	const showMobileBatchActions = shouldShowMobileBatchActions({
		isMobile,
		isSelectMode,
		hasSelection: showBatchDownload,
	})
	const handleCancelMobileBatchSelection = useMemoizedFn(() => {
		resetSelection()
		onSelectModeChange?.(false)
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
	const handleFileListScroll = useMemoizedFn(() => {
		markProjectFileListScrollActivity()
	})
	const imagePreviewManager = useProjectFileImagePreviewManager({ attachments })
	const handleMountedTreeRowsChange = useMemoizedFn((rows: Array<{ node: TreeNodeData }>) => {
		imagePreviewManager.setMountedItems(rows.map((row) => row.node.item))
	})

	return (
		<ProjectFileImagePreviewProvider manager={imagePreviewManager}>
			<div
				className={cx(
					className,
					"flex min-h-0 flex-col",
					fitContent ? "flex-none overflow-visible" : "h-[calc(100%-32px)] overflow-auto",
				)}
				ref={shortcutContainerRef}
				data-topic-files-shortcuts
				data-testid="topic-files-core"
			>
				{/* 右键菜单内容 */}
				{(allowEdit || filterMenuItems) && dropdownContent}
				{allowEdit && batchDownloadDropdownContent}
				{fileInfoPanel}
				{deleteConfirmNode}
				{batchDeleteConfirmNode}
				<>
					{/* Content area */}
					{/* <div className={styles.contentArea}> */}
					{/* File tree */}
					<div
						ref={fileListAreaRef}
						className={cx(styles.fileListArea, "px-2 pb-2", {
							[styles.dragTargetFolder]:
								isDragOverFileListArea || dragState.isDragOverRoot, // 添加拖拽悬停样式
						})}
						onScroll={handleFileListScroll}
						onContextMenu={(e) =>
							fileListAreaDelegateProps.onDropdownContextMenuClick?.(e, null)
						}
						onDragEnter={handleFileListAreaDragEnter}
						onDragOver={handleFileListAreaDragOver}
						onDragLeave={handleFileListAreaDragLeave}
						onDragEnd={handleFileListAreaDragEnd}
						onDrop={handleFileListAreaDrop}
						data-testid="topic-files-list-area"
						style={
							fitContent
								? { flex: "none", overflow: "visible", maxHeight: "none" }
								: undefined
						}
					>
						{visibleRows.length > 0 ? (
							<CustomTree
								visibleRows={visibleRows}
								visibleNodes={visibleNodes}
								visibleNodeIndexByKey={visibleNodeIndexByKey}
								// draggable={
								// 	allowEdit
								// 		? {
								// 				icon: false,
								// 		  }
								// 		: false
								// }
								onSelect={handleSelect}
								expandedKeys={expandedKeys}
								selectedKeys={effectiveSelectedKeys}
								titleRender={titleRender}
								getRowRenderVersion={getFileRowRenderVersion}
								rowRenderContextVersion={
									directorySource
										? `${rowRenderContextVersion}:${fileHelpVersion}:${renamePending}:${isCreatingFile}:${isCreatingFolder}`
										: `${rowRenderContextVersion}:${fileHelpVersion}`
								}
								showIcon={false}
								blockNode
								scrollElementRef={scrollElementRef ?? fileListAreaRef}
								sharedScroll={Boolean(scrollElementRef)}
								scrollToKey={directorySource?.locateFileId ?? locatingFileId}
								isMobile={isMobile}
								onMountedRowsChange={handleMountedTreeRowsChange}
								// height={treeHeight}
								dragTargetNodeClass={styles.dragTargetFolder}
								dragTargetKey={dragState.dropTargetFolderId}
								isDragTargetNode={isDropTargetNode}
								{...treeNodeDragHandlers}
							/>
						) : refreshLoading ? (
							<div
								className="flex h-full w-full items-center justify-center"
								data-testid="topic-files-list-loading"
							>
								<div className="flex flex-col items-center gap-3">
									<MagicSpin spinning />
									<p className="text-sm text-muted-foreground">
										{t("topicFiles.loadingFiles")}
									</p>
								</div>
							</div>
						) : showEmptyState || externalSearchValue?.trim() ? (
							<EmptyState
								title={
									directorySource && externalSearchValue?.trim()
										? t("userSpace.searchLoadedEmpty")
										: undefined
								}
								onAddFile={createVirtualFile}
								onAddDesign={
									capabilities.projectContentCreation
										? createVirtualDesignProject
										: undefined
								}
								onUploadFile={() => handleUploadFile()}
								allowEdit={
									allowEdit && !(directorySource && externalSearchValue?.trim())
								}
							/>
						) : null}
					</div>
					{/* </div> */}
					{/* Batch download layer */}
					<div
						className={cx(styles.batchDownloadLayer, {
							[styles.hidden]:
								(!isMobile && !showBatchDownload) ||
								(isMobile && attachments.length <= 0),
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
											data-testid="batch-operations-button"
											disabled={batchLoading}
											style={{ flex: 1, width: "100%" }}
										>
											<Flex align="center" gap={2} justify="center">
												{batchLoading ? (
													<Loader2
														className="mr-1 animate-spin"
														size={16}
													/>
												) : null}
												<span className={styles.batchDownloadButtonPCText}>
													{t("topicFiles.batchOperations")}
												</span>
												<IconChevronDown
													size={16}
													stroke={1.5}
													color="#fff"
												/>
											</Flex>
										</Button>
									</div>
								</MagicDropdown>
							</Flex>
						)}
						{showMobileBatchActions && (
							<Button
								variant="secondary"
								className="h-9 px-8 py-2 text-sm font-medium shadow-xs"
								data-testid="mobile-cancel-select-button"
								onClick={handleCancelMobileBatchSelection}
							>
								{t("topicFiles.cancelSelect")}
							</Button>
						)}
						{showMobileBatchActions && (
							<MagicDropdown
								menu={{ items: batchMenuItems }}
								placement="topLeft"
								trigger={["click"]}
								disabled={!showBatchDownload || batchLoading}
							>
								<Button
									variant="default"
									className="h-9 w-[253px] gap-2 px-4 py-2 text-sm font-medium shadow-xs"
									data-testid="mobile-batch-operations-button"
									disabled={!showBatchDownload || batchLoading}
								>
									{batchLoading ? (
										<Loader2 className="animate-spin" size={16} />
									) : null}
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
				</>
				{/* 文件分享模态框 */}
				{isMobile ? (
					<ProjectShareSheet
						open={
							Boolean(shareFileInfo && shareModalVisible) || Boolean(shareSuccessInfo)
						}
						onClose={() => {
							setShareModalVisible(false)
							setShareFileInfo(null)
							closeSuccessModal()
						}}
						mode="file"
						attachments={attachments}
						attachmentList={attachments}
						projectName={shareFileInfo?.projectName || selectedProject?.project_name}
						projectId={projectId}
						defaultSelectedFileIds={
							shareFileInfo?.fileIds || shareSuccessInfo?.shareInfo?.file_ids
						}
						defaultOpenFileId={shareFileInfo?.defaultOpenFileId}
						initialSelectedShare={shareSuccessInfo?.shareInfo || null}
					/>
				) : (
					<>
						{shareFileInfo && (
							<ShareModal
								open={shareModalVisible}
								onCancel={() => {
									setShareModalVisible(false)
									setShareFileInfo(null)
								}}
								shareMode={ShareMode.File}
								types={[
									ShareType.PasswordProtected,
									ShareType.Public,
									ShareType.Organization,
								]}
								attachments={attachments}
								resourceId={
									shareFileInfo.resourceId ||
									shareSuccessInfo?.shareInfo?.resource_id
								}
								defaultSelectedFileIds={shareFileInfo.fileIds}
								projectName={shareFileInfo.projectName}
								projectId={projectId}
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
								mainFileName={
									shareSuccessInfo.shareInfo.main_file_name || t("share.untitled")
								}
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
								createdAt={shareSuccessInfo.shareInfo.created_at}
								updatedAt={shareSuccessInfo.shareInfo.updated_at}
								viewCount={shareSuccessInfo.shareInfo.view_count}
							/>
						)}
					</>
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
				{/* 移动文件选择器 */}
				<Dialog
					open={moveFileHook.failures.length > 0}
					onOpenChange={(open) => {
						if (!open) moveFileHook.clearFailures()
					}}
				>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>{t("userSpace.partialResult")}</DialogTitle>
							<DialogDescription>
								{t("userSpace.partialDescription", {
									success: moveFileHook.successCount,
									failed: moveFileHook.failures.length,
								})}
							</DialogDescription>
						</DialogHeader>
						<ul className="max-h-64 space-y-2 overflow-auto text-sm">
							{moveFileHook.failures.map(({ file, message }) => (
								<li key={file.file_id}>
									<span className="font-medium">
										{file.file_name ?? file.name}
									</span>
									<span className="ml-2 text-muted-foreground">{message}</span>
								</li>
							))}
						</ul>
						<DialogFooter>
							<Button onClick={moveFileHook.clearFailures}>
								{t("common.confirm")}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
				{
					<SelectDirectoryModal
						{...{
							...moveFileHook.selectorConfig,
							visible: moveFileHook.selectorConfig.visible,
							confirmLoading:
								capabilities.crossProject || directorySource
									? moveFileHook.selectorConfig.confirmLoading
									: false,
							mobileCrossProjectConfig:
								isMobile && selectedProject
									? {
											currentProject: selectedProject,
											currentWorkspace: selectedWorkspace,
											sourceAttachments: attachments,
											isChatProject,
										}
									: undefined,
							onSubmit: directorySource
								? moveFileHook.selectorConfig.onSubmit
								: handleBatchMoveConfirm,
						}}
					/>
				}
				{!capabilities.crossProject && (isInProject || directorySource) ? (
					<SelectDirectoryModal
						{...copyFileHook.selectorConfig}
						onSubmit={handleCopyConfirm}
					/>
				) : null}
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
					sourceAttachmentsLoading={refreshLoading}
					initialPath={crossProjectOperation.initialPath}
					onClose={crossProjectOperation.closeModal}
					onSubmit={
						crossProjectOperation.operationType === "move"
							? crossProjectOperation.executeMoveOperation
							: crossProjectOperation.executeCopyOperation
					}
				/>
				{/* 从其他项目导入 Modal */}
				{workspaces && projectId && (
					<ImportFromOtherProjectModal
						visible={importOperation.visible}
						workspaces={workspaces}
						currentProjectId={projectId}
						currentProject={selectedProject || null}
						targetPath={importOperation.targetPath}
						targetAttachments={attachments}
						onClose={importOperation.closeModal}
						onSubmit={importOperation.executeImportOperation}
					/>
				)}
				{/* Duplicate file modal */}
				<FolderConflictModal {...folderConflictModalProps} />
				<DuplicateFileModal {...duplicateFileModalProps} />
				{/* 移动/复制进度提示 - 使用 Portal 渲染到 body */}
				{createPortal(
					<MagicProgressToast
						visible={
							isMoving ||
							crossProjectOperation.isOperating ||
							importOperation.isOperating
						}
						progress={
							crossProjectOperation.isOperating
								? crossProjectOperation.operationProgress
								: importOperation.isOperating
									? importOperation.operationProgress
									: moveProgress
						}
						text={
							crossProjectOperation.isOperating &&
							crossProjectOperation.operationType === "copy"
								? t("topicFiles.copying")
								: importOperation.isOperating
									? t("topicFiles.copying")
									: t("topicFiles.moving")
						}
						position="top"
						icon={
							(crossProjectOperation.isOperating &&
								crossProjectOperation.operationType === "copy") ||
							importOperation.isOperating ? (
								<Files size={10} />
							) : (
								<ArrowRight size={10} />
							)
						}
						showPercentage={true}
						progressHeight={4}
						zIndex={99999}
					/>,
					document.body,
				)}
				{/* 下载无水印图片协议弹窗 */}
				{agreementModal}
				{/* AI 卡片创建弹窗 */}
				{aiCardDialogElement}
			</div>
		</ProjectFileImagePreviewProvider>
	)
})

export default TopicFilesCore
