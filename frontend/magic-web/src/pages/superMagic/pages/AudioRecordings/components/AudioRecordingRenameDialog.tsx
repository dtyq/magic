import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Input } from "@/components/shadcn-ui/input"
import type { AudioProjectListItem } from "@/types/audioProject"
import { resolveRecordingDisplayName } from "../utils/audio-recordings-utils"

interface AudioRecordingRenameDialogProps {
	open: boolean
	item: AudioProjectListItem | null
	isSubmitting?: boolean
	onOpenChange: (open: boolean) => void
	onConfirm: (projectId: string, name: string) => void | Promise<void>
}

/** Modal for renaming an audio recording project, aligned with workspace rename dialog UX */
export function AudioRecordingRenameDialog({
	open,
	item,
	isSubmitting = false,
	onOpenChange,
	onConfirm,
}: AudioRecordingRenameDialogProps) {
	const { t } = useTranslation("audioRecordings")
	const [nameInput, setNameInput] = useState("")

	useEffect(() => {
		if (!open || !item) return
		setNameInput(resolveRecordingDisplayName(item.project_name, item.created_at))
	}, [open, item])

	async function handleConfirm() {
		if (!item) return
		const trimmed = nameInput.trim()
		if (!trimmed) return
		await onConfirm(item.id, trimmed)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-[425px]"
				data-testid="audio-recording-rename-dialog"
				onCloseAutoFocus={(event) => {
					event.preventDefault()
				}}
			>
				<DialogHeader>
					<DialogTitle>{t("actions.renameTitle")}</DialogTitle>
				</DialogHeader>
				<div>
					<Input
						autoFocus
						maxLength={100}
						value={nameInput}
						placeholder={t("actions.renamePlaceholder")}
						onChange={(event) => setNameInput(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") void handleConfirm()
						}}
						data-testid="audio-recording-rename-input"
					/>
				</div>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSubmitting}
						data-testid="audio-recording-rename-cancel"
					>
						{t("actions.cancel")}
					</Button>
					<Button
						onClick={() => void handleConfirm()}
						disabled={isSubmitting || !nameInput.trim()}
						data-testid="audio-recording-rename-confirm"
					>
						{isSubmitting ? t("actions.submitting") : t("actions.confirm")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
