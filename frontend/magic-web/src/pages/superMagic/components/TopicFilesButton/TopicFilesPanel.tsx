import { memo, useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react"
import { useTranslation } from "react-i18next"
import TopicFilesCore, { type TopicFilesCoreRef } from "./TopicFilesCore"
import { useDownloadAll } from "./useDownloadAll"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import useShareRoute from "../../hooks/useShareRoute"
import type { AttachmentItem } from "./hooks/types"
import { UploadModal } from "../MessageEditor/components/UploadModal"
import { useUploadWithModal } from "./hooks/useUploadWithModal"
import { useDuplicateFileHandler } from "./hooks/useDuplicateFileHandler"
import {
	DuplicateFileModal,
	SelectModeHeader,
	NormalModeHeader,
	SearchModeHeader,
} from "./components"
import { useFileReplace } from "./hooks/useFileReplace"
import { cn } from "@/lib/utils"
import magicToast from "@/components/base/MagicToaster/utils"
import { type PresetFileType } from "./constant"
import type { TopicFileRowDecorationResolver } from "./topic-file-row-decoration.types"
import { useUpdateEffect } from "ahooks"
import { useIsMobile } from "@/hooks/useIsMobile"
import MobileProjectDetailFilesView from "./components/MobileProjectDetailFilesView"
import { SelectDirectoryModal } from "../SelectPathModal"
import { useBatchDownload } from "./hooks/useBatchDownload"
import { useProjectDetailFilesController } from "./hooks/useProjectDetailFilesController"
import { useCrossProjectFileOperation } from "./hooks/useCrossProjectFileOperation"
import { useMobileProjectFilesDownload } from "./hooks/useMobileProjectFilesDownload"
import { getMobileAttachmentKey } from "./utils/get-mobile-attachment-key"
import ProjectShareSheet from "@/pages/superMagicMobile/components/ProjectShareSheet"
import { isCachedChatWorkspaceProject } from "@/pages/superMagic/utils/isChatWorkspaceProject"

interface TopicFilesPanelProps {
	className?: string
	title?: string
	attachments?: AttachmentItem[]
	setUserSelectDetail?: (detail: any) => void
	onFileClick?: (fileItem: any) => void
	topicId?: string
	projectId?: string
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
	filterMenuItems?: (menuItems: any[]) => any[]
	// 自定义批量下载菜单过滤器
	filterBatchDownloadLayerMenuItems?: (menuItems: any[]) => any[]
	// 是否允许下载（用于分享页面权限控制）
	allowDownload?: boolean
	resolveTopicFileRowDecoration?: TopicFileRowDecorationResolver
	mobileViewVariant?: "default" | "project-detail" | "chat-sheet"
	refreshAttachments?: () => Promise<void> | void
}

export interface TopicFilesPanelRef {
	addFile: (extraType?: PresetFileType) => void
	addFolder: () => void
	uploadFile: () => void
	uploadFolder: () => void
	openBatchMoveByFileIds: (fileIds: string[]) => void
}

const TopicFilesPanel = forwardRef<TopicFilesPanelRef, TopicFilesPanelProps>(
	function TopicFilesPanel(
		{
			className,
			title,
			attachments = [],
			setUserSelectDetail,
			onFileClick,
			projectId,
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
			resolveTopicFileRowDecoration,
			mobileViewVariant = "default",
			refreshAttachments,
		},
		ref,
	) {
		const { t } = useTranslation("super")
		const resolvedTitle = title || t("topicFiles.title")
		const isMobile = useIsMobile()
		const isChatProject = isCachedChatWorkspaceProject(selectedProject)
		const { isShareRoute } = useShareRoute()
		const [fileFilters] = useState({
			documents: true,
			multimedia: true,
			code: true,
		})

		const { handleDownloadAll, allLoading } = useDownloadAll({ projectId })

		const [refreshLoading, setRefreshLoading] = useState(false)
		const [isSelectMode, setIsSelectMode] = useState(false)
		const [isSearchMode, setIsSearchMode] = useState(false)
		const [searchValue, setSearchValue] = useState("")
		const prevProjectIdRef = useRef<string | undefined>()

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
			selectedProject,
			selectedTopic,
			attachments,
			duplicateFileHandler: sharedDuplicateHandler,
		})

		// 使用文件替换 hook
		const { handleReplaceFile } = useFileReplace({
			projectId,
			selectedProject,
			selectedTopic,
		})

		const projectDetailFilesController = useProjectDetailFilesController({
			projectId,
			attachments,
			selectedProject,
			selectedTopic,
			setIsSelectMode,
			refreshAttachments,
		})

		const crossProjectOperation = useCrossProjectFileOperation({
			projectId,
			selectedWorkspace: selectedWorkspace || null,
			selectedProject: selectedProject || null,
			projects,
			onSuccess: async () => {
				await refreshAttachments?.()
				setIsSelectMode(false)
				projectDetailFilesController.resetMobileSelection()
				pubsub.publish(PubSubEvents.Update_Attachments)
			},
		})

		const handleProjectDetailMoveSubmit = async (params: {
			path: AttachmentItem[]
			targetProjectId?: string
			targetAttachments?: AttachmentItem[]
			sourceAttachments?: AttachmentItem[]
		}) => {
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
		// 	handleDownloadPpt: () => {},
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
			setSearchValue("")
		}

		// 处理搜索值变化
		const handleSearchChange = (value: string) => {
			setSearchValue(value)
		}

		// 处理添加文件功能 - 打开创建文件菜单
		const handleAddFile = (extraType?: PresetFileType) => {
			// 触发第一个文件创建选项（txt）
			coreRef.current?.createVirtualFile(extraType || "txt")
		}

		const handleAddDesign = () => {
			coreRef.current?.createDesignProject()
		}

		// 处理添加文件夹功能
		const handleAddFolder = () => {
			coreRef.current?.createVirtualFolder()
		}

		// 处理从其他项目导入
		const handleImportFromOtherProject = () => {
			coreRef.current?.handleImportFromOtherProject()
		}

		const handleRefreshList = () => {
			setRefreshLoading(true)
			pubsub.publish(PubSubEvents.Update_Attachments, () => {
				setRefreshLoading(false)
				magicToast.success(t("common.refreshSuccess"))
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
			pubsub.publish(PubSubEvents.Deselect_All_Files)
		}

		// 处理全选
		const handleSelectAll = () => {
			pubsub.publish(PubSubEvents.Select_All_Files)
		}

		// 处理取消全选
		const handleDeselectAll = () => {
			pubsub.publish(PubSubEvents.Deselect_All_Files)
		}

		useEffect(() => {
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
			uploadFile: handleCustomUploadFile,
			uploadFolder: handleCustomUploadFolder,
			openBatchMoveByFileIds: (fileIds: string[]) => {
				if (shouldUseProjectDetailMobileView) {
					projectDetailFilesController.batchMoveByFileIds(fileIds)
					return
				}

				coreRef.current?.openBatchMoveByFileIds(fileIds)
			},
		}))

		return (
			<>
				<div className={cn("flex h-full flex-col gap-0.5", className)}>
					{shouldUseProjectDetailMobileView ? (
						<MobileProjectDetailFilesView
							attachments={attachments}
							activeFileId={activeFileId}
							allowEdit={allowEdit}
							mobileViewVariant={mobileViewVariant}
							refreshLoading={refreshLoading}
							onRefresh={handleRefreshList}
							selectionResetKey={projectDetailFilesController.selectionResetKey}
							setUserSelectDetail={setUserSelectDetail}
							onFileOpen={onFileClick}
							onSelectionModeChange={setIsSelectMode}
							onCreateFile={projectDetailFilesController.createFile}
							onCreateFolder={projectDetailFilesController.createFolder}
							onUploadFile={projectDetailFilesController.handleCustomUploadFile}
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
							onBatchMove={projectDetailFilesController.batchMove}
							onBatchDelete={projectDetailFilesController.batchDelete}
						/>
					) : (
						<>
							{/* Header Section */}
							{isSearchMode ? (
								<SearchModeHeader
									key="search-header"
									searchValue={searchValue}
									onSearchChange={handleSearchChange}
									onClose={handleCloseSearch}
									className="duration-200 animate-in fade-in"
								/>
							) : isSelectMode ? (
								<SelectModeHeader
									key="select-header"
									selectedCount={selectedCount}
									totalCount={totalCount}
									onSelectAll={handleSelectAll}
									onDeselectAll={handleDeselectAll}
									onCancel={handleCancelSelect}
									className="duration-200 animate-in fade-in"
								/>
							) : (
								<NormalModeHeader
									key="normal-header"
									title={resolvedTitle}
									isShareRoute={isShareRoute}
									refreshLoading={refreshLoading}
									allowEdit={allowEdit}
									showMobileActions={showMobileActions}
									onRefresh={handleRefreshList}
									onSearch={handleSearch}
									onAddFile={handleAddFile}
									onAddDesign={handleAddDesign}
									onAddFolder={handleAddFolder}
									onUploadFile={handleCustomUploadFile}
									onUploadFolder={handleCustomUploadFolder}
									onImportFromOtherProject={handleImportFromOtherProject}
									onEnterSelectMode={handleEnterSelectMode}
									className="duration-200 animate-in fade-in"
								/>
							)}

							{/* Content Section */}
							{/* Use TopicFilesCore for content and batch download functionality */}
							<TopicFilesCore
								ref={coreRef}
								attachments={attachments}
								setUserSelectDetail={setUserSelectDetail}
								onFileClick={onFileClick}
								projectId={projectId}
								fileFilters={fileFilters}
								handleDownloadAll={handleDownloadAll}
								allLoading={allLoading}
								activeFileId={activeFileId}
								selectedTopic={selectedTopic}
								isSelectMode={isSelectMode}
								onSelectionChange={(selectedCount, totalCount) => {
									setSelectedCount(selectedCount)
									setTotalCount(totalCount)
								}}
								allowEdit={allowEdit}
								onAttachmentsChange={onAttachmentsChange}
								onSelectModeChange={setIsSelectMode}
								selectedProject={selectedProject}
								handleReplaceFile={handleReplaceFile}
								duplicateFileHandler={sharedDuplicateHandler}
								selectedWorkspace={selectedWorkspace}
								projects={projects}
								workspaces={workspaces}
								isInProject={isInProject}
								externalSearchValue={searchValue}
								filterMenuItems={filterMenuItems}
								filterBatchDownloadLayerMenuItems={
									filterBatchDownloadLayerMenuItems
								}
								allowDownload={allowDownload}
								resolveTopicFileRowDecoration={resolveTopicFileRowDecoration}
								refreshLoading={refreshLoading}
							/>
						</>
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
