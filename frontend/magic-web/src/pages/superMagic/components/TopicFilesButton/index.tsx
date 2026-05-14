import { forwardRef, useImperativeHandle, useRef } from "react"
import { useStyles } from "./style"
import TopicFilesPanel, { TopicFilesPanelRef } from "./TopicFilesPanel"
import type { AttachmentItem } from "./hooks/types"
import type { PresetFileType } from "./constant"
import type { TopicFileRowDecorationResolver } from "./topic-file-row-decoration.types"

export { PRESET_FILE_TYPES, type PresetFileType } from "./constant"
export type {
	TopicFileRowDecoration,
	TopicFileRowDecorationContext,
	TopicFileRowDecorationResolver,
} from "./topic-file-row-decoration.types"

export interface TopicFilesButtonProps {
	className?: string
	title?: string
	attachments?: AttachmentItem[]
	setUserSelectDetail?: (detail: any) => void
	onFileClick?: (fileItem: any) => void
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

export interface TopicFilesButtonRef {
	addFile: (extraType?: PresetFileType) => void
	addFolder: () => void
	uploadFile: () => void
	uploadFolder: () => void
	openBatchMoveByFileIds: (fileIds: string[]) => void
}

const TopicFilesButton = forwardRef<TopicFilesButtonRef, TopicFilesButtonProps>(
	function TopicFilesButton(
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
		const { styles, cx } = useStyles()
		const panelRef = useRef<TopicFilesPanelRef>(null)

		// Expose file operation methods to parent
		useImperativeHandle(ref, () => ({
			addFile: (extraType?: PresetFileType) => {
				panelRef.current?.addFile(extraType)
			},
			addFolder: () => {
				panelRef.current?.addFolder()
			},
			uploadFile: () => {
				panelRef.current?.uploadFile()
			},
			uploadFolder: () => {
				panelRef.current?.uploadFolder()
			},
			openBatchMoveByFileIds: (fileIds: string[]) => {
				panelRef.current?.openBatchMoveByFileIds(fileIds)
			},
		}))

		// Expanded state: use TopicFilesPanel component
		return (
			<div className={cx(styles.container, className)}>
				<TopicFilesPanel
					ref={panelRef}
					className={className}
					title={title}
					attachments={attachments}
					setUserSelectDetail={setUserSelectDetail}
					onFileClick={onFileClick}
					projectId={projectId}
					activeFileId={activeFileId}
					selectedTopic={selectedTopic}
					allowEdit={allowEdit}
					onAttachmentsChange={onAttachmentsChange}
					selectedProject={selectedProject}
					selectedWorkspace={selectedWorkspace}
					projects={projects}
					workspaces={workspaces}
					isInProject={isInProject}
					onMultiSelectModeChange={onMultiSelectModeChange}
					showMobileActions={showMobileActions}
					filterMenuItems={filterMenuItems}
					filterBatchDownloadLayerMenuItems={filterBatchDownloadLayerMenuItems}
					allowDownload={allowDownload}
					resolveTopicFileRowDecoration={resolveTopicFileRowDecoration}
					mobileViewVariant={mobileViewVariant}
					refreshAttachments={refreshAttachments}
				/>
			</div>
		)
	},
)

export default TopicFilesButton
