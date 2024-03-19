import { IconMusicUp, IconX } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { InterruptButton } from "@/opensource/pages/superMagic/components/MessageEditor/components"
import { cn } from "@/opensource/lib/utils"
import AudioUploadAction from "@/opensource/components/business/RecordingSummary/AudioUploadAction"
import LoadingIcon from "@/opensource/components/business/RecordingSummary/components/LoadingIcon"
import StartRecordingButton from "@/opensource/components/business/RecordingSummary/components/StartRecordingButton"
import { SummaryGuideDOMId } from "@/opensource/pages/superMagic/components/MessagePanel/components/TopicExamples/SummaryGuide"
import { getButtonPaddingClass } from "@/opensource/pages/superMagic/components/MessageEditor/constants/BUTTON_PADDING_CLASS_MAP"
import { GAP_SIZE_MAP } from "@/opensource/pages/superMagic/components/MessageEditor/constants/constant"
import type { MessageEditorSize } from "@/opensource/pages/superMagic/components/MessageEditor/types"
import type { ReactNode } from "react"

interface IdleStateViewProps {
	size: MessageEditorSize
	isSmall: boolean
	iconSize: number
	selectedProjectId?: string
	isStartingRecord: boolean
	uploading: boolean
	uploadProgress: number
	leftToolbar: ReactNode
	audioSourceSelector: ReactNode
	editorModeSwitch?: ({ disabled }: { disabled: boolean }) => ReactNode
	isTaskRunning: boolean
	onInterrupt?: () => void
	onStartRecording: (mode: "new" | "current") => Promise<void>
	onCancelUpload: () => void
	onUploadFile: (fileList: FileList) => Promise<void>
}

export function IdleStateView({
	size,
	isSmall,
	iconSize,
	selectedProjectId,
	isStartingRecord,
	uploading,
	uploadProgress,
	leftToolbar,
	audioSourceSelector,
	editorModeSwitch,
	isTaskRunning,
	onInterrupt,
	onStartRecording,
	onCancelUpload,
	onUploadFile,
}: IdleStateViewProps) {
	const { t } = useTranslation("super")

	return (
		<div
			className={cn(
				"relative flex min-h-[150px] w-full flex-col items-center justify-end gap-2",
				(size === "small" || size === "mobile") && "items-center gap-2.5",
			)}
			data-testid="recording-editor-initial-state"
		>
			<div
				className="flex w-full flex-1 flex-col items-center justify-center gap-2 rounded-lg bg-accent"
				data-testid="recording-editor-main-content"
			>
				<StartRecordingButton
					isLoading={isStartingRecord}
					disabled={isStartingRecord || uploading}
					allowSelectProject={!selectedProjectId}
					onClick={onStartRecording}
				/>
				<div
					className="text-[10px] leading-[13px] text-[rgba(28,29,35,0.55)]"
					data-testid="recording-editor-warning-text"
				>
					{t("recordingSummary.superEditorPanel.warning.beforeRecording")}
				</div>
			</div>

			<div
				className="flex w-full items-center justify-between gap-1.5"
				data-testid="recording-editor-bottom-controls"
			>
				<div
					className="flex items-center justify-start gap-1.5"
					data-testid="recording-editor-left-controls"
				>
					{!isSmall ? leftToolbar : null}
					{isSmall && audioSourceSelector}
				</div>

				<div
					className="flex w-full items-center justify-end overflow-hidden text-ellipsis whitespace-nowrap"
					style={{
						gap: `${GAP_SIZE_MAP[size]}px`,
					}}
					data-testid="recording-editor-right-controls"
				>
					{!isSmall && (
						<>
							{audioSourceSelector}
							<div className="mx-2 h-4 w-[1px] bg-border" />
						</>
					)}

					{editorModeSwitch?.({
						disabled: uploading || isStartingRecord,
					})}
					{uploading ? (
						<button
							className="flex h-8 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-border bg-background px-[5px] text-xs leading-4 text-[rgba(28,29,35,0.8)] transition-all duration-200 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
							onClick={onCancelUpload}
							style={{
								background: `linear-gradient(to right, rgba(169, 191, 247, 0.15) ${uploadProgress}%, transparent calc(${uploadProgress}% + 0.1%))`,
							}}
							data-testid="recording-editor-cancel-upload-button"
							data-progress={uploadProgress}
						>
							<LoadingIcon size={isSmall ? 16 : 20} />
							{t(
								"recordingSummary.superEditorPanel.button.uploadAudioCancelUploading",
							)}
							<IconX size={isSmall ? 14 : 16} color="currentColor" />
						</button>
					) : (
						<AudioUploadAction
							handler={(onUpload) => (
								<button
									className={cn(
										"flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md bg-secondary p-2 text-xs leading-4 text-[rgba(28,29,35,0.8)] transition-all duration-200 ease-out hover:bg-[rgba(28,29,35,0.05)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
										getButtonPaddingClass(size),
									)}
									disabled={isStartingRecord}
									onClick={onUpload}
									data-testid="recording-editor-upload-audio-button"
									data-disabled={isStartingRecord}
									id={SummaryGuideDOMId.UploadVideoFileButton}
								>
									<MagicIcon
										component={IconMusicUp}
										size={iconSize}
										color="rgba(28, 29, 35, 0.8)"
									/>
								</button>
							)}
							onFileChange={onUploadFile}
						/>
					)}
					<InterruptButton
						visible={isTaskRunning}
						iconSize={iconSize}
						onInterrupt={onInterrupt}
					/>
				</div>
			</div>
		</div>
	)
}
