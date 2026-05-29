import { useEffect } from "react"
import type { Editor, JSONContent } from "@tiptap/react"
import { useMemoizedFn } from "ahooks"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { DraftStore } from "../stores"
import type { SendMessageByContentPayload } from "../types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
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
	onSendMessageByContent: (data: SendMessageByContentPayload) => void
}

interface AddContentPayload {
	content?: JSONContent
	extraData?: {
		hasInput?: boolean
	}
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

function safeEditorFocus(editor: Editor | null) {
	if (!editor || editor.isDestroyed) return
	try {
		editor.commands.focus()
	} catch {
		// view may not be mounted yet during rapid state transitions
	}
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
							safeEditorFocus(editor)
							if (isMobile) {
								editor?.commands.scrollIntoView()
							}
						}
					}
				})
			}, 400)
		}

		pubsub.subscribe(PubSubEvents.Add_File_To_Chat, handleAddFileToChat)

		return () => {
			pubsub.unsubscribe(PubSubEvents.Add_File_To_Chat, handleAddFileToChat)
		}
	}, [editor, isMobile, draftStore])

	useEffect(() => {
		const handleInsertDragDataToEditor = (dragData: unknown) => {
			if (!editor || !isDragData(dragData)) return
			insertMentionFromDroppedData({ editor, data: dragData })
		}

		pubsub.subscribe(PubSubEvents.Insert_Drag_Data_To_Editor, handleInsertDragDataToEditor)

		return () => {
			pubsub.unsubscribe(
				PubSubEvents.Insert_Drag_Data_To_Editor,
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
			safeEditorFocus(editor)
		}
	})

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Add_Content_To_Chat, handleAddContent)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Add_Content_To_Chat, handleAddContent)
		}
	}, [handleAddContent])

	useEffect(() => {
		const handleSetInputMessage = (message: string | string[] | JSONContent) => {
			// JSONContent object — use directly
			if (typeof message === "object" && !Array.isArray(message) && message !== null) {
				updateContent(message)
				safeEditorFocus(editor)
				return
			}
			const lines = Array.isArray(message) ? message : [message]
			if (lines.length === 0) return
			const inlineNodes: JSONContent[] = []
			lines.forEach((line, i) => {
				if (i > 0) inlineNodes.push({ type: "hardBreak" })
				if (line) inlineNodes.push({ type: "text", text: line })
			})
			const content: JSONContent = {
				type: "doc",
				content: [{ type: "paragraph", content: inlineNodes }],
			}
			updateContent(content)
			safeEditorFocus(editor)
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
			safeEditorFocus(editor)
		}
		pubsub.subscribe(PubSubEvents.Set_Demo_Text_To_Input, handleInsertDemoText)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Set_Demo_Text_To_Input, handleInsertDemoText)
		}
	}, [editor, updateContent])

	useEffect(() => {
		const handleAppendSuggestion = (input: string | JSONContent) => {
			if (!input || !editor) return

			// Determine new nodes to append
			const newNodes: JSONContent[] =
				typeof input === "string"
					? [{ type: "paragraph", content: [{ type: "text", text: input }] }]
					: input.type === "doc"
						? (input.content ?? [])
						: [input]

			if (!newNodes.length) return

			const currentContent = editor.getJSON()
			const mergedContent: JSONContent = !editor?.isEmpty
				? {
					...currentContent,
					content: [...(currentContent.content ?? []), ...newNodes],
				}
				: { type: "doc", content: newNodes }
			updateContent(mergedContent)
			safeEditorFocus(editor)
		}
		pubsub.subscribe(PubSubEvents.Append_Suggestion_To_Editor, handleAppendSuggestion)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Append_Suggestion_To_Editor, handleAppendSuggestion)
		}
	}, [editor, updateContent])
}

export default useMessageEditorPubSub
