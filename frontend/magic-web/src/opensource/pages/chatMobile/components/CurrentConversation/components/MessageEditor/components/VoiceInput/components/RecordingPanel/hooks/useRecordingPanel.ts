import { useState, useEffect, useRef } from "react"
import type { RecordingPanelProps } from "../types"
import { useUpdateEffect } from "ahooks"

/**
 * useRecordingPanel - RecordingPanel component main logic hook
 *
 * @param props - Component props
 * @returns Component state and handlers
 */
export function useRecordingPanel(props: RecordingPanelProps) {
	const { recordingState, onClose, onSendText, onSendVoice, onEditText, onCancel, onReset } =
		props
	const { isRecording = false, isEditingText = false } = recordingState

	const [editableText, setEditableText] = useState("")
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	// Prevent background scrolling
	useEffect(() => {
		if (isRecording || isEditingText) {
			document.body.style.overflow = "hidden"
		} else {
			document.body.style.overflow = ""
		}

		return () => {
			document.body.style.overflow = ""
		}
	}, [isRecording, isEditingText])

	// Sync transcription text to editable text
	useEffect(() => {
		if (recordingState.transcription && !isEditingText) {
			setEditableText(recordingState.transcription)
		}
	}, [recordingState.transcription, isEditingText])

	// Focus input when entering edit mode
	useUpdateEffect(() => {
		if (isEditingText && textareaRef.current) {
			// Delay focus to let animation complete
			setTimeout(() => {
				if (textareaRef.current) {
					textareaRef.current.focus()
					// Move cursor to end of text - only when first entering edit mode
					const length = editableText.length
					textareaRef.current.setSelectionRange(length, length)
					textareaRef.current.style.height = "auto"
					textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
				}
			}, 150)
		}
	}, [isEditingText])

	// Handle cancel action
	const handleCancel = () => {
		if (isEditingText) {
			setEditableText("")
		}
		onCancel?.()
		onClose?.()
		// 触发外部重置
		onReset?.()
		// 内部重置
		resetEditState()
	}

	// Handle send text action
	const handleSendText = () => {
		if (isEditingText) {
			// Send edited text in edit mode
			onSendText?.(editableText.trim())
			setEditableText("")
			onClose?.()
			// 发送完成后触发外部重置
			onReset?.()
			// 内部重置
			resetEditState()
		} else {
			// Enter edit mode in recording mode
			onEditText?.()
		}
	}

	// Handle send voice action
	const handleSendVoice = () => {
		onSendVoice?.()
		onClose?.()
		// 发送完成后触发外部重置
		onReset?.()
		// 内部重置
		resetEditState()
	}

	// Handle textarea input auto-resize
	const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
		const target = e.target as HTMLTextAreaElement
		target.style.height = "auto"
		target.style.height = `${target.scrollHeight}px`
	}

	// 重置编辑状态 - 用于组件关闭时清空
	const resetEditState = () => {
		setEditableText("")
		// 恢复body滚动
		document.body.style.overflow = ""
	}

	return {
		state: {
			editableText,
			isRecording,
			isEditingText,
		},
		refs: {
			textareaRef,
		},
		handlers: {
			handleCancel,
			handleSendText,
			handleSendVoice,
			handleTextareaInput,
			setEditableText,
			resetEditState,
		},
	}
}
