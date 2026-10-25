import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { getFileReferenceIdentityKey } from "../../../services/userFileReferenceResolver"
import type { ProjectListItem, Topic } from "../../../pages/Workspace/types"
import type { AttachmentItem } from "../hooks/types"
import { FileManager } from "./FileManager/FileManager"
import { requestProjectAttachmentsFullRefresh } from "../../../services/attachmentsTopicSync"
import type { AttachmentLoadState } from "@/stores/projectFiles/types"
import type { ProjectFileManagerSnapshot } from "@/models/config/repositories/SuperProjectStateTypes"
import type { FileManagerStateChangeOptions } from "../../Detail/components/FilesViewer/types"
import type { ProjectFilesStore } from "@/stores/projectFiles"

export interface ProjectFileManagerProps {
	onOpenRecycle?: () => void
	projectId: string
	initialDirectoryId?: string
	attachments: AttachmentItem[]
	selectedProject?: ProjectListItem | null
	selectedTopic?: Topic | null
	allowEdit?: boolean
	allowDownload?: boolean
	loading?: boolean
	attachmentLoadState?: AttachmentLoadState
	initialState?: ProjectFileManagerSnapshot
	onStateChange?: (
		state: ProjectFileManagerSnapshot,
		options: FileManagerStateChangeOptions,
	) => void
	isActive?: boolean
	onFileClick: (file: AttachmentItem) => void
	projectFilesStore?: ProjectFilesStore
}

/** 项目入口只适配身份与附件；管理器在项目及用户切换时重新建立交互状态。 */
export default observer(function ProjectFileManager({
	isActive = true,
	allowEdit = false,
	allowDownload = true,
	...props
}: ProjectFileManagerProps) {
	const { t } = useTranslation("super")
	const identityKey = getFileReferenceIdentityKey() ?? ""
	const scopeKey = `${identityKey}:project:${props.projectId}`
	return (
		<FileManager
			key={scopeKey}
			{...props}
			initialState={props.initialState?.location}
			onStateChange={(location, options = {}) =>
				props.onStateChange?.(
					{ spaceType: "project", identityKey, projectId: props.projectId, location },
					options,
				)
			}
			dataReady={
				props.attachmentLoadState?.projectId === props.projectId &&
				props.attachmentLoadState.status === "ready"
			}
			error={
				props.attachmentLoadState?.projectId === props.projectId &&
				props.attachmentLoadState.status === "error"
			}
			scopeKey={scopeKey}
			identityKey={identityKey}
			rootId=""
			rootName={props.selectedProject?.project_name ?? t("topicFiles.title")}
			context={{ kind: "project", projectId: props.projectId }}
			isActive={isActive}
			allowEdit={allowEdit}
			allowDownload={allowDownload}
			onOpen={props.onFileClick}
			onRefresh={() => requestProjectAttachmentsFullRefresh({ projectId: props.projectId })}
		/>
	)
})
