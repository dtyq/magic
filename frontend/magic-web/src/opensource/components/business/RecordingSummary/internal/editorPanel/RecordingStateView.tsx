import MagicIcon from "@/opensource/components/base/MagicIcon"
import { InterruptButton } from "@/opensource/pages/superMagic/components/MessageEditor/components"
import { IconArrowUp, IconPlayerStopFilled } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import LoadingIcon from "@/opensource/components/business/RecordingSummary/components/LoadingIcon"
import type { RecordingEditorWaveformProps } from "./types"

interface RecordingStateViewProps {
	WaveformComponent: React.ComponentType<RecordingEditorWaveformProps>
	isRecording: boolean
	isPaused: boolean
	duration: string
	isWaitingSummarize: boolean
	isTaskRunning: boolean
	iconSize: number
	isSmall: boolean
	onInterrupt?: () => void
	onCancel: () => void
	onSummarize: () => void
}

export function RecordingStateView({
	WaveformComponent,
	isRecording,
	isPaused,
	duration,
	isWaitingSummarize,
	isTaskRunning,
	iconSize,
	isSmall,
	onInterrupt,
	onCancel,
	onSummarize,
}: RecordingStateViewProps) {
	const { t } = useTranslation("super")

	return (
		<div
			className="flex min-h-[160px] w-full flex-col items-center justify-center gap-2.5 bg-white"
			data-testid="recording-editor-recording-state"
		>
			<div
				className="flex w-[500px] max-w-[90%] items-center gap-5"
				data-testid="recording-editor-progress-container"
			>
				<WaveformComponent isRecording={isRecording} isPaused={isPaused} />
				<div
					className="whitespace-nowrap text-xs leading-4 text-[rgba(28,29,35,0.8)]"
					data-testid="recording-editor-time-display"
				>
					{duration}
				</div>
			</div>

			<div
				className="flex items-center justify-center gap-2.5"
				data-testid="recording-editor-action-buttons"
			>
				<button
					className="flex h-8 cursor-pointer items-center gap-1 rounded-lg border-none bg-white px-2 py-1.5 text-xs leading-4 text-[rgba(28,29,35,0.8)] transition-all duration-200 ease-out hover:bg-[rgba(28,29,35,0.05)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
					onClick={onCancel}
					disabled={isWaitingSummarize}
					data-testid="recording-editor-cancel-button"
					data-disabled={isWaitingSummarize}
				>
					<MagicIcon
						component={IconPlayerStopFilled}
						size={20}
						color="rgba(28, 29, 35, 0.8)"
					/>
					{t("recordingSummary.superEditorPanel.button.cancelRecording")}
				</button>
				<button
					className="flex cursor-pointer items-center gap-1 rounded-[1000px] border-none bg-gradient-to-r from-[#443855] to-[#000] px-5 py-2.5 text-sm font-semibold leading-5 text-white transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] active:scale-[0.98]"
					onClick={onSummarize}
					disabled={isWaitingSummarize}
					data-testid="recording-editor-summarize-button"
					data-disabled={isWaitingSummarize}
					data-loading={isWaitingSummarize}
				>
					{isWaitingSummarize ? (
						<LoadingIcon size={isSmall ? 16 : 20} color="white" />
					) : (
						<MagicIcon component={IconArrowUp} size={24} color="white" />
					)}
					{t("recordingSummary.actions.summarize")}
				</button>
			</div>

			<div
				className="flex w-full items-center justify-between gap-2.5 px-4"
				data-testid="recording-editor-bottom-controls"
			>
				<InterruptButton
					visible={isTaskRunning}
					iconSize={iconSize}
					onInterrupt={onInterrupt}
				/>
				<div
					className="text-[10px] leading-[13px] text-[rgba(28,29,35,0.55)]"
					data-testid="recording-editor-warning-text"
				>
					{t("recordingSummary.superEditorPanel.warning.duringRecording")}
				</div>
			</div>
		</div>
	)
}
