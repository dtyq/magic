import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useThrottleFn, useMemoizedFn } from "ahooks"
import type { JSONContent } from "@tiptap/react"
import MagicModal from "@/components/base/MagicModal"
import MessageService from "@/services/chat/message/MessageService"
import EditorService from "@/services/chat/editor/EditorService"
import { generateRichText } from "../../ChatSubSider/utils"
import magicToast from "@/components/base/MagicToaster/utils"

export interface UseMessageSendOptions {
	/** Whether sending is disabled */
	sendDisabled: boolean
	/** Function to get editor JSON content */
	getEditorJSON: () => { json: JSONContent | undefined; onlyText: boolean }
	/** Function to upload files for sending */
	uploadFilesForSend: (jsonValue: JSONContent | undefined) => Promise<{
		transformedJsonContent: JSONContent | undefined
		reportedFiles: any[]
	}>
	/** Function to execute after successful send for clearing data */
	onAfterSend?: () => void
	/** Function to execute before sending */
	onBeforeSend?: () => Promise<void>
}

export function useMessageSend(options: UseMessageSendOptions) {
	const { t } = useTranslation("interface")
	const sending = useRef(false)
	const [isSending, setIsSending] = useState(false)

	const { sendDisabled, getEditorJSON, uploadFilesForSend, onAfterSend, onBeforeSend } = options

	const { run: handleSendWithoutCheck } = useThrottleFn(
		useMemoizedFn(async (jsonValue?: JSONContent | undefined, onlyTextContent?: boolean) => {
			try {
				sending.current = true
				setIsSending(true)

				// Get content - use provided params or get from editor
				let json: JSONContent | undefined
				let onlyText: boolean
				let normalValue: string

				if (jsonValue !== undefined && onlyTextContent !== undefined) {
					// Use provided parameters (programmatic call)
					json = jsonValue
					onlyText = onlyTextContent
					normalValue = generateRichText(JSON.stringify(json))
				} else {
					// Get from editor (UI interaction)
					const editorContent = getEditorJSON()
					json = editorContent.json
					onlyText = editorContent.onlyText
					normalValue = generateRichText(JSON.stringify(json))
				}

				// Check if message is too long and show confirmation if needed
				if (MessageService.isTextSizeOverLimit(JSON.stringify(normalValue))) {
					const confirmed = await new Promise<boolean>((resolve) => {
						MagicModal.confirm({
							title: t("chat.messageEditor.longMessageConfirm.title", {
								ns: "interface",
							}),
							content: t("chat.messageEditor.longMessageConfirm.content", {
								ns: "interface",
							}),
							okText: t("chat.messageEditor.longMessageConfirm.okText", {
								ns: "interface",
							}),
							onOk: () => resolve(true),
							onCancel: () => resolve(false),
						})
					})

					if (!confirmed) {
						return
					}
				}

				// 这个逻辑中可能包含创建/切换会话/话题的操作，切换后可能导致编辑器实例重新重置，导致消息内容丢失
				// 需要把这个逻辑放在获取消息内容之后，确保消息内容不会丢失
				await onBeforeSend?.()

				// Upload files and transform content
				try {
					const { transformedJsonContent, reportedFiles } = await uploadFilesForSend(json)

					const finalNormalValue = generateRichText(
						JSON.stringify(transformedJsonContent),
					)

					// Determine if this is a long message based on final content
					const isLongMessage = MessageService.isTextSizeOverLimit(
						JSON.stringify(finalNormalValue),
					)

					// Send message
					EditorService.send({
						jsonValue: transformedJsonContent,
						normalValue: finalNormalValue,
						files: reportedFiles,
						onlyTextContent: onlyText,
						isLongMessage,
					})
				} catch (uploadError) {
					magicToast.error(t("file.uploadFail", { ns: "message" }))
					return
				}

				// Execute after send callback if provided
				onAfterSend?.()
			} catch (error) {
				console.error("handleSend error", error)
			} finally {
				sending.current = false
				setIsSending(false)
			}
		}),
		{ wait: 200 },
	)

	const handleSend = useMemoizedFn(
		async (jsonValue?: JSONContent | undefined, onlyTextContent?: boolean) => {
			if (sendDisabled || sending.current) return

			await handleSendWithoutCheck(jsonValue, onlyTextContent)
		},
	)

	return {
		handleSend,
		handleSendWithoutCheck,
		isSending,
	}
}
