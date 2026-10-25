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
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"

interface RecordingDetailSpeakerDialogProps {
	open: boolean
	speakerIds: string[]
	value: Record<string, string>
	onValueChange: (next: Record<string, string>) => void
	onOpenChange: (open: boolean) => void
	onConfirm: () => void
}

/** Desktop dialog for editing speaker display names persisted to magic.project.js. */
export function RecordingDetailSpeakerDialog({
	open,
	speakerIds,
	value,
	onValueChange,
	onOpenChange,
	onConfirm,
}: RecordingDetailSpeakerDialogProps) {
	const { t } = useTranslation("audioRecordings")

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-md"
				data-testid="recording-detail-speaker-dialog"
				onOpenAutoFocus={(event) => {
					// Keep the desktop trigger focused while preserving Radix's normal focus restoration.
					event.preventDefault()
				}}
			>
				<DialogHeader>
					<DialogTitle>{t("detail.speakerSettingsTitle")}</DialogTitle>
				</DialogHeader>
				<p className="text-sm text-muted-foreground">{t("detail.speakerSettingsHint")}</p>
				{/* Keep short lists content-sized and leave room around focused input rings. */}
				<ScrollArea
					className="-mx-1"
					viewportClassName="h-auto max-h-[50vh] px-1 py-2 [&>div]:!flex [&>div]:flex-col [&>div]:gap-3"
				>
					{speakerIds.map((speakerId, index) => (
						<div key={speakerId} className="space-y-1.5">
							<label className="text-sm text-muted-foreground">
								{t("detail.speakerLabel", { label: buildSpeakerAlphaLabel(index) })}
							</label>
							<Input
								value={value[speakerId] ?? speakerId}
								onChange={(event) =>
									onValueChange({ ...value, [speakerId]: event.target.value })
								}
								placeholder={speakerId}
							/>
						</div>
					))}
				</ScrollArea>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						{t("detail.speakerSettingsCancel")}
					</Button>
					<Button onClick={onConfirm}>{t("detail.speakerSettingsSave")}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

function buildSpeakerAlphaLabel(index: number) {
	return String.fromCharCode("A".charCodeAt(0) + index)
}
