import { memo, useCallback } from "react"
import { cx } from "antd-style"
import { usePressAndHold } from "./hooks/usePressAndHold"
import { useVoiceRecording } from "./hooks/useVoiceRecording"
import { useVoiceInputI18n } from "./hooks/useVoiceInputI18n"
import RecordingPanel from "./components/RecordingPanel"
import { useVoiceInputMobileStyles } from "./styles"
import type { VoiceInputMobileProps, GestureType, GestureState } from "./types"
import { useMemoizedFn } from "ahooks"

const VoiceInput = memo(
	({
		onVoiceResult,
		onTextResult,
		onCancel,
		onError,
		onStatusChange,
		disabled = false,
		buttonText,
		style,
		className,
	}: VoiceInputMobileProps) => {
		const { buttonTexts } = useVoiceInputI18n()
		const { styles } = useVoiceInputMobileStyles()

		// Use translation as default button text
		const displayButtonText = buttonText || buttonTexts.pressToSpeak

		// 语音录制逻辑
		const {
			recordingState,
			waveformData,
			startRecording,
			stopRecordingForEdit,
			cancelRecording,
			updateGestureState,
			handleRecordingResult,
			enterEditMode,
			exitEditMode,
			resetAllStates,
		} = useVoiceRecording({
			onVoiceResult,
			onTextResult,
			onError,
			onStatusChange,
		})

		// 处理按压开始
		const handlePressStart = useCallback(async () => {
			if (disabled) return
			// 直接调用startRecording，权限错误会在useVoiceRecording内部处理
			await startRecording()
		}, [disabled, startRecording])

		// 处理手势变化
		const handleGestureChange = useCallback(
			(gesture: GestureState) => {
				updateGestureState(gesture)
			},
			[updateGestureState],
		)

		// 处理按压结束
		const handlePressEnd = useMemoizedFn(async (gestureType: GestureType) => {
			if (disabled) return

			switch (gestureType) {
				case "cancel":
					cancelRecording()
					onCancel?.()
					break
				case "send-text":
					// 停止录音并保存音频数据，进入编辑模式
					await stopRecordingForEdit() // 停止录音并保存音频数据
					enterEditMode() // 进入编辑模式
					break
				case "send-voice":
				default:
					await handleRecordingResult("voice")
					// 发送完成后重置所有状态
					handleCompleteClose()
					break
			}
		})

		// 按压和手势检测
		const { isPressed, gestureState, resetStates, handlers } = usePressAndHold({
			onPressStart: handlePressStart,
			onPressEnd: handlePressEnd,
			onGestureChange: handleGestureChange,
			gestureThreshold: 80,
			disabled,
		})

		// 完全关闭组件时的状态清空
		const handleCompleteClose = useCallback(() => {
			// 先取消录音
			cancelRecording()
			// 然后彻底重置所有状态
			resetAllStates()
			resetStates()
		}, [cancelRecording, resetAllStates, resetStates])

		return (
			<>
				<div
					className={cx(styles.container, className, {
						disabled,
						[styles.pressed]: isPressed,
					})}
					style={style}
					aria-label={displayButtonText}
					{...handlers}
				>
					{displayButtonText}
				</div>

				{/* 录音面板 */}
				<RecordingPanel
					recordingState={{
						...recordingState,
						gesture: gestureState,
					}}
					waveformData={waveformData}
					onClose={() => {
						if (recordingState.isRecording) {
							cancelRecording()
							onCancel?.()
						} else if (recordingState.isEditingText) {
							exitEditMode()
						}
						// 无论什么情况都要彻底清空状态
						handleCompleteClose()
					}}
					onCancel={() => {
						if (recordingState.isEditingText) {
							exitEditMode()
						} else {
							cancelRecording()
							onCancel?.()
						}
						// 彻底清空状态
						handleCompleteClose()
					}}
					onSendText={async (text?: string) => {
						if (recordingState.isEditingText && text) {
							// 编辑模式下发送文本
							onTextResult?.(text)
							exitEditMode()
							// 发送完成后清空状态
							handleCompleteClose()
						}
					}}
					onEditText={() => {
						enterEditMode()
					}}
					onSendVoice={async () => {
						// 发送原始录音
						await handleRecordingResult("voice")
						// 发送完成后清空状态
						handleCompleteClose()
					}}
					onReset={handleCompleteClose}
					touchHandlers={handlers}
				/>
			</>
		)
	},
)

VoiceInput.displayName = "VoiceInput"

export default VoiceInput
export type { VoiceInputMobileProps } from "./types"
