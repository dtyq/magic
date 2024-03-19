import { useMemoizedFn } from "ahooks"
import { RefObject } from "react"
import { MessageEditorRef } from "../components/MessageEditor/MessageEditor"
import { TopicMode } from "../pages/Workspace/types"
import useTopicExamplesPortal from "./useTopicExamplesPortal"

interface UseTopicExamplesEditorPortalParams {
	editorRef: RefObject<MessageEditorRef | null>
	topicMode: TopicMode
}

/**
 * Renders topic example cards portal and applies selected example content into editor.
 */
function useTopicExamplesEditorPortal({
	editorRef,
	topicMode,
}: UseTopicExamplesEditorPortalParams) {
	const handleSetExampleContent = useMemoizedFn((content: string | object) => {
		const editor = editorRef.current?.editor
		if (!editor) return

		editor.commands.setContent(content, { emitUpdate: true })

		setTimeout(() => {
			if (!editor.commands.focusFirstSuperPlaceholder()) {
				editor.commands.focus()
			}
		}, 100)
	})

	return useTopicExamplesPortal({
		topicMode,
		onCardClick: handleSetExampleContent,
	})
}

export default useTopicExamplesEditorPortal
