import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useEffect, useRef, useState } from "react"

import workspaceStore from "@/pages/superMagic/stores/core/workspace"
import ProjectResourceSelectorModal from "@/pages/superMagic/components/SelectPathModal/components/ProjectResourceSelectorModal"
import type { ProjectResourceSelection } from "@/pages/superMagic/components/SelectPathModal/types"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import { SuperMagicApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"

interface OtherProjectFileMentionModalProps {
	visible: boolean
	currentProject?: ProjectListItem | null
	onClose: () => void
	onSelect: (selections: ProjectResourceSelection[]) => void
}

/**
 * Mention-specific adapter for the shared workspace/project/file selector.
 * It disables creation and destination constraints through `selectionMode="mention"`, while
 * keeping the same data source, breadcrumb and responsive modal UI as file operations.
 */
function OtherProjectFileMentionModal({
	visible,
	currentProject,
	onClose,
	onSelect,
}: OtherProjectFileMentionModalProps) {
	const { t } = useTranslation("super")
	const requestId = useRef(0)
	const pending = useRef(false)
	const [submitting, setSubmitting] = useState(false)
	const cancel = () => {
		requestId.current += 1
		pending.current = false
		setSubmitting(false)
		onClose()
	}
	useEffect(() => {
		pending.current = false
		setSubmitting(false)
		return () => {
			requestId.current += 1
		}
	}, [visible])

	return (
		<ProjectResourceSelectorModal
			visible={visible}
			title={t("selectPathModal.mentionOtherProjectFiles")}
			operationType="copy"
			selectionMode="mention"
			submitting={submitting}
			workspaces={workspaceStore.workspaces}
			fileIds={[]}
			sourceAttachments={[]}
			includeFixedWorkspaces
			closeOnSubmit={false}
			excludeProjectIds={currentProject?.id ? [currentProject.id] : []}
			emptyDirectoryDescription={t("selectPathModal.mentionEmptyProject")}
			emptyDirectoryActionLabel={null}
			onClose={cancel}
			onSubmit={async (data) => {
				const selections = data.selections || (data.selection ? [data.selection] : [])
				if (selections.length === 0) return
				if (pending.current || !visible) return
				pending.current = true
				setSubmitting(true)
				const currentRequestId = ++requestId.current
				try {
					const projectsById = new Map<string, ProjectListItem>()
					await Promise.all(
						Array.from(
							new Map(
								selections.map((selection) => [
									selection.project.id,
									selection.project,
								]),
							).values(),
						).map(async (project) => {
							const resolvedProject = project.work_dir
								? project
								: await SuperMagicApi.getProjectDetail({ id: project.id })
							projectsById.set(project.id, resolvedProject)
						}),
					)

					// 关闭或重新打开后，旧请求不能向编辑器插入引用。
					if (currentRequestId !== requestId.current) return
					onSelect(
						selections.map((selection) => ({
							...selection,
							project: projectsById.get(selection.project.id) || selection.project,
						})),
					)
				} catch (error) {
					if (currentRequestId !== requestId.current) return
					console.error("Failed to resolve mentioned project:", error)
					magicToast.error(t("selectPathModal.fetchProjectsFailed"))
				} finally {
					if (currentRequestId === requestId.current) {
						pending.current = false
						setSubmitting(false)
					}
				}
			}}
		/>
	)
}

export default observer(OtherProjectFileMentionModal)
