import { useEffect } from "react"
import { type Editor, type JSONContent } from "@tiptap/react"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { isEmptyJSONContent } from "../utils"
import AiCompletionService from "@/opensource/services/chat/editor/AiCompletionService"

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
				tiptapEditor?.commands?.focusFirstSuperPlaceholder?.()
			}, 0)
		}

		pubsub.subscribe(PubSubEvents.Set_Content_When_Slide_Added, handleSetContentWhenSlideAdded)

		return () => {
			pubsub.unsubscribe(
				PubSubEvents.Set_Content_When_Slide_Added,
				handleSetContentWhenSlideAdded,
			)
		}
	}, [tiptapEditor, updateContent, value])
}
