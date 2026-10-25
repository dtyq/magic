import { useRef } from "react"
import { Mic, Settings, Upload } from "lucide-react"
import { useTranslation } from "react-i18next"
import AudioUploadAction from "@/components/business/RecordingSummary/AudioUploadAction"
import { Button } from "@/components/shadcn-ui/button"
import { HomeOnboardingAnchor } from "@/pages/superMagic/components/LazyGuideTour/GuideTourManager"

interface AudioRecordingsPrimaryActionsProps {
	onOpenSettings: () => void
	onImportFiles?: (files: FileList) => void
	onStartRecording?: () => void
	isStartingRecording?: boolean
}

/** Desktop-only action cluster that keeps recording primary while exposing import as a peer action. */
export function AudioRecordingsPrimaryActions({
	onOpenSettings,
	onImportFiles,
	onStartRecording,
	isStartingRecording = false,
}: AudioRecordingsPrimaryActionsProps) {
	const { t } = useTranslation("audioRecordings")
	const openFilePickerRef = useRef<() => void>(() => undefined)

	return (
		<div
			className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end"
			data-testid="audio-recordings-primary-actions"
		>
			{onImportFiles ? (
				<AudioUploadAction
					// Keep the hidden input mounted at the action-cluster level so file selection survives UI changes.
					handler={(onUpload) => {
						openFilePickerRef.current = onUpload
						return null
					}}
					onFileChange={onImportFiles}
				/>
			) : null}

			{/* Keep recording visually dominant because it is the default creation path. */}
			<Button
				type="button"
				size="sm"
				className="h-9 px-3.5"
				disabled={isStartingRecording || !onStartRecording}
				onClick={onStartRecording}
				data-testid="audio-recordings-start-recording-button"
				// The "了解 AI 录音完成流程" tour opens on this entry and then on the import one, so
				// both are addressed by the tour's own anchors rather than by their test ids.
				data-guide-anchor={HomeOnboardingAnchor.AudioRecordingsStart}
			>
				<Mic className="size-4" aria-hidden />
				<span>{t("actions.startRecording")}</span>
			</Button>

			{onImportFiles ? (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-9 shrink-0 gap-1.5 rounded-lg bg-background px-3 shadow-xs"
					onClick={() => openFilePickerRef.current()}
					data-testid="audio-recordings-import-audio-button"
					data-guide-anchor={HomeOnboardingAnchor.AudioRecordingsImport}
				>
					<Upload className="size-4" aria-hidden />
					<span>{t("card.sourceImported")}</span>
				</Button>
			) : null}

			{/* Reuse the settings dialog title so the entry and modal stay semantically aligned. */}
			<Button
				type="button"
				variant="outline"
				onClick={onOpenSettings}
				className="h-9 shrink-0 gap-1.5 rounded-lg bg-background px-3 shadow-xs"
				aria-label={t("super:mobile.recordingEntry.settings.title")}
				data-testid="audio-recordings-settings-button"
			>
				<Settings className="size-4" aria-hidden />
				<span>{t("super:mobile.recordingEntry.settings.title")}</span>
			</Button>
		</div>
	)
}

export default AudioRecordingsPrimaryActions
