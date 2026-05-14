import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Sheet, SheetContent } from "@/components/shadcn-ui/sheet"
import PreviewDetailPopup, {
	type PreviewDetailPopupRef,
} from "@/pages/superMagicMobile/components/PreviewDetailPopup"
import TopicFilesButton, {
	type TopicFilesButtonRef,
} from "@/pages/superMagic/components/TopicFilesButton"
import { useFileOpen } from "@/pages/superMagic/components/TopicFilesButton/hooks/useFileOpen"
import projectFilesStore from "@/stores/projectFiles"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import { isReadOnlyProject } from "@/pages/superMagic/utils/permission"

/**
 * 当前 chat detail 的“查看文件”入口已切换为 TopicFilesPopup，
 * 本 Drawer 仅作为旧实现保留，不再被现行移动端对话详情页使用；待重构稳定后统一删除。
 */
interface ChatFilesDrawerProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

function ChatFilesDrawerComponent({ open, onOpenChange }: ChatFilesDrawerProps) {
	const { t } = useTranslation("super")
	const selectedProject = projectStore.selectedProject
	const selectedTopic = topicStore.selectedTopic
	const selectedWorkspace = workspaceStore.selectedWorkspace
	const attachments = projectFilesStore.workspaceFileTree
	const attachmentList = projectFilesStore.workspaceFilesList
	const isReadonly = isReadOnlyProject(selectedProject?.user_role)

	const topicFilesButtonRef = useRef<TopicFilesButtonRef>(null)
	const previewDetailPopupRef = useRef<PreviewDetailPopupRef>(null)
	const linkPreviewPopupRef = useRef<PreviewDetailPopupRef>(null)
	const [activeFileId, setActiveFileId] = useState<string | null>(null)

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

	const handlePreviewFile = useMemoizedFn((fileId: string) => {
		const targetFile = attachmentList.find((item) => item.file_id === fileId)
		if (!targetFile) return

		handleOpenFile(targetFile)
	})

	const handleFileClick = useMemoizedFn((fileItem?: { file_id?: string }) => {
		const fileId = fileItem?.file_id
		if (!fileId) return

		setActiveFileId(fileId)
		setTimeout(() => {
			handlePreviewFile(fileId)
		}, 100)
	})

	return (
		<>
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent
					side="right"
					showClose={false}
					className="z-drawer w-[calc(100vw-40px)] max-w-sm gap-0 px-0 pt-safe-top"
					overlayClassName="z-drawer backdrop-blur-sm"
					data-testid="chat-project-files-drawer-content"
				>
					<div
						className="flex min-h-0 flex-1 flex-col px-2 pb-safe-bottom"
						data-testid="chat-project-files-drawer-root"
					>
						<TopicFilesButton
							ref={topicFilesButtonRef}
							className="h-full"
							title={t("topicFiles.title")}
							attachments={attachments}
							setUserSelectDetail={setUserSelectDetail}
							onFileClick={handleFileClick}
							projectId={selectedProject?.id}
							activeFileId={activeFileId}
							selectedTopic={selectedTopic}
							allowEdit={!isReadonly}
							selectedWorkspace={selectedWorkspace}
							selectedProject={selectedProject}
							projects={projectStore.projects}
							workspaces={workspaceStore.workspaces}
							isInProject
							showMobileActions
						/>
					</div>
				</SheetContent>
			</Sheet>
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
					// Close link popup without any action
				}}
			/>
		</>
	)
}

export const ChatFilesDrawer = observer(ChatFilesDrawerComponent)
