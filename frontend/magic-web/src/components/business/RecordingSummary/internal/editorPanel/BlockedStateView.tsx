import { Tooltip } from "antd"
import { IconMusicUp } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import MagicIcon from "@/components/base/MagicIcon"
import { InterruptButton } from "@/pages/superMagic/components/MessageEditor/components"
import { cn } from "@/lib/utils"
import AudioUploadAction from "@/components/business/RecordingSummary/AudioUploadAction"
import IconMicRecording from "@/enhance/tabler/icons-react/icons/IconMicRecording"
import LoadingIcon from "@/components/business/RecordingSummary/components/LoadingIcon"
import RecordingIndicator from "@/components/business/RecordingSummary/components/RecordingIndicator"
import type { MessageEditorSize } from "@/pages/superMagic/components/MessageEditor/types"
import type { ReactNode } from "react"

interface BlockedStateViewProps {
	size: MessageEditorSize
	isSmall: boolean
	uploading: boolean
	uploadProgress: number
	isMediaRecorderNotSupported: boolean
	isOtherTabRecording: boolean
	isRecording: boolean
	isPaused: boolean
	isCurrentRecording: boolean
	leftToolbar: ReactNode
	editorModeSwitch?: ({ disabled }: { disabled: boolean }) => ReactNode
	isTaskRunning: boolean
	iconSize: number
	onInterrupt?: () => void
	onCancelUpload: () => void
	onUploadFile: (fileList: FileList) => Promise<void>
	onOpenCurrentRecording: () => void
}

export function BlockedStateView({
	size,
	isSmall,
	uploading,
	uploadProgress,
	isMediaRecorderNotSupported,
	isOtherTabRecording,
	isRecording,
	isPaused,
	isCurrentRecording,
	leftToolbar,
	editorModeSwitch,
	isTaskRunning,
	iconSize,
	onInterrupt,
	onCancelUpload,
	onUploadFile,
	onOpenCurrentRecording,
}: BlockedStateViewProps) {
	const { t } = useTranslation("super")
	const recordingWarningText = isOtherTabRecording
		? t("recordingSummary.superEditorPanel.warning.recordingInProgressOtherTab")
		: t("recordingSummary.superEditorPanel.warning.recordingInProgress")

	return (
		<div
			className={cn(
				"relative flex min-h-[156px] w-full flex-col items-center justify-end p-2",
				(size === "small" || size === "mobile") && "items-center gap-2.5",
			)}
		>
			<div
				className={cn(
					"flex flex-1 flex-col items-center gap-2.5",
					size === "default" ? "justify-end" : "justify-center",
				)}
			>
				{uploading ? (
					<button
						className="flex cursor-pointer items-center gap-1 rounded-[1000px] border-none bg-gradient-to-r from-[#443855] to-[#000] px-5 py-2.5 text-sm font-semibold leading-5 text-white transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] active:scale-[0.98]"
						onClick={onCancelUpload}
					>
						<LoadingIcon size={24} color="white" />
						<span style={{ margin: "0 4px" }}>
							{Number(uploadProgress).toFixed(1)}%
						</span>
						{t("recordingSummary.superEditorPanel.button.uploadAudioCancel")}
					</button>
				) : (
					<AudioUploadAction
						handler={(onUpload) => (
							<button
								className="flex cursor-pointer items-center gap-1 rounded-[1000px] border-none bg-gradient-to-r from-[#443855] to-[#000] px-5 py-2.5 text-sm font-semibold leading-5 text-white transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] active:scale-[0.98]"
								onClick={onUpload}
							>
								<MagicIcon component={IconMusicUp} size={24} color="white" />
								{t("recordingSummary.superEditorPanel.button.uploadAudioSimple")}
							</button>
						)}
						onFileChange={onUploadFile}
					/>
				)}
				<div className="text-[10px] leading-[13px] text-[rgba(28,29,35,0.55)]">
					{isMediaRecorderNotSupported ? (
						t("recordingSummary.superEditorPanel.warning.mediaRecorderNotSupported")
					) : (
						<div className="flex items-center justify-center gap-1">
							<RecordingIndicator />
							{recordingWarningText}
						</div>
					)}
				</div>
			</div>

			<div className="flex w-full items-center justify-between gap-1.5">
				<div className="flex items-center justify-start gap-2.5">
					{!isSmall ? leftToolbar : null}
				</div>

				<div
					className={cn(
						"flex items-center justify-end",
						size === "small" && "gap-1",
						size === "mobile" && "gap-1.5",
						size === "default" && "gap-2.5",
					)}
				>
					{editorModeSwitch?.({ disabled: uploading })}
					{(isRecording || isPaused) && !isCurrentRecording && (
						<div className="flex items-center justify-end gap-2.5">
							<Tooltip
								title={t(
									"recordingSummary.superEditorPanel.button.viewCurrentRecording",
								)}
							>
								<button
									className={cn(
										"flex h-8 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-border bg-background px-[5px] text-xs leading-4 text-[rgba(28,29,35,0.8)] transition-all duration-200 ease-out hover:bg-[rgba(28,29,35,0.05)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
										isSmall && "h-6 px-[3px] text-[10px] leading-[14px]",
									)}
									onClick={onOpenCurrentRecording}
								>
									<MagicIcon
										component={IconMicRecording}
										size={isSmall ? 16 : 20}
										color="rgba(28, 29, 35, 0.8)"
									/>
								</button>
							</Tooltip>
						</div>
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
