import { memo, useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react"
import { useTranslation } from "react-i18next"
import TopicFilesCore, { type TopicFilesCoreRef } from "./TopicFilesCore"
import { useDownloadAll } from "./useDownloadAll"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
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
import { cn } from "@/opensource/lib/utils"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { type PresetFileType } from "./constant"

interface TopicFilesPanelProps {
	className?: string
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
	// 自定义菜单项过滤器
	filterMenuItems?: (menuItems: any[]) => any[]
	// 自定义批量下载菜单过滤器
	filterBatchDownloadLayerMenuItems?: (menuItems: any[]) => any[]
	// 是否允许下载（用于分享页面权限控制）
	allowDownload?: boolean
}

export interface TopicFilesPanelRef {
	addFile: (extraType?: PresetFileType) => void
	addFolder: () => void
	uploadFile: () => void
	uploadFolder: () => void
}

const TopicFilesPanel = forwardRef<TopicFilesPanelRef, TopicFilesPanelProps>(
	function TopicFilesPanel(
		{
			className,
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
			filterMenuItems,
			filterBatchDownloadLayerMenuItems,
			allowDownload,
		},
		ref,
	) {
		const { t } = useTranslation("super")
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
		}))

		return (
			<>
				<div className={cn("flex h-full flex-col gap-0.5", className)}>
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
							isShareRoute={isShareRoute}
							refreshLoading={refreshLoading}
							allowEdit={allowEdit}
							onRefresh={handleRefreshList}
							onSearch={handleSearch}
							onAddFile={handleAddFile}
							onAddDesign={handleAddDesign}
							onAddFolder={handleAddFolder}
							onUploadFile={handleCustomUploadFile}
							onUploadFolder={handleCustomUploadFolder}
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
						filterBatchDownloadLayerMenuItems={filterBatchDownloadLayerMenuItems}
						allowDownload={allowDownload}
					/>
				</div>

				{/* UploadModal for selecting storage location */}
				{selectedProject && (
					<UploadModal
						visible={uploadModalVisible}
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
				)}

				{/* 同名文件处理 Modal - 统一处理所有上传方式 */}
				<DuplicateFileModal
					visible={sharedDuplicateHandler.modalVisible}
					fileName={sharedDuplicateHandler.currentFileName}
					totalDuplicates={sharedDuplicateHandler.totalDuplicates}
					onCancel={sharedDuplicateHandler.handleCancel}
					onReplace={sharedDuplicateHandler.handleReplace}
					onKeepBoth={sharedDuplicateHandler.handleKeepBoth}
				/>
			</>
		)
	},
)

export default memo(TopicFilesPanel)
