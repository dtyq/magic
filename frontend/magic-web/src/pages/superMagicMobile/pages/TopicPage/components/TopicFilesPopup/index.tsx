import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import PreviewDetailPopup, {
	type PreviewDetailPopupRef,
} from "@/pages/superMagicMobile/components/PreviewDetailPopup"
import TopicFilesButton from "@/pages/superMagic/components/TopicFilesButton"
import { useFileOpen } from "@/pages/superMagic/components/TopicFilesButton/hooks/useFileOpen"
import type { ProjectListItem, Topic, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { isReadOnlyProject } from "@/pages/superMagic/utils/permission"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"

interface TopicFilesPopupProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	attachments: AttachmentItem[]
	attachmentList: AttachmentItem[]
	selectedProject: ProjectListItem | null
	selectedTopic: Topic | null
	selectedWorkspace: Workspace | null
	projects: ProjectListItem[]
	workspaces: Workspace[]
	projectId?: string
	refreshAttachments?: () => Promise<void> | void
}

/**
 * 话题页独立文件弹层：复用项目详情的移动端文件列表与预览链路，但通过 MagicPopup 承载为临时查看入口。
 */
function TopicFilesPopupComponent({
	open,
	onOpenChange,
	attachments,
	attachmentList,
	selectedProject,
	selectedTopic,
	selectedWorkspace,
	projects,
	workspaces,
	projectId,
	refreshAttachments,
}: TopicFilesPopupProps) {
	const { t } = useTranslation("super")
	const previewDetailPopupRef = useRef<PreviewDetailPopupRef>(null)
	const linkPreviewPopupRef = useRef<PreviewDetailPopupRef>(null)
	const wasOpenRef = useRef(false)
	const [activeFileId, setActiveFileId] = useState<string | null>(null)
	const isReadonly = isReadOnlyProject(selectedProject?.user_role)
	const popupTitle = t("projectDetail.tabFiles")
	const popupSubtitle =
		selectedTopic?.topic_name?.trim() || selectedProject?.project_name?.trim() || ""

	useEffect(() => {
		const didOpen = open && !wasOpenRef.current
		wasOpenRef.current = open

		if (!didOpen) return

		// 只在弹层从关闭切到打开时回源刷新，避免父层重渲染时因回调引用变化重复拉取。
		void refreshAttachments?.()
	}, [open, refreshAttachments])

	/**
	 * 文件查看统一走现有预览弹层，避免在文件入口里再维护一套文件详情状态。
	 */
	const setUserSelectDetail = useMemoizedFn(
		(detail: Parameters<PreviewDetailPopupRef["open"]>[0] | null) => {
			if (!detail) return
			previewDetailPopupRef.current?.open(detail, attachments, attachmentList)
		},
	)

	const { handleOpenFile } = useFileOpen({
		setUserSelectDetail: (detail) => {
			previewDetailPopupRef.current?.open(detail, attachments, attachmentList)
		},
		attachments,
	})

	/**
	 * 列表点击后先同步激活文件，再沿用 TopicFilesButton 的打开能力进入预览。
	 */
	const handleFileClick = useMemoizedFn((fileItem?: { file_id?: string }) => {
		const fileId = fileItem?.file_id
		if (!fileId) return

		const targetFile = attachmentList.find((item) => item.file_id === fileId)
		if (!targetFile) return

		setActiveFileId(fileId)
		setTimeout(() => {
			handleOpenFile(targetFile)
		}, 100)
	})

	return (
		<>
			<MagicPopup
				visible={open}
				onClose={() => onOpenChange(false)}
				position="bottom"
				title={popupTitle}
				headerVariant="actionHeader"
				headerTitle={popupTitle}
				headerSubtitle={popupSubtitle}
				headerLeadingAction={{
					icon: <X />,
					ariaLabel: t("common.close"),
					onClick: () => onOpenChange(false),
					testId: "topic-page-files-popup-close-button",
				}}
				className="rounded-t-[24px] border-0 bg-mobile-background"
				bodyClassName="flex h-[90dvh] max-h-[calc(100dvh-8px)] flex-col overflow-hidden"
			>
				<div
					className="flex h-full min-h-0 flex-col bg-mobile-background"
					data-testid="topic-page-files-popup-root"
				>
					{/* 文件树区域必须使用 flex-1/min-h-0，避免头部把底部搜索栏和添加按钮挤出可视区。 */}
					<TopicFilesButton
						className="min-h-0 flex-1"
						title={popupTitle}
						mobileViewVariant="chat-sheet"
						attachments={attachments}
						setUserSelectDetail={setUserSelectDetail}
						onFileClick={handleFileClick}
						projectId={projectId}
						activeFileId={activeFileId}
						selectedTopic={selectedTopic}
						allowEdit={!isReadonly}
						selectedWorkspace={selectedWorkspace}
						selectedProject={selectedProject}
						projects={projects}
						workspaces={workspaces}
						isInProject
						showMobileActions
						refreshAttachments={refreshAttachments}
					/>
				</div>
			</MagicPopup>
			<PreviewDetailPopup
				selectedTopic={selectedTopic}
				selectedProject={selectedProject}
				ref={previewDetailPopupRef}
				setUserSelectDetail={setUserSelectDetail}
				onClose={() => {
					setUserSelectDetail(null)
				}}
				onOpenNewPopup={(detail, attachmentTree, nextAttachmentList) => {
					linkPreviewPopupRef.current?.open(detail, attachmentTree, nextAttachmentList)
				}}
			/>
			<PreviewDetailPopup
				selectedTopic={selectedTopic}
				selectedProject={selectedProject}
				ref={linkPreviewPopupRef}
				setUserSelectDetail={setUserSelectDetail}
				onClose={() => {
					// 关闭链接预览时不需要回写文件弹层状态。
				}}
			/>
		</>
	)
}

export const TopicFilesPopup = observer(TopicFilesPopupComponent)
