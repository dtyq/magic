import { useLocation, useNavigate } from "react-router"
import { reaction } from "mobx"
import projectFilesStore from "@/stores/projectFiles"
import { getFileReferenceIdentityKey } from "../../services/userFileReferenceResolver"
import {
	isUploadedFileNavigationTarget,
	type SuperMagicLocateFileContext,
} from "../../events/files"
import {
	registerWaitForNextAttachmentsRefreshForProject,
	waitForNextFullAttachmentsRefreshForProject,
	requestProjectAttachmentsFullRefresh,
} from "../../services/attachmentsTopicSync"
import type { FileHelpContext } from "./utils/magic-system-folder"
import {
	memo,
	useState,
	useMemo,
	useRef,
	useEffect,
	forwardRef,
	useImperativeHandle,
	type ReactNode,
} from "react"
import { FileManagerFooter } from "./components/FileManager/FileManagerFooter"
import { useTranslation } from "react-i18next"
import TopicFilesCore, {
	type TopicFilesCoreRef,
	type TopicFilesExpansionState,
} from "./TopicFilesCore"
import { useDownloadAll } from "./useDownloadAll"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import useShareRoute from "../../hooks/useShareRoute"
import type { AttachmentItem } from "./hooks/types"
import { UploadModal } from "../MessageEditor/components/UploadModal"
import { useUploadWithModal } from "./hooks/useUploadWithModal"
import { useDuplicateFileHandler } from "./hooks/useDuplicateFileHandler"
import {
	DuplicateFileModal,
	FolderConflictModal,
	SelectModeHeader,
	NormalModeHeader,
	SearchModeHeader,
} from "./components"
import { useFileReplace } from "./hooks/useFileReplace"
import { cn } from "@/utils/cn"
import magicToast from "@/components/base/MagicToaster/utils"
import { type PresetFileType } from "./constant"
import type { TopicFileRowDecorationResolver } from "./topic-file-row-decoration.types"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import { useDebouncedSearchValue } from "./hooks/useDebouncedSearchValue"
import { useIsMobile } from "@/hooks/useIsMobile"
import MobileProjectDetailFilesView from "./components/MobileProjectDetailFilesView"
import { SelectDirectoryModal } from "../SelectPathModal"
import { useBatchDownload } from "./hooks/useBatchDownload"
import { useProjectDetailFilesController } from "./hooks/useProjectDetailFilesController"
import {
	useCrossProjectFileOperation,
	type CrossProjectOperationSuccessResult,
} from "./hooks/useCrossProjectFileOperation"
import { useCrossProjectMoveCompensation } from "./hooks/useCrossProjectMoveCompensation"
import { useMobileProjectFilesDownload } from "./hooks/useMobileProjectFilesDownload"
import { getMobileAttachmentKey } from "./utils/get-mobile-attachment-key"
import ProjectShareSheet from "@/pages/superMagicMobile/components/ProjectShareSheet"
import { isCachedChatWorkspaceProject } from "@/pages/superMagic/utils/isChatWorkspaceProject"
import { resolveTopicFilesCapabilities, type TopicFilesSpaceConfig } from "./file-space"
import { SidebarExpandableItem, type SidebarSectionOptions } from "../SidebarSection"
import type { ProjectFilesStore } from "@/stores/projectFiles"

interface TopicFilesPanelProps {
	/** 所属定义工作区；用户挂载文件仍以自己的空间身份为准。 */
	fileHelpContext?: FileHelpContext
	loading?: boolean
	className?: string
	fitContent?: boolean
	scrollElementRef?: React.RefObject<HTMLElement>
	title?: string
	/** 是否显示文件树内部标题。 */
	showTitle?: boolean
	/** 多板块视图保留独立标题，搜索／选择只替换下方工具区。 */
	headerLayout?: "inline" | "adaptive"
	attachments?: AttachmentItem[]
	setUserSelectDetail?: (detail: any) => void
	onFileClick?: (fileItem: any) => void
	topicId?: string
	projectId?: string
	shareCode?: string
	sharePassword?: string
	onCrossProjectOperationSuccess?: (result: CrossProjectOperationSuccessResult) => void
	activeFileId?: string | null
	selectedTopic?: any
	allowEdit?: boolean
	// 添加直接更新attachments的回调
	onAttachmentsChange?: (attachments: AttachmentItem[]) => void
	selectedProject?: any
	// 跨项目操作所需的props
	selectedWorkspace?: any
	projects?: any[]
	workspaces?: any[]
	isInProject?: boolean
	// 多选模式变化回调
	onMultiSelectModeChange?: (isMultiSelectMode: boolean) => void
	showMobileActions?: boolean
	// 自定义菜单项过滤器
	filterMenuItems?: (menuItems: any[], item?: AttachmentItem) => any[]
	// 自定义批量下载菜单过滤器
	filterBatchDownloadLayerMenuItems?: (menuItems: any[]) => any[]
	// 是否允许下载（用于分享页面权限控制）
	allowDownload?: boolean
	// 是否允许只读场景复制文件到当前用户的项目
	allowCopyTo?: boolean
	resolveTopicFileRowDecoration?: TopicFileRowDecorationResolver
	mobileViewVariant?: "default" | "project-detail" | "chat-sheet"
	refreshAttachments?: () => Promise<void> | void
	onSaveSlidesTemplate?: (item: AttachmentItem) => void
	onConvertToSlidesTemplate?: (item: AttachmentItem) => void
	headerTrailingAction?: ReactNode
	onOpenFileManager?: () => void
	onOpenRecycleBin?: () => void
	section?: SidebarSectionOptions
	contentBefore?: ReactNode
	/** 宿主已有空状态或错误说明时，隐藏默认空文件提示，仍保留文件树与工具栏。 */
	showEmptyState?: boolean
	/** Controls whether this file surface exposes the manual refresh action. */
	showRefresh?: boolean
	/** 文件树所属空间及其能力配置。 */
	spaceConfig?: TopicFilesSpaceConfig
	/** 判断节点是否允许参与移动和多选等变更操作。 */
	isItemSelectable?: (item: AttachmentItem) => boolean
	/** 特殊文件空间允许操作的固定根目录。 */
	operationRoot?: AttachmentItem
	projectFilesStore?: ProjectFilesStore
}

export interface TopicFilesPanelRef {
	addFile: (extraType?: PresetFileType) => void
	addFolder: () => void
	uploadFile: () => void
	uploadFolder: () => void
	openBatchMoveByFileIds: (fileIds: string[]) => void
}

const EMPTY_TOPIC_FILES_EXPANSION_STATE: TopicFilesExpansionState = {
	hasExpandableFolders: false,
	allFoldersExpanded: false,
}

interface TopicFilesExpansionSnapshot {
	ownerId: string
	state: TopicFilesExpansionState
}

const TopicFilesPanel = forwardRef<TopicFilesPanelRef, TopicFilesPanelProps>(
	function TopicFilesPanel(
		{
			className,
			loading = false,
			fitContent = false,
			scrollElementRef,
			title,
			showTitle = true,
			attachments = [],
			setUserSelectDetail,
			onFileClick,
			projectId,
			shareCode,
			sharePassword,
			onCrossProjectOperationSuccess,
			activeFileId,
			selectedTopic,
			allowEdit = true,
			onAttachmentsChange,
			selectedProject,
			selectedWorkspace,
			projects = [],
			workspaces = [],
			isInProject = false,
			onMultiSelectModeChange,
			showMobileActions = false,
			filterMenuItems,
			filterBatchDownloadLayerMenuItems,
			allowDownload,
			allowCopyTo = false,
			resolveTopicFileRowDecoration,
			fileHelpContext,
			mobileViewVariant = "default",
			refreshAttachments,
			onSaveSlidesTemplate,
			onConvertToSlidesTemplate,
			headerTrailingAction,
			onOpenFileManager,
			onOpenRecycleBin,
			section,
			headerLayout = "inline",
			contentBefore,
			showEmptyState = true,
			showRefresh,
			spaceConfig,
			isItemSelectable,
			operationRoot,
			projectFilesStore,
		},
		ref,
	) {
		const { t } = useTranslation("super")
		const resolvedTitle = title || t("topicFiles.title")
		const isMobile = useIsMobile()
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
		const capabilities = resolveTopicFilesCapabilities(spaceConfig?.capabilities)
		const isChatProject = isCachedChatWorkspaceProject(selectedProject)
		const { isShareRoute } = useShareRoute()
		const shouldShowRefresh = showRefresh ?? !isShareRoute
		const [fileFilters] = useState({
			documents: true,
			multimedia: true,
			code: true,
		})

		const { handleDownloadAll, allLoading } = useDownloadAll({ projectId })

		const [refreshLoading, setRefreshLoading] = useState(false)
		const [isSelectMode, setIsSelectMode] = useState(false)
		const [isSearchMode, setIsSearchMode] = useState(false)
		const prevProjectIdRef = useRef<string | undefined>()
		const {
			rawSearchValue,
			debouncedSearchValue,
			updateSearchValue,
			commitSearchValue,
			resetSearchValue,
		} = useDebouncedSearchValue({ source: "TopicFilesPanel" })

		const location = useLocation()
		const navigate = useNavigate()
		const consumedUploadLocationRef = useRef<string>()
		const navigationActionRef = useRef<AbortController>()
		useEffect(() => {
			const dispose = reaction(getFileReferenceIdentityKey, () =>
				navigationActionRef.current?.abort(),
			)
			return () => {
				dispose()
				navigationActionRef.current?.abort()
			}
		}, [projectId, helpOwner])
		useEffect(() => {
			const revealTarget = (_fileId: string, context?: SuperMagicLocateFileContext) => {
				if (helpOwner !== "project" || context?.projectId !== projectId) return
				setIsSearchMode(false)
				resetSearchValue()
			}
			pubsub.subscribe(PubSubEvents.Locate_File_In_Tree, revealTarget)
			return () => pubsub.unsubscribe(PubSubEvents.Locate_File_In_Tree, revealTarget)
		}, [helpOwner, projectId, resetSearchValue])

		useEffect(() => {
			const state: Record<string, unknown> = location.state || {}
			const target = state.uploadedFileTarget
			if (
				helpOwner !== "project" ||
				!isUploadedFileNavigationTarget(target) ||
				target.projectId !== projectId ||
				consumedUploadLocationRef.current === location.key
			)
				return
			consumedUploadLocationRef.current = location.key
			const controller = new AbortController()
			navigationActionRef.current?.abort()
			navigationActionRef.current = controller
			const clearNavigationTarget = () => {
				const remainingState = { ...state }
				delete remainingState.uploadedFileTarget
				navigate(location.pathname + location.search + location.hash, {
					replace: true,
					state: remainingState,
				})
			}
			// 接收时即消费导航字段，离开或回退不会重放本次定位。
			clearNavigationTarget()
			void (async () => {
				try {
					if (target.identityKey !== getFileReferenceIdentityKey()) return
					let item = projectFilesStore.filePresentationIndex.attachments.getItemById(
						target.fileId,
					)
					if (!item) {
						if (projectFilesStore.attachmentLoadState?.status === "loading") {
							await registerWaitForNextAttachmentsRefreshForProject(projectId, {
								signal: controller.signal,
							})
						} else {
							await waitForNextFullAttachmentsRefreshForProject(projectId, {
								signal: controller.signal,
							})
						}
						if (projectFilesStore.attachmentLoadState?.status !== "ready")
							throw new Error("Attachment load failed")
						item = projectFilesStore.filePresentationIndex.attachments.getItemById(
							target.fileId,
						)
					}
					if (
						controller.signal.aborted ||
						target.identityKey !== getFileReferenceIdentityKey() ||
						projectFilesStore.currentSelectedProject?.id !== target.projectId
					)
						return
					if (!item) throw new Error("Target unavailable")
					await new Promise<void>((resolve, reject) => {
						const onAbort = () => finish("cancelled")
						const finish = (status: "located" | "unavailable" | "cancelled") => {
							clearTimeout(timeoutId)
							controller.signal.removeEventListener("abort", onAbort)
							if (status === "unavailable") reject(new Error("Target unavailable"))
							else resolve()
						}
						const timeoutId = setTimeout(() => {
							finish("unavailable")
							controller.abort()
						}, 15_000)
						controller.signal.addEventListener("abort", onAbort, { once: true })
						pubsub.publish(PubSubEvents.Locate_File_In_Tree, target.fileId, {
							projectId: target.projectId,
							exact: true,
							signal: controller.signal,
							onResult: finish,
						})
					})
				} catch (error) {
					if (!(error instanceof DOMException && error.name === "AbortError"))
						magicToast.error(t("folderUpload.actions.targetUnavailable"))
				} finally {
					if (navigationActionRef.current === controller)
						navigationActionRef.current = undefined
				}
			})()
		}, [
			location.key,
			location.state,
			location.pathname,
			location.search,
			location.hash,
			projectId,
			helpOwner,
			navigate,
			t,
		])

		// 监听 projectId 变化，只在首次加载或切换项目时设置 loading 状态
		// 避免在任务执行过程中频繁进入 loading 状态
		useUpdateEffect(() => {
			const projectIdChanged = prevProjectIdRef.current !== projectId
			if (projectId && projectIdChanged && attachments.length === 0) {
				setRefreshLoading(true)
			}
			prevProjectIdRef.current = projectId
		}, [projectId])

		// 创建统一的同名文件处理 handler（单例）
		// 用于 TopicFilesCore 和 useUploadWithModal 共享
		const sharedDuplicateHandler = useDuplicateFileHandler({
			attachments: attachments || [],
		})

		const requestAttachmentsRefresh = useMemoizedFn((reason: string) => {
			if (refreshAttachments) {
				void refreshAttachments()
				return
			}

			if (!projectId) return

			requestProjectAttachmentsFullRefresh({
				projectId,
				reason,
			})
		})

		/** 特殊文件空间不依赖项目附件事件，文件变更后主动重新加载。 */
		const handleCoreAttachmentsUpdate = useMemoizedFn((sourceProjectId?: string) => {
			// 上传在切换项目后完成时，不刷新当前无关项目。
			if (!spaceConfig?.scope && sourceProjectId && sourceProjectId !== projectId) return
			requestAttachmentsRefresh("topic-files-core-operation-success")
		})

		// 使用 UploadWithModal hook 管理上传逻辑
		const {
			uploadModalVisible,
			selectedUploadFiles,
			isUploadingFolder,
			handleCustomUploadFile,
			handleCustomUploadFolder,
			handleUploadModalSubmit,
			handleUploadModalClose,
		} = useUploadWithModal({
			projectId,
			fileScope: spaceConfig?.scope,
			selectedProject,
			selectedTopic,
			attachments,
			duplicateFileHandler: sharedDuplicateHandler,
			onUpdateAttachments: (sourceProjectId) => {
				if (!spaceConfig?.scope && sourceProjectId && sourceProjectId !== projectId) return
				requestAttachmentsRefresh("topic-files-panel-upload-success")
			},
		})

		// 使用文件替换 hook
		const { handleReplaceFile } = useFileReplace({
			projectId,
			fileScope: spaceConfig?.scope,
			selectedProject,
			selectedTopic,
		})

		const projectDetailFilesController = useProjectDetailFilesController({
			projectId,
			attachments,
			selectedProject,
			selectedTopic,
			setIsSelectMode,
			onMoveSuccess: () => {
				requestAttachmentsRefresh("topic-files-panel-mobile-move-success")
			},
			onUpdateAttachments: () => {
				requestAttachmentsRefresh("topic-files-panel-mobile-upload-success")
			},
		})

		const handleProjectDetailCrossProjectSuccess = useCrossProjectMoveCompensation({
			attachments,
			onAttachmentsChange,
			onUpdateAttachments: () => {
				requestAttachmentsRefresh(
					"topic-files-panel-mobile-cross-project-operation-success",
				)
			},
		})

		const crossProjectOperation = useCrossProjectFileOperation({
			projectId,
			shareCode,
			sharePassword,
			selectedWorkspace: selectedWorkspace || null,
			selectedProject: selectedProject || null,
			projects,
			onSuccess: (result) => {
				setIsSelectMode(false)
				projectDetailFilesController.resetMobileSelection()
				handleProjectDetailCrossProjectSuccess(result)
				if (result) onCrossProjectOperationSuccess?.(result)
			},
		})

		const handleProjectDetailMoveSubmit = async (params: {
			path: AttachmentItem[]
			targetProjectId?: string
			targetAttachments?: AttachmentItem[]
			sourceAttachments?: AttachmentItem[]
		}) => {
			magicToast.info(t("topicFiles.moving"))

			if (params.targetProjectId && params.targetAttachments && params.sourceAttachments) {
				await crossProjectOperation.executeMoveOperation({
					fileIds:
						projectDetailFilesController.moveSelectorProps.pendingMoveFileIds || [],
					targetProjectId: params.targetProjectId,
					targetPath: params.path,
					targetAttachments: params.targetAttachments,
					sourceAttachments: params.sourceAttachments,
				})
				return
			}

			await projectDetailFilesController.moveSelectorProps.onSubmit?.({
				path: params.path,
			})
		}

		const handleProjectDetailCopySubmit = async (params: {
			path: AttachmentItem[]
			targetProjectId?: string
			targetAttachments?: AttachmentItem[]
			sourceAttachments?: AttachmentItem[]
		}) => {
			const fileIds = projectDetailFilesController.copySelectorProps.pendingCopyFileIds || []

			magicToast.info(t("topicFiles.copying"))

			if (params.targetProjectId && params.targetAttachments && params.sourceAttachments) {
				await crossProjectOperation.executeCopyOperation({
					fileIds,
					targetProjectId: params.targetProjectId,
					targetPath: params.path,
					targetAttachments: params.targetAttachments,
					sourceAttachments: params.sourceAttachments,
				})
				return
			}

			if (!projectId) return

			await crossProjectOperation.executeCopyOperation({
				fileIds,
				targetProjectId: projectId,
				targetPath: params.path,
				targetAttachments: attachments,
				sourceAttachments: attachments,
			})
		}

		const [mobileSelectedKeys, setMobileSelectedKeys] = useState<Set<string>>(new Set())

		const mobileProjectFilesDownload = useMobileProjectFilesDownload({
			projectId,
			attachments,
			selectedProject,
			selectedTopic,
			onFileClick,
			refreshAttachments,
			allowDownload,
			duplicateFileHandler: projectDetailFilesController.sharedDuplicateHandler,
		})

		// 聊天文件弹层与项目详情文件页共用同一套移动端文件树，只在最外层视觉壳上做区分。
		const shouldUseProjectDetailMobileView =
			isMobile &&
			(mobileViewVariant === "project-detail" || mobileViewVariant === "chat-sheet")

		const { handleBatchDownload, batchLoading: mobileBatchDownloadLoading } = useBatchDownload({
			projectId,
			getItemId: getMobileAttachmentKey,
			selectedItems: mobileSelectedKeys,
			setSelectedItems: setMobileSelectedKeys,
			filteredFiles: attachments,
			onSelectModeChange: (mode) => {
				setIsSelectMode(mode)
				if (!mode) projectDetailFilesController.resetMobileSelection()
			},
			attachments,
			allowEdit,
			allowDownload,
			isInProject,
			removeFile: () => undefined,
			onBatchShareClick: (fileIds) => {
				projectDetailFilesController.batchShare(new Set(fileIds))
			},
		})

		// 使用 ref 获取 TopicFilesCore 的方法
		const coreRef = useRef<TopicFilesCoreRef>(null)
		const [selectedCount, setSelectedCount] = useState(0)
		const [totalCount, setTotalCount] = useState(0)
		const expansionOwnerId = String(selectedProject?.id || projectId || "")
		const [expansionSnapshot, setExpansionSnapshot] = useState<TopicFilesExpansionSnapshot>({
			ownerId: expansionOwnerId,
			state: EMPTY_TOPIC_FILES_EXPANSION_STATE,
		})
		// owner 不一致时立即隐藏按钮，等待当前文件树重新上报，避免显示上一个项目的状态。
		const expansionState =
			expansionSnapshot.ownerId === expansionOwnerId
				? expansionSnapshot.state
				: EMPTY_TOPIC_FILES_EXPANSION_STATE
		const handleExpansionStateChange = useMemoizedFn((state: TopicFilesExpansionState) => {
			setExpansionSnapshot({ ownerId: expansionOwnerId, state })
		})
		const handleToggleAllFolders = useMemoizedFn(() => {
			coreRef.current?.toggleAllFolders()
		})

		// 处理搜索功能 - 切换到搜索模式
		const handleSearch = () => {
			setIsSearchMode(true)
		}
		// // 获取根目录右键菜单配置
		// const { getBatchDownloadLayerMenuItems } = useContextMenu({
		// 	handleUploadFile: handleCustomUploadFile, // 使用自定义上传文件函数
		// 	handleUploadFolder: handleCustomUploadFolder, // 使用自定义上传文件夹函数
		// 	handleShareItem: () => {},
		// 	handleDeleteItem: () => {},
		// 	handleDownloadOriginal: () => {},
		// 	handleDownloadPdf: () => {},
		// 	handleOpenFile: () => {},
		// 	handleStartRename: () => {},
		// 	handleAddToCurrentChat: () => {},
		// 	handleAddToNewChat: () => {},
		// 	handleReplaceFile: handleReplaceFile,
		// 	createVirtualFile: (type, key, parentPath) => {
		// 		// design 类型使用 createDesignProject，其他类型使用 createVirtualFile
		// 		if (type === "design") {
		// 			coreRef.current?.createDesignProject(parentPath)
		// 		} else {
		// 			coreRef.current?.createVirtualFile(type, key, parentPath)
		// 		}
		// 	},
		// 	createVirtualFolder: (key, parentPath) =>
		// 		coreRef.current?.createVirtualFolder(key, parentPath),
		// 	createVirtualDesignProject: (_key, parentPath) => {
		// 		// 调用 createDesignProject，它会内部调用 createVirtualDesignProject
		// 		coreRef.current?.createDesignProject(parentPath)
		// 	},
		// })

		// 处理关闭搜索模式
		const handleCloseSearch = () => {
			setIsSearchMode(false)
			resetSearchValue()
		}

		// 处理搜索值变化
		const handleSearchChange = (value: string) => {
			updateSearchValue(value)
		}

		const handleSearchCommit = (value: string) => {
			commitSearchValue(value)
		}

		// 处理添加文件功能 - 打开创建文件菜单
		const handleAddFile = (extraType?: PresetFileType) => {
			if (!allowEdit) return
			// 触发第一个文件创建选项（txt）
			coreRef.current?.createVirtualFile(extraType || "txt")
		}

		const handleAddDesign = () => {
			if (!allowEdit) return
			coreRef.current?.createDesignProject()
		}

		const handleAddSelfMedia = () => {
			if (!allowEdit) return
			coreRef.current?.createSelfMediaProject()
		}

		const handleAddAICard = () => {
			if (!allowEdit) return
			coreRef.current?.createAICardProject()
		}

		// 处理添加文件夹功能
		const handleAddFolder = () => {
			if (!allowEdit) return
			coreRef.current?.createVirtualFolder()
		}

		// 处理从其他项目导入
		const handleImportFromOtherProject = () => {
			if (!allowEdit) return
			coreRef.current?.handleImportFromOtherProject()
		}

		const handleUploadFile = () => {
			if (!allowEdit) return
			if (spaceConfig?.operations) {
				coreRef.current?.handleUploadFile()
				return
			}
			handleCustomUploadFile()
		}

		const handleUploadFolder = () => {
			if (!allowEdit) return
			handleCustomUploadFolder()
		}

		/** 刷新当前文件空间，特殊空间优先调用外部加载器。 */
		const handleRefreshList = () => {
			setRefreshLoading(true)
			if (refreshAttachments) {
				Promise.resolve(refreshAttachments())
					.then(() => {
						magicToast.success(t("common.refreshSuccess"))
					})
					.catch(() => magicToast.error(t("common.refreshFailed")))
					.finally(() => {
						setRefreshLoading(false)
					})
				return
			}

			requestProjectAttachmentsFullRefresh({
				projectId,
				reason: "topic-files-panel-manual-refresh",
				callback: () => {
					setRefreshLoading(false)
					magicToast.success(t("common.refreshSuccess"))
				},
			})
		}

		// 处理进入多选模式
		const handleEnterSelectMode = () => {
			setIsSelectMode(true)
		}

		// 处理取消选择
		const handleCancelSelect = () => {
			setIsSelectMode(false)
			// 清空选择
			if (spaceConfig?.directorySource) coreRef.current?.deselectAll()
			else pubsub.publish(PubSubEvents.Deselect_All_Files)
		}

		// 处理全选
		const handleSelectAll = () => {
			if (spaceConfig?.directorySource) coreRef.current?.selectAll()
			else pubsub.publish(PubSubEvents.Select_All_Files)
		}

		// 处理取消全选
		const handleDeselectAll = () => {
			pubsub.publish(PubSubEvents.Deselect_All_Files)
		}

		useEffect(() => {
			if (spaceConfig?.directorySource) return
			const handleUpdateAttachmentsLoading = (loading: boolean) => {
				setRefreshLoading(loading)
			}
			const handleCancelFileSelection = () => {
				handleCancelSelect()
			}

			pubsub.subscribe(
				PubSubEvents.Update_Attachments_Loading,
				handleUpdateAttachmentsLoading,
			)
			pubsub.subscribe(PubSubEvents.Cancel_File_Selection, handleCancelFileSelection)
			return () => {
				pubsub.unsubscribe(
					PubSubEvents.Update_Attachments_Loading,
					handleUpdateAttachmentsLoading,
				)
				pubsub.unsubscribe(PubSubEvents.Cancel_File_Selection, handleCancelFileSelection)
			}
		}, [])

		// 通知父组件多选模式变化
		useEffect(() => {
			onMultiSelectModeChange?.(isSelectMode)
		}, [isSelectMode, onMultiSelectModeChange])

		// Expose file operation methods to parent component
		useImperativeHandle(ref, () => ({
			addFile: handleAddFile,
			addFolder: handleAddFolder,
			uploadFile: handleUploadFile,
			uploadFolder: handleUploadFolder,
			openBatchMoveByFileIds: (fileIds: string[]) => {
				if (!allowEdit) return
				if (shouldUseProjectDetailMobileView) {
					projectDetailFilesController.batchMoveByFileIds(fileIds)
					return
				}

				coreRef.current?.openBatchMoveByFileIds(fileIds)
			},
		}))

		const adaptiveHeader = headerLayout === "adaptive"
		// 搜索和选择状态保持独立标题。
		// 用户空间将身份标题放在独立一行；这里只复用原工具按钮，不复制操作逻辑。
		const stackedHeader = adaptiveHeader && (isSearchMode || isSelectMode)
		const modeSection = stackedHeader ? undefined : section
		const header = isSearchMode ? (
			<SearchModeHeader
				placeholder={spaceConfig?.directorySource ? t("userSpace.searchLoaded") : undefined}
				key="search-header"
				searchValue={rawSearchValue}
				onSearchChange={handleSearchChange}
				onSearchCommit={handleSearchCommit}
				onClose={handleCloseSearch}
				headerTrailingAction={headerTrailingAction}
				section={modeSection}
				className={cn("duration-200 animate-in fade-in", !showTitle && "[&>p]:hidden")}
			/>
		) : isSelectMode ? (
			<SelectModeHeader
				key="select-header"
				selectedCount={selectedCount}
				totalCount={totalCount}
				onSelectAll={handleSelectAll}
				onDeselectAll={handleDeselectAll}
				onCancel={handleCancelSelect}
				headerTrailingAction={headerTrailingAction}
				section={modeSection}
				className="duration-200 animate-in fade-in"
			/>
		) : (
			<NormalModeHeader
				adaptive={adaptiveHeader}
				showTitle={showTitle}
				expandAllLabel={
					spaceConfig?.directorySource ? t("userSpace.expandLoaded") : undefined
				}
				key="normal-header"
				title={resolvedTitle}
				isShareRoute={isShareRoute}
				showRefresh={shouldShowRefresh}
				refreshLoading={loading || refreshLoading}
				allowEdit={allowEdit}
				showMobileActions={showMobileActions}
				onRefresh={handleRefreshList}
				onSearch={handleSearch}
				onAddFile={handleAddFile}
				onAddDesign={capabilities.projectContentCreation ? handleAddDesign : undefined}
				onAddSelfMedia={
					capabilities.projectContentCreation ? handleAddSelfMedia : undefined
				}
				onAddAICard={capabilities.projectContentCreation ? handleAddAICard : undefined}
				onAddFolder={handleAddFolder}
				allFoldersExpanded={expansionState.allFoldersExpanded}
				onToggleAllFolders={
					expansionState.hasExpandableFolders ? handleToggleAllFolders : undefined
				}
				onUploadFile={capabilities.upload ? handleUploadFile : undefined}
				onUploadFolder={
					capabilities.upload && !spaceConfig?.directorySource
						? handleUploadFolder
						: undefined
				}
				onImportFromOtherProject={
					capabilities.importFromOtherProject ? handleImportFromOtherProject : undefined
				}
				onEnterSelectMode={capabilities.multiSelect ? handleEnterSelectMode : undefined}
				headerTrailingAction={headerTrailingAction}
				section={modeSection}
				className="duration-200 animate-in fade-in"
			/>
		)
		const content = (
			<TopicFilesCore
				ref={coreRef}
				attachments={attachments}
				setUserSelectDetail={setUserSelectDetail}
				onFileClick={onFileClick}
				projectId={projectId}
				shareCode={shareCode}
				sharePassword={sharePassword}
				onCrossProjectOperationSuccess={onCrossProjectOperationSuccess}
				fileFilters={fileFilters}
				handleDownloadAll={handleDownloadAll}
				allLoading={allLoading}
				activeFileId={activeFileId}
				selectedTopic={selectedTopic}
				isSelectMode={isSelectMode}
				onExpansionStateChange={isSearchMode ? undefined : handleExpansionStateChange}
				onSelectionChange={(selectedCount, totalCount) => {
					setSelectedCount(selectedCount)
					setTotalCount(totalCount)
				}}
				allowEdit={allowEdit}
				onUpdateAttachments={handleCoreAttachmentsUpdate}
				onAttachmentsChange={onAttachmentsChange}
				onSelectModeChange={setIsSelectMode}
				selectedProject={selectedProject}
				handleReplaceFile={handleReplaceFile}
				duplicateFileHandler={sharedDuplicateHandler}
				selectedWorkspace={selectedWorkspace}
				projects={projects}
				workspaces={workspaces}
				isInProject={isInProject}
				externalSearchValue={isSearchMode ? debouncedSearchValue : ""}
				filterMenuItems={filterMenuItems}
				filterBatchDownloadLayerMenuItems={filterBatchDownloadLayerMenuItems}
				allowDownload={allowDownload}
				allowCopyTo={allowCopyTo}
				allowReadonlySelection={isShareRoute}
				resolveTopicFileRowDecoration={resolveTopicFileRowDecoration}
				fileHelpContext={resolvedFileHelpContext}
				refreshLoading={loading || refreshLoading}
				onSaveSlidesTemplate={onSaveSlidesTemplate}
				onConvertToSlidesTemplate={onConvertToSlidesTemplate}
				spaceConfig={spaceConfig}
				isItemSelectable={isItemSelectable}
				operationRoot={operationRoot}
				projectFilesStore={projectFilesStore}
				fitContent={fitContent}
				showEmptyState={showEmptyState}
				scrollElementRef={scrollElementRef}
			/>
		)

		return (
			<>
				<div
					className={cn(
						"flex min-h-0 flex-col gap-0.5",
						fitContent ? "min-h-0 shrink-0" : "h-full",
						className,
					)}
					data-testid="topic-files-panel"
				>
					{shouldUseProjectDetailMobileView ? (
						<MobileProjectDetailFilesView
							fileHelpContext={resolvedFileHelpContext}
							attachments={attachments}
							activeFileId={activeFileId}
							allowEdit={allowEdit}
							mobileViewVariant={mobileViewVariant}
							refreshLoading={loading || refreshLoading}
							onRefresh={handleRefreshList}
							selectionResetKey={projectDetailFilesController.selectionResetKey}
							setUserSelectDetail={setUserSelectDetail}
							onFileOpen={onFileClick}
							onSelectionModeChange={setIsSelectMode}
							onCreateFile={
								allowEdit ? projectDetailFilesController.createFile : undefined
							}
							onCreateFolder={
								allowEdit ? projectDetailFilesController.createFolder : undefined
							}
							onUploadFile={
								allowEdit
									? projectDetailFilesController.handleCustomUploadFile
									: undefined
							}
							allowDownload={mobileProjectFilesDownload.allowDownload}
							getSingleFileDownloadMenuItems={
								mobileProjectFilesDownload.getSingleFileDownloadMenuItems
							}
							preloadWaterMarkFreeModal={
								mobileProjectFilesDownload.preloadWaterMarkFreeModal
							}
							onSelectedKeysChange={setMobileSelectedKeys}
							onBatchZipDownload={
								shouldUseProjectDetailMobileView && allowDownload !== false
									? handleBatchDownload
									: undefined
							}
							batchDownloadLoading={mobileBatchDownloadLoading}
							onBatchShare={projectDetailFilesController.batchShare}
							// Copy does not mutate source files; keep available in read-only views (desktop parity).
							onBatchCopy={projectDetailFilesController.batchCopy}
							onBatchMove={
								allowEdit ? projectDetailFilesController.batchMove : undefined
							}
							onBatchDelete={
								allowEdit ? projectDetailFilesController.batchDelete : undefined
							}
						/>
					) : (
						<>
							{section ? (
								<SidebarExpandableItem
									label={resolvedTitle}
									{...section}
									testId="memory-files-section"
									header={stackedHeader ? undefined : header}
								>
									{(!adaptiveHeader || stackedHeader) && section.description}
									{stackedHeader && header}
									{contentBefore}
									{content}
								</SidebarExpandableItem>
							) : (
								<>
									{stackedHeader && (
										<h3 className="shrink-0 break-words px-3 py-2 text-[13px] font-medium leading-5 [overflow-wrap:anywhere]">
											{resolvedTitle}
										</h3>
									)}
									{header}
									{contentBefore}
									{content}
								</>
							)}
						</>
					)}
					{!isMobile && onOpenFileManager && (
						<FileManagerFooter
							onOpenFileManager={onOpenFileManager}
							onOpenRecycleBin={onOpenRecycleBin}
						/>
					)}
				</div>
				{projectDetailFilesController.deleteConfirmNode}

				{/* UploadModal for selecting storage location */}
				{selectedProject &&
					(shouldUseProjectDetailMobileView ? (
						<UploadModal
							visible={projectDetailFilesController.uploadModalVisible}
							title={resolvedTitle}
							projectId={selectedProject.id}
							uploadFiles={projectDetailFilesController.selectedUploadFiles}
							attachments={attachments}
							defaultPath={operationRoot ? [operationRoot] : []}
							isShowCreateDirectory={true}
							isUploadingFolder={projectDetailFilesController.isUploadingFolder}
							tips={
								projectDetailFilesController.isUploadingFolder
									? t("selectPathModal.uploadFolderTip")
									: t("selectPathModal.uploadFileTip")
							}
							onSubmit={projectDetailFilesController.handleUploadModalSubmit}
							onClose={projectDetailFilesController.handleUploadModalClose}
						/>
					) : (
						<UploadModal
							visible={uploadModalVisible}
							title={resolvedTitle}
							projectId={selectedProject.id}
							uploadFiles={selectedUploadFiles}
							attachments={attachments}
							defaultPath={operationRoot ? [operationRoot] : []}
							isShowCreateDirectory={true}
							isUploadingFolder={isUploadingFolder}
							tips={
								isUploadingFolder
									? t("selectPathModal.uploadFolderTip")
									: t("selectPathModal.uploadFileTip")
							}
							onSubmit={handleUploadModalSubmit}
							onClose={handleUploadModalClose}
						/>
					))}

				{/* 同名文件处理 Modal - 统一处理所有上传方式 */}
				<FolderConflictModal
					visible={sharedDuplicateHandler.folderConflictModalVisible}
					folderName={sharedDuplicateHandler.currentFolderName}
					totalConflicts={sharedDuplicateHandler.totalFolderConflicts}
					canMerge={sharedDuplicateHandler.canMergeFolderConflict}
					onCancel={sharedDuplicateHandler.handleFolderConflictCancel}
					onMerge={sharedDuplicateHandler.handleFolderConflictMerge}
					onKeepBoth={sharedDuplicateHandler.handleFolderConflictKeepBoth}
					onReplace={sharedDuplicateHandler.handleFolderConflictReplace}
				/>
				{shouldUseProjectDetailMobileView ? (
					<DuplicateFileModal
						visible={projectDetailFilesController.sharedDuplicateHandler.modalVisible}
						fileName={
							projectDetailFilesController.sharedDuplicateHandler.currentFileName
						}
						totalDuplicates={
							projectDetailFilesController.sharedDuplicateHandler.totalDuplicates
						}
						onCancel={projectDetailFilesController.sharedDuplicateHandler.handleCancel}
						onReplace={
							projectDetailFilesController.sharedDuplicateHandler.handleReplace
						}
						onKeepBoth={
							projectDetailFilesController.sharedDuplicateHandler.handleKeepBoth
						}
					/>
				) : (
					<DuplicateFileModal
						visible={sharedDuplicateHandler.modalVisible}
						fileName={sharedDuplicateHandler.currentFileName}
						totalDuplicates={sharedDuplicateHandler.totalDuplicates}
						onCancel={sharedDuplicateHandler.handleCancel}
						onReplace={sharedDuplicateHandler.handleReplace}
						onKeepBoth={sharedDuplicateHandler.handleKeepBoth}
					/>
				)}

				{shouldUseProjectDetailMobileView &&
					(projectDetailFilesController.shareFileIds.length > 0 ? (
						// 项目详情移动端的批量分享入口需要与文件详情入口共用同一套新分享 Sheet，
						// 否则这里会回退到旧 Web 弹窗，导致第三轮文件分享体验不一致。
						<ProjectShareSheet
							open={projectDetailFilesController.shareModalVisible}
							onClose={projectDetailFilesController.closeShareModal}
							mode="file"
							attachments={attachments}
							attachmentList={attachments}
							defaultSelectedFileIds={projectDetailFilesController.shareFileIds}
							projectName={selectedProject?.project_name}
							projectId={projectId}
						/>
					) : null)}

				{shouldUseProjectDetailMobileView ? (
					<>
						<SelectDirectoryModal
							{...projectDetailFilesController.moveSelectorProps}
							mobileCrossProjectConfig={
								selectedProject
									? {
											currentProject: selectedProject,
											currentWorkspace: selectedWorkspace,
											sourceAttachments: attachments,
											isChatProject,
										}
									: undefined
							}
							onSubmit={handleProjectDetailMoveSubmit}
						/>
						<SelectDirectoryModal
							{...projectDetailFilesController.copySelectorProps}
							mobileCrossProjectConfig={
								selectedProject
									? {
											currentProject: selectedProject,
											currentWorkspace: selectedWorkspace,
											sourceAttachments: attachments,
											isChatProject,
										}
									: undefined
							}
							onSubmit={handleProjectDetailCopySubmit}
						/>
						<DuplicateFileModal
							visible={crossProjectOperation.duplicateModalVisible}
							fileName={crossProjectOperation.currentDuplicateFileName}
							totalDuplicates={crossProjectOperation.totalDuplicates}
							onCancel={crossProjectOperation.handleDuplicateCancel}
							onReplace={crossProjectOperation.handleDuplicateReplace}
							onKeepBoth={crossProjectOperation.handleDuplicateKeepBoth}
						/>
					</>
				) : null}

				{/* Mobile file list must mount watermark agreement modal (TopicFilesCore does this on desktop). */}
				{shouldUseProjectDetailMobileView
					? mobileProjectFilesDownload.agreementModal
					: null}
			</>
		)
	},
)

export default memo(TopicFilesPanel)
