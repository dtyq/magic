import { useTranslation } from "react-i18next"

import TopicFilesButton from "@/pages/superMagic/components/TopicFilesButton"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import { canEditProject } from "@/pages/superMagic/utils/permission"

interface PublishedMicroAppAttachmentsPanelProps {
	attachments: AttachmentItem[]
	projectId?: string
	selectedProject?: ProjectListItem | null
	selectedTopic?: Topic | null
	setUserSelectDetail: (detail: unknown) => void
	onFileClick?: (fileItem: unknown) => void
}

export default function PublishedMicroAppAttachmentsPanel({
	attachments,
	projectId,
	selectedProject,
	selectedTopic,
	setUserSelectDetail,
	onFileClick,
}: PublishedMicroAppAttachmentsPanelProps) {
	const { t } = useTranslation("super")
	const canEdit = canEditProject(selectedProject?.user_role)

	return (
		<div
			className="flex h-full min-h-0 flex-col pt-1"
			data-testid="published-micro-app-attachments-panel"
		>
			<TopicFilesButton
				attachments={attachments}
				projectId={projectId}
				selectedProject={selectedProject}
				selectedTopic={selectedTopic}
				title={t("attachmentList.projectFiles")}
				allowEdit={canEdit}
				showRefresh
				showFileManager
				onFileClick={onFileClick}
				setUserSelectDetail={setUserSelectDetail}
			/>
		</div>
	)
}
