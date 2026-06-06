import DeleteDangerModal from "@/components/business/DeleteDangerModal"
import { useTranslation } from "react-i18next"

interface AudioRecordingDeleteDialogProps {
	projectIds: string[] | null
	onClose: () => void
	onConfirm: (projectIds: string[]) => void | Promise<void>
}

/** Renders delete confirmation for single or batch audio recording removal */
export function AudioRecordingDeleteDialog({
	projectIds,
	onClose,
	onConfirm,
}: AudioRecordingDeleteDialogProps) {
	const { t } = useTranslation("audioRecordings")

	if (!projectIds?.length) return null

	const isBatchDelete = projectIds.length > 1
	const confirmContent = isBatchDelete
		? t("actions.deleteConfirmBatch", { count: projectIds.length })
		: t("actions.deleteConfirmSingle")

	return (
		<DeleteDangerModal
			title={t("actions.deleteTitle")}
			content={confirmContent}
			showDeleteText={false}
			onSubmit={() => onConfirm(projectIds)}
			onClose={onClose}
		/>
	)
}
