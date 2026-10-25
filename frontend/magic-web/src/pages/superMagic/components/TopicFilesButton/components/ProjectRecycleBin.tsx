import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { RecycleBinContent } from "@/pages/recycleBin/components/RecycleBinContent"
import { getFileReferenceIdentityKey } from "../../../services/userFileReferenceResolver"
import { requestProjectAttachmentsFullRefresh } from "../../../services/attachmentsTopicSync"
import type { ProjectFileManagerProps } from "./ProjectFileManager"

type ProjectRecycleBinProps = Pick<
	ProjectFileManagerProps,
	"projectId" | "onPreviewFile" | "onPreviewRemoved"
>

/** 标签只适配项目身份和原附件刷新入口；恢复、搜索及只读预览仍由回收站负责。 */
export default observer(function ProjectRecycleBin(props: ProjectRecycleBinProps) {
	const { t } = useTranslation("super")
	const identityKey = getFileReferenceIdentityKey() ?? ""
	return (
		<div className="flex h-full min-h-0 flex-col gap-3 bg-background p-4 text-foreground">
			<p className="text-xs text-muted-foreground">{t("recycleBin.project.scope")}</p>
			<RecycleBinContent
				key={`${identityKey}:project:${props.projectId}`}
				projectId={props.projectId}
				activeTab={{ id: "files", count: 0 }}
				requireDeleteConfirmation
				onPreview={props.onPreviewFile}
				onPreviewRemoved={props.onPreviewRemoved}
				onMutationComplete={() =>
					requestProjectAttachmentsFullRefresh({ projectId: props.projectId })
				}
			/>
		</div>
	)
})
