import { useEffect } from "react"
import type { Editor, JSONContent } from "@tiptap/react"
import { useMemoizedFn } from "ahooks"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import type { DraftStore } from "../stores"
import type { TiptapMentionAttributes } from "@/opensource/components/business/MentionPanel/tiptap-plugin"
import {
	insertMentionFromDroppedData,
	DRAG_TYPE,
	type TabDragData,
	type AttachmentDragData,
	type MultipleFilesDragData,
	type PPTSlideDragData,
} from "../utils/drag"

interface UseMessageEditorPubSubParams {
	editor: Editor | null
	isMobile: boolean
	draftStore: DraftStore
	updateContent: (content: JSONContent | undefined) => void
	enableMessageSendByContent: boolean
	onSendMessageByContent: (data: { jsonContent: JSONContent }) => void
}

interface AddContentPayload {
	content?: JSONContent
	extraData?: {
		hasInput?: boolean
	}
}

interface ReEditPayload {
	content?: string
}

type DragData = TabDragData | AttachmentDragData | MultipleFilesDragData | PPTSlideDragData

function isDragData(data: unknown): data is DragData {
	if (!data || typeof data !== "object") return false
	if (!("type" in data)) return false
	const dragType = (data as { type?: string }).type
	return (
		dragType === DRAG_TYPE.Tab ||
		dragType === DRAG_TYPE.ProjectFile ||
		dragType === DRAG_TYPE.ProjectDirectory ||
		dragType === DRAG_TYPE.MultipleFiles ||
		dragType === DRAG_TYPE.PPTSlide
	)
}

function useMessageEditorPubSub({
	editor,
	isMobile,
	draftStore,
	updateContent,
	enableMessageSendByContent,
	onSendMessageByContent,
}: UseMessageEditorPubSubParams) {
	useEffect(() => {
		const handleAddFileToChat = (data: {
			items: TiptapMentionAttributes[]
			is_new_topic: boolean
			autoFocus?: boolean
		}) => {
			const { items, autoFocus = false } = data
			// Delay insert for new topics to allow draft loading
			setTimeout(() => {
				draftStore.waitForLoadDraft().then(() => {
					if (Array.isArray(items) && items.length > 0) {
						const mentions = items.map((item) => ({
							type: "mention",
							attrs: item,
						}))
						editor?.commands.insertContent(mentions)
						if (autoFocus) {
							editor?.commands.focus()
							if (isMobile) {
								editor?.commands.scrollIntoView()
							}
						}
					}
				})
			}, 400)
		}

		pubsub.subscribe("super_magic_add_file_to_chat", handleAddFileToChat)

		return () => {
			pubsub.unsubscribe("super_magic_add_file_to_chat", handleAddFileToChat)
		}
	}, [editor, isMobile, draftStore])

	useEffect(() => {
		const handleInsertDragDataToEditor = (dragData: unknown) => {
			if (!editor || !isDragData(dragData)) return
			insertMentionFromDroppedData({ editor, data: dragData })
		}

		pubsub.subscribe("super_magic_insert_drag_data_to_editor", handleInsertDragDataToEditor)

		return () => {
			pubsub.unsubscribe(
				"super_magic_insert_drag_data_to_editor",
				handleInsertDragDataToEditor,
			)
		}
	}, [editor])

	const handleAddContent = useMemoizedFn((data: AddContentPayload) => {
		const { content, extraData } = data
		if (content) updateContent(content)
		if (extraData?.hasInput) {
			editor?.commands?.focusFirstSuperPlaceholder?.()
		} else {
			editor?.commands.focus()
		}
	})

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Add_Content_To_Chat, handleAddContent)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Add_Content_To_Chat, handleAddContent)
		}
	}, [handleAddContent])

	const handleReEdit = useMemoizedFn((node: ReEditPayload) => {
		if (node?.content) {
			updateContent(JSON.parse(node.content))
		}
		editor?.commands.focus()
	})

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Re_Edit_Message, handleReEdit)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Re_Edit_Message, handleReEdit)
		}
	}, [handleReEdit])

	useEffect(() => {
		const handleSetInputMessage = (message: string) => {
			if (typeof message !== "string") return
			const content: JSONContent = {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [
							{
								type: "text",
								text: message,
							},
						],
					},
				],
			}
			updateContent(content)
			editor?.commands.focus()
		}
		pubsub.subscribe(PubSubEvents.Set_Input_Message, handleSetInputMessage)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Set_Input_Message, handleSetInputMessage)
		}
	}, [editor?.commands, updateContent])

	useEffect(() => {
		if (!enableMessageSendByContent) {
			return
		}
		pubsub.subscribe(PubSubEvents.Send_Message_by_Content, onSendMessageByContent)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Send_Message_by_Content, onSendMessageByContent)
		}
	}, [enableMessageSendByContent, onSendMessageByContent])

	useEffect(() => {
		const handleInsertDemoText = (text: string) => {
			if (typeof text !== "string" || !text) return
			const content: JSONContent = {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "text", text }],
					},
				],
			}
			updateContent(content)
			editor?.commands.focus()
		}
		pubsub.subscribe(PubSubEvents.Set_Demo_Text_To_Input, handleInsertDemoText)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Set_Demo_Text_To_Input, handleInsertDemoText)
		}
	}, [editor, updateContent])
}

export default useMessageEditorPubSub
