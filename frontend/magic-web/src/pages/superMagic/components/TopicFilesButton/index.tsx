import type { FileHelpContext } from "./utils/magic-system-folder"
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
	type ReactNode,
} from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { useStyles } from "./style"
import TopicFilesPanel, { TopicFilesPanelRef } from "./TopicFilesPanel"
import type { AttachmentItem } from "./hooks/types"
import type { PresetFileType } from "./constant"
import type { TopicFileRowDecorationResolver } from "./topic-file-row-decoration.types"
import magicToast from "@/components/base/MagicToaster/utils"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	createAvailableSlidesTemplateCode,
	mySlidesTemplateAdapter,
	type MySlidesTemplatePage,
} from "@/pages/superMagic/services/mySlidesTemplateAdapter"
import type { SlidesTemplateItem } from "@/pages/superMagic/components/MainInputContainer/scenes/Slides/slidesTemplateState"
import { SaveSlidesTemplateDialog, type SaveSlidesTemplateTarget } from "./components"
import { buildConvertToSlidesTemplatePayload } from "@/pages/superMagic/utils/slidesTemplateActions"
import type { TopicFilesSpaceConfig } from "./file-space"
import type { CrossProjectOperationSuccessResult } from "./hooks/useCrossProjectFileOperation"
import type { ProjectFilesStore } from "@/stores/projectFiles"

export { PRESET_FILE_TYPES, type PresetFileType } from "./constant"
export type {
	TopicFileRowDecoration,
	TopicFileRowDecorationContext,
	TopicFileRowDecorationResolver,
} from "./topic-file-row-decoration.types"

export interface TopicFilesButtonProps {
	/** 所属定义工作区；用户挂载文件仍以自己的空间身份为准。 */
	fileHelpContext?: FileHelpContext
	className?: string
	title?: string
	/** 是否显示文件树内部标题。 */
	showTitle?: boolean
	attachments?: AttachmentItem[]
	setUserSelectDetail?: (detail: any) => void
	onFileClick?: (fileItem: any) => void
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
	/** Controls whether this file surface exposes the manual refresh action. */
	showRefresh?: boolean
	resolveTopicFileRowDecoration?: TopicFileRowDecorationResolver
	mobileViewVariant?: "default" | "project-detail" | "chat-sheet"
	refreshAttachments?: () => Promise<void> | void
	onSaveSlidesTemplate?: (item: AttachmentItem) => void | Promise<void>
	onConvertToSlidesTemplate?: (item: AttachmentItem) => void
	headerTrailingAction?: ReactNode
	/** 仅在已连接 Detail 的项目侧栏提供管理器入口。 */
	showFileManager?: boolean
	/** 文件树所属空间及其能力配置。 */
	spaceConfig?: TopicFilesSpaceConfig
	/** 判断节点是否允许参与移动和多选等变更操作。 */
	isItemSelectable?: (item: AttachmentItem) => boolean
	/** 特殊文件空间允许操作的固定根目录。 */
	operationRoot?: AttachmentItem
	projectFilesStore?: ProjectFilesStore
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
			showRefresh,
			resolveTopicFileRowDecoration,
			fileHelpContext,
			mobileViewVariant = "default",
			refreshAttachments,
			onSaveSlidesTemplate,
			onConvertToSlidesTemplate,
			headerTrailingAction,
			showFileManager = false,
			spaceConfig,
			isItemSelectable,
			operationRoot,
			projectFilesStore,
		},
		ref,
	) {
		const { styles, cx } = useStyles()
		const { t } = useTranslation("super")
		const effectiveAllowDownload = allowDownload !== false
		const panelRef = useRef<TopicFilesPanelRef>(null)
		const [saveDialogOpen, setSaveDialogOpen] = useState(false)
		const [saveDialogTemplates, setSaveDialogTemplates] = useState<SlidesTemplateItem[]>([])
		const [saveDialogTarget, setSaveDialogTarget] = useState<SaveSlidesTemplateTarget>("new")
		const [saveDialogLoading, setSaveDialogLoading] = useState(false)
		const [saveDialogSaving, setSaveDialogSaving] = useState(false)
		const [saveDialogNotice, setSaveDialogNotice] = useState("")
		const [saveDialogError, setSaveDialogError] = useState("")
		const [pendingSaveItem, setPendingSaveItem] = useState<AttachmentItem | null>(null)

		const loadSaveDialogTemplates = useCallback(async () => {
			setSaveDialogLoading(true)
			setSaveDialogError("")
			try {
				const result: MySlidesTemplatePage = await mySlidesTemplateAdapter.listMine({
					page: 1,
					pageSize: 100,
				})
				setSaveDialogTemplates(result.items)
			} catch {
				setSaveDialogError(t("mySlidesTemplates.loadFailedDescription"))
			} finally {
				setSaveDialogLoading(false)
			}
		}, [t])

		useEffect(() => {
			if (saveDialogOpen && !saveDialogNotice) void loadSaveDialogTemplates()
		}, [loadSaveDialogTemplates, saveDialogNotice, saveDialogOpen])

		const handleSaveSlidesTemplate = useMemoizedFn(async (item: AttachmentItem) => {
			if (onSaveSlidesTemplate) {
				await onSaveSlidesTemplate(item)
				return
			}
			const resolvedProjectId = selectedProject?.id || projectId
			const folderId = item.file_id
			if (!resolvedProjectId || !folderId) {
				magicToast.error(t("mySlidesTemplates.saveFailed"))
				return
			}

			setPendingSaveItem(item)
			setSaveDialogTarget("new")
			setSaveDialogNotice(
				mySlidesTemplateAdapter.saveEnabled ? "" : t("mySlidesTemplates.saveUnavailable"),
			)
			setSaveDialogError("")
			setSaveDialogOpen(true)
		})

		const saveSelectedTemplate = useCallback(async () => {
			const resolvedProjectId = selectedProject?.id || projectId
			if (!pendingSaveItem || !resolvedProjectId) return
			setSaveDialogSaving(true)
			try {
				const selectedTemplate = saveDialogTemplates.find(
					(template) => template.code === saveDialogTarget,
				)
				const code =
					saveDialogTarget === "new"
						? await createAvailableSlidesTemplateCode()
						: selectedTemplate?.code
				if (!code) throw new Error("Selected slide template code is unavailable")
				await mySlidesTemplateAdapter.saveFromFolder({
					projectId: resolvedProjectId,
					directoryId: pendingSaveItem.file_id || "",
					code,
				})
				setSaveDialogOpen(false)
				magicToast.success(t("mySlidesTemplates.saveSuccess"))
			} catch {
				magicToast.error(t("mySlidesTemplates.saveFailed"))
			} finally {
				setSaveDialogSaving(false)
			}
		}, [
			pendingSaveItem,
			projectId,
			saveDialogTarget,
			saveDialogTemplates,
			selectedProject?.id,
			t,
		])
		const handleConvertToSlidesTemplate = useMemoizedFn((item: AttachmentItem) => {
			if (onConvertToSlidesTemplate) {
				onConvertToSlidesTemplate(item)
				return
			}
			pubsub.publish(PubSubEvents.Create_New_Topic, buildConvertToSlidesTemplatePayload(item))
		})

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
					showTitle={showTitle}
					attachments={attachments}
					setUserSelectDetail={setUserSelectDetail}
					onFileClick={onFileClick}
					projectId={projectId}
					shareCode={shareCode}
					sharePassword={sharePassword}
					onCrossProjectOperationSuccess={onCrossProjectOperationSuccess}
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
					allowDownload={effectiveAllowDownload}
					allowCopyTo={allowCopyTo}
					showRefresh={showRefresh}
					resolveTopicFileRowDecoration={resolveTopicFileRowDecoration}
					fileHelpContext={fileHelpContext}
					mobileViewVariant={mobileViewVariant}
					refreshAttachments={refreshAttachments}
					onSaveSlidesTemplate={handleSaveSlidesTemplate}
					onConvertToSlidesTemplate={handleConvertToSlidesTemplate}
					headerTrailingAction={headerTrailingAction}
					onOpenFileManager={
						showFileManager &&
						projectId &&
						!spaceConfig?.scope &&
						onFileClick &&
						!shareCode
							? () =>
									onFileClick({
										file_manager: {
											spaceType: "project",
											projectId,
											area: "files",
										},
									})
							: undefined
					}
					onOpenRecycleBin={
						showFileManager &&
						projectId &&
						!spaceConfig?.scope &&
						onFileClick &&
						!shareCode
							? () =>
									onFileClick({
										file_manager: {
											spaceType: "project",
											projectId,
											area: "recycle",
										},
									})
							: undefined
					}
					spaceConfig={spaceConfig}
					isItemSelectable={isItemSelectable}
					operationRoot={operationRoot}
					projectFilesStore={projectFilesStore}
				/>
				<SaveSlidesTemplateDialog
					open={saveDialogOpen}
					onOpenChange={setSaveDialogOpen}
					templates={saveDialogTemplates}
					selectedTarget={saveDialogTarget}
					onSelectedTargetChange={setSaveDialogTarget}
					isLoading={saveDialogLoading}
					isSaving={saveDialogSaving}
					notice={saveDialogNotice}
					error={saveDialogError}
					onRetry={() => {
						setSaveDialogNotice("")
						void loadSaveDialogTemplates()
					}}
					onSave={() => void saveSelectedTemplate()}
				/>
			</div>
		)
	},
)

export default TopicFilesButton
