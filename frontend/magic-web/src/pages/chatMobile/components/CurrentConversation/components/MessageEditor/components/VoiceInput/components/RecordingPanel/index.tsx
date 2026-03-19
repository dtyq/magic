import { memo } from "react"
import { useTranslation } from "react-i18next"
import {
	IconTrash,
	IconTextColor,
	IconMicrophone,
	IconBrandTelegram,
	IconWaveSawTool,
	IconArrowBackUp,
} from "@tabler/icons-react"

// Types
import type { RecordingPanelProps } from "./types"

// Styles
import { useStyles, getWaveformProps, getMicrophoneStyleClass } from "./styles"

// Hooks
import { useRecordingPanel } from "./hooks"

// Components
import AudioWaveform from "../AudioWaveform"
import MagicIcon from "@/components/base/MagicIcon"

/**
 * RecordingPanel - Voice recording panel component with edit functionality
 *
 * @param props - Component props
 * @returns JSX.Element
 */
const RecordingPanel = memo((props: RecordingPanelProps) => {
	const { recordingState, waveformData, className, touchHandlers } = props
	const { t } = useTranslation("component")
	const { styles, cx } = useStyles()

	const { state, refs, handlers } = useRecordingPanel(props)
	const { editableText, isRecording, isEditingText } = state
	const { textareaRef } = refs
	const { handleCancel, handleSendText, handleSendVoice, handleTextareaInput, setEditableText } =
		handlers

	if (!isRecording && !isEditingText) return null

	const gestureType = recordingState.gesture?.type || "none"
	const { transcription } = recordingState

	// Determine current state
	const isCancel = gestureType === "cancel"
	const isSendText = gestureType === "send-text" || isEditingText

	// Get waveform props based on state
	const waveformProps = getWaveformProps(isCancel)

	// Get microphone button style
	const microphoneStyle = getMicrophoneStyleClass(isCancel, isSendText, styles)

	return (
		<div className={cx(styles.overlay, className)} {...(isEditingText ? {} : touchHandlers)}>
			{isEditingText ? (
				/* Edit mode layout */
				<div className={styles.editContent}>
					{/* Text bubble */}
					<div>
						<div className={styles.messageBubble}>
							<textarea
								ref={textareaRef}
								className={styles.editableTextInput}
								value={editableText}
								onChange={(e) => setEditableText(e.target.value)}
								placeholder={t("voiceInput.placeholder.textInput")}
								rows={1}
								onInput={handleTextareaInput}
							/>
						</div>
					</div>

					{/* Action buttons */}
					<div className={styles.editActionsContainer}>
						{/* Cancel button */}
						<div
							className={cx(
								styles.editActionButton,
								styles.editActionButtonCircle,
								styles.editCancelButton,
							)}
							onClick={handleCancel}
						>
							<MagicIcon component={IconArrowBackUp} size={24} color="currentColor" />
							<div className={styles.editActionLabel}>
								{t("voiceInput.button.back")}
							</div>
						</div>

						{/* Send original voice button */}
						<div
							className={cx(
								styles.editActionButton,
								styles.editActionButtonCircle,
								styles.editVoiceButton,
							)}
							onClick={handleSendVoice}
						>
							<MagicIcon component={IconWaveSawTool} size={24} color="currentColor" />
							<div className={styles.editActionLabel}>
								{t("voiceInput.button.sendVoice")}
							</div>
						</div>

						{/* Send text button */}
						<div
							className={cx(
								styles.editActionButtonCircle,
								styles.editSendButton,
								styles.editActionButton,
							)}
							onClick={handleSendText}
						>
							<MagicIcon
								component={IconBrandTelegram}
								size={32}
								color="currentColor"
							/>
							<div className={cx(styles.editActionLabel, styles.editSendButtonLabel)}>
								{t("voiceInput.button.sendText")}
							</div>
						</div>
					</div>
				</div>
			) : (
				/* Recording mode layout */
				<div className={styles.content}>
					{/* Voice message bubble - shown in text conversion state */}
					{isSendText && transcription && (
						<div className={styles.messageBubble}>
							<p className={styles.messageText}>{transcription}</p>
						</div>
					)}

					{/* Audio waveform */}
					<div className={styles.waveformContainer}>
						<AudioWaveform
							data={waveformData}
							width={375}
							height={100}
							color={waveformProps.color}
							backgroundColor={waveformProps.backgroundColor}
							barWidth={2}
							barSpacing={1}
						/>
					</div>

					{/* Action buttons */}
					<div className={styles.actionsContainer}>
						{/* Cancel button */}
						<div className={styles.actionButton} onClick={handleCancel}>
							<div
								className={cx(
									styles.actionLabel,
									isCancel ? styles.cancelActiveLabel : styles.defaultLabel,
								)}
							>
								{isCancel
									? t("voiceInput.status.releaseToCancel")
									: t("voiceInput.button.cancel")}
							</div>
							<div
								className={cx(
									styles.actionButtonCircle,
									isCancel ? styles.cancelActiveButton : styles.defaultButton,
								)}
							>
								<MagicIcon component={IconTrash} size={40} color="currentColor" />
							</div>
						</div>

						{/* Convert to text button */}
						<div className={styles.actionButton} onClick={handleSendText}>
							<div
								className={cx(
									styles.actionLabel,
									isSendText ? styles.textActiveLabel : styles.defaultLabel,
								)}
							>
								{t("voiceInput.button.convertToText")}
							</div>
							<div
								className={cx(
									styles.actionButtonCircle,
									isSendText ? styles.textActiveButton : styles.defaultButton,
								)}
							>
								<MagicIcon
									component={IconTextColor}
									size={40}
									color="currentColor"
								/>
							</div>
						</div>
					</div>

					{/* Status text */}
					<div className={styles.statusText}>{t("voiceInput.status.releaseToSend")}</div>

					{/* Microphone button */}
					<div className={cx(styles.microphoneButton, microphoneStyle)}>
						<MagicIcon component={IconMicrophone} size={40} color="currentColor" />
					</div>
				</div>
			)}
		</div>
	)
})

RecordingPanel.displayName = "RecordingPanel"

export default RecordingPanel
