import type { RefObject } from "react"
import { useMemo } from "react"
import { createPortal } from "react-dom"
import { useMemoizedFn } from "ahooks"
import usePortalTarget from "@/opensource/hooks/usePortalTarget"
import { PORTAL_IDS } from "@/opensource/constants/portal"
import TopicExampleCards from "../components/MessageList/components/MessageListFallback/TopicExampleCards"
import { TopicMode } from "../pages/Workspace/types"
import type { MessageEditorRef } from "../components/MessageEditor/MessageEditor"

interface UseTopicExamplesPortalParams {
	topicMode: TopicMode
	/** Editor ref for setting example content. Required when onCardClick not provided. */
	editorRef?: RefObject<MessageEditorRef | null>
	/** Custom handler when card is clicked. Overrides default when both provided. */
	onCardClick?: (content: string | object) => void
}

/**
 * Default handler: set content to editor and focus first SuperPlaceholder.
 */
function createDefaultSetExampleContentHandler(
	editorRef: RefObject<MessageEditorRef | null>,
): (content: string | object) => void {
	return (content: string | object) => {
		const editor = editorRef.current?.editor
		if (!editor) return

		editor.commands.setContent(content, { emitUpdate: true })
		setTimeout(() => {
			if (!editor.commands.focusFirstSuperPlaceholder()) {
				editor.commands.focus()
			}
		}, 100)
	}
}

/**
 * Reusable hook for rendering TopicExampleCards into the message list fallback portal.
 * Consolidates usePortalTarget + createPortal + TopicExampleCards + set example content logic.
 *
 * @example
 * // With editorRef (recommended, handler built internally)
 * const topicExamplesPortalNode = useTopicExamplesPortal({
 *   editorRef: tiptapEditorRef,
 *   topicMode: tabPattern,
 * })
 *
 * @example
 * // With custom onCardClick
 * const topicExamplesPortalNode = useTopicExamplesPortal({
 *   topicMode: tabPattern,
 *   onCardClick: handleCustomCardClick,
 * })
 */
function useTopicExamplesPortal({
	topicMode,
	editorRef,
	onCardClick,
}: UseTopicExamplesPortalParams) {
	const portalTarget = usePortalTarget({
		portalId: PORTAL_IDS.SUPER_MAGIC_MESSAGE_LIST_FALLBACK_TOPIC_EXAMPLES,
	})

	const defaultHandler = useMemoizedFn(
		createDefaultSetExampleContentHandler(editorRef ?? { current: null }),
	)
	const effectiveOnCardClick = onCardClick ?? (editorRef ? defaultHandler : undefined)

	const portalNode = useMemo(() => {
		if (!portalTarget || !effectiveOnCardClick) return null
		return createPortal(
			<TopicExampleCards topicMode={topicMode} onCardClick={effectiveOnCardClick} />,
			portalTarget,
		)
	}, [portalTarget, topicMode, effectiveOnCardClick])

	return portalNode
}

export default useTopicExamplesPortal
