import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"

import ProjectResourceSelectorModal from "../ProjectResourceSelectorModal"
import type {
	ImportFromOtherProjectModalProps,
	ProjectResourceSelection,
	ProjectResourceSelectorSubmitData,
} from "../../types"

/**
 * 导入只负责把共享选择器的资源选择结果转换成旧复制流程需要的分组数据。
 * 冲突检查、批量复制、进度展示和取消仍由 useImportFromOtherProject 负责。
 */
export default function ImportFromOtherProjectModal({
	visible,
	workspaces,
	currentProjectId,
	onClose,
	onSubmit,
}: ImportFromOtherProjectModalProps) {
	const { t } = useTranslation("super")
	const handleSubmit = useMemoizedFn((data: ProjectResourceSelectorSubmitData) => {
		const selections = (data.selections ?? (data.selection ? [data.selection] : [])).filter(
			(selection): selection is Extract<ProjectResourceSelection, { level: "attachment" }> =>
				selection.level === "attachment",
		)
		const filesByProject = new Map<
			string,
			{
				sourceProjectId: string
				selectedFileIds: string[]
				selectedFiles: Extract<
					ProjectResourceSelection,
					{ level: "attachment" }
				>["attachment"][]
			}
		>()

		for (const selection of selections) {
			const group = filesByProject.get(selection.project.id) ?? {
				sourceProjectId: selection.project.id,
				selectedFileIds: [],
				selectedFiles: [],
			}
			const fileId = selection.attachment.file_id
			if (fileId && !group.selectedFileIds.includes(fileId)) {
				group.selectedFileIds.push(fileId)
				group.selectedFiles.push(selection.attachment)
			}
			filesByProject.set(selection.project.id, group)
		}

		if (filesByProject.size > 0) {
			onSubmit({ filesByProject: Array.from(filesByProject.values()) })
		}
	})

	return (
		<ProjectResourceSelectorModal
			visible={visible}
			title={t("topicFiles.contextMenu.importFromOtherProject")}
			operationType="copy"
			selectionMode="import"
			selectedWorkspace={undefined}
			selectedProject={undefined}
			workspaces={workspaces}
			fileIds={[]}
			sourceAttachments={[]}
			includeFixedWorkspaces
			excludeProjectIds={[currentProjectId]}
			emptyDirectoryActionLabel={null}
			onClose={onClose}
			onSubmit={handleSubmit}
		/>
	)
}
