import { AlertCircle, Check, Loader2, Save } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import type { SaveState } from "./SpeakerNotesEditor"

const BASE_CLASS = "h-6 gap-1.5 rounded-md px-2 text-xs font-normal"

/** One slot for save action and save feedback, so the toolbar height never changes. */
export default function NotesSaveControl({
	saveState,
	dirty,
	onSave,
}: {
	saveState: SaveState
	dirty: boolean
	onSave: () => void
}) {
	const { t } = useTranslation("super")

	if (saveState === "saving") {
		return (
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled
				data-testid="ppt-notes-save-status"
				className={BASE_CLASS}
			>
				<Loader2 className="size-4 animate-spin" />
				{t("ppt.speakerNotes.saving")}
			</Button>
		)
	}

	if (dirty) {
		return (
			<>
				{saveState === "error" && (
					<span
						role="alert"
						data-testid="ppt-notes-save-status"
						className={cn(BASE_CLASS, "inline-flex items-center text-destructive")}
					>
						<AlertCircle className="size-4" />
						{t("ppt.speakerNotes.saveFailed")}
					</span>
				)}
				<Button
					type="button"
					variant="outline"
					size="sm"
					className={BASE_CLASS}
					onClick={onSave}
				>
					<Save className="size-4" />
					{t("ppt.speakerNotes.save")}
				</Button>
			</>
		)
	}

	if (saveState === "saved") {
		return (
			<span
				role="status"
				aria-live="polite"
				data-testid="ppt-notes-save-status"
				className={cn(BASE_CLASS, "inline-flex items-center text-muted-foreground")}
			>
				<Check className="size-4" />
				{t("ppt.speakerNotes.saved")}
			</span>
		)
	}

	return null
}
