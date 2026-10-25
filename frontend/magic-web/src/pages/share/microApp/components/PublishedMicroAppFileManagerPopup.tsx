import { lazy, Suspense, useState } from "react"
import { useTranslation } from "react-i18next"

import MagicModal from "@/components/base/MagicModal"
import { cn } from "@/utils/cn"
import type { FileManagerContext } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import type { AttachmentLoadState } from "@/stores/projectFiles/types"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import type { UserFileManagerSnapshot } from "@/models/config/repositories/SuperProjectStateTypes"
import { canEditProject } from "@/pages/superMagic/utils/permission"
import {
	PREVIEW_MODAL_BODY_CLASSNAME,
	PREVIEW_MODAL_BODY_WRAPPER_CLASSNAME,
	PREVIEW_MODAL_CLASSNAME,
} from "@/pages/superMagicMobile/components/PreviewDetailPopup/layoutClassNames"
import { resolvePublishedRuntimeProjectName } from "../utils/resolvePublishedRuntimeProjectName"

const ProjectFileManager = lazy(
	() => import("@/pages/superMagic/components/TopicFilesButton/components/ProjectFileManager"),
)
const UserSpaceFileManager = lazy(
	() => import("@/pages/superMagic/components/UserSpace/UserSpaceFileManager"),
)

interface PublishedMicroAppFileManagerPopupProps {
	context: FileManagerContext
	attachments: AttachmentItem[]
	attachmentLoadState?: AttachmentLoadState
	selectedProject?: ProjectListItem | null
	selectedTopic?: Topic | null
	onOpenFile: (file: AttachmentItem) => void
	onClose: () => void
}

export default function PublishedMicroAppFileManagerPopup({
	context,
	attachments,
	attachmentLoadState,
	selectedProject,
	selectedTopic,
	onOpenFile,
	onClose,
}: PublishedMicroAppFileManagerPopupProps) {
	const { t } = useTranslation("super")
	const [userManagerState, setUserManagerState] = useState<UserFileManagerSnapshot>()
	const projectName =
		resolvePublishedRuntimeProjectName(selectedProject?.project_name) ??
		t("microAppPage.defaultProjectName")
	const project = selectedProject
		? { ...selectedProject, project_name: projectName }
		: selectedProject
	const canEdit = canEditProject(selectedProject?.user_role)

	return (
		<MagicModal
			open
			maskClosable
			footer={null}
			centered
			title={t("microAppPage.fileManagerDialog.title")}
			onCancel={onClose}
			className={PREVIEW_MODAL_CLASSNAME}
			classNames={{ body: PREVIEW_MODAL_BODY_CLASSNAME }}
		>
			<div
				className={cn(PREVIEW_MODAL_BODY_WRAPPER_CLASSNAME, "min-h-0")}
				data-testid="published-micro-app-file-manager-content"
			>
				<Suspense fallback={null}>
					{context.spaceType === "user" ? (
						<UserSpaceFileManager
							context={context}
							onFileClick={onOpenFile}
							projectId={selectedProject?.id}
							projectName={projectName}
							topicId={selectedTopic?.id}
							initialState={userManagerState}
							onStateChange={setUserManagerState}
						/>
					) : (
						<ProjectFileManager
							projectId={context.projectId}
							initialDirectoryId={context.directoryId}
							attachments={attachments}
							attachmentLoadState={attachmentLoadState}
							selectedProject={project}
							selectedTopic={selectedTopic}
							allowEdit={canEdit}
							onFileClick={onOpenFile}
						/>
					)}
				</Suspense>
			</div>
		</MagicModal>
	)
}
