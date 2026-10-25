import { useEffect } from "react"
import { type Editor, type JSONContent } from "@/infrastructure/editors/tiptap/react"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { isEmptyJSONContent } from "../utils"
import AiCompletionService from "@/services/chat/editor/AiCompletionService"
import { runActiveEditor, useLatestActiveEditor } from "../utils/editorLifecycle"

interface UseSlideContentSyncParams {
	tiptapEditor: Editor | null
	value: JSONContent | undefined
	updateContent: (content: JSONContent | undefined) => void
}

/**
 * Sync editor content when a slide is added
 * Subscribes to Set_Content_When_Slide_Added event and updates editor content if empty
 */
export function useSlideContentSync({
	tiptapEditor,
	value,
	updateContent,
}: UseSlideContentSyncParams) {
	const activeEditorRef = useLatestActiveEditor(tiptapEditor)

	useEffect(() => {
		const handleSetContentWhenSlideAdded = (data: { content: JSONContent }) => {
			// If editor already has content, don't set it
			if (!isEmptyJSONContent(value)) {
				return
			}

			// Disable AI completion before setting content with SuperPlaceholder
			AiCompletionService.disable()

			// If no content, set the new content
			updateContent(data.content)

			// Focus on the first SuperPlaceholder after content is set
			setTimeout(() => {
				runActiveEditor(activeEditorRef.current, (editor) => {
					editor.commands.focusFirstSuperPlaceholder?.()
				})
			}, 0)
		}

		pubsub.subscribe(PubSubEvents.Set_Content_When_Slide_Added, handleSetContentWhenSlideAdded)

		return () => {
			pubsub.unsubscribe(
				PubSubEvents.Set_Content_When_Slide_Added,
				handleSetContentWhenSlideAdded,
			)
		}
	}, [activeEditorRef, updateContent, value])
}
