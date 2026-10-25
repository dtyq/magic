import type { Editor, JSONContent } from "@/infrastructure/editors/tiptap/react"
import { useImperativeHandle } from "react"
import type { ForwardedRef } from "react"
import type { Topic } from "../../../pages/Workspace/types"
import type { FileData, ModelItem } from "../types"
import type { MessageEditorStore } from "../stores"
import type { MessageEditorRef } from "../MessageEditorContainer"

interface UseMessageEditorImperativeRefParams {
	ref: ForwardedRef<MessageEditorRef>
	tiptapEditor: Editor | null
	canSendMessage: boolean
	files: FileData[]
	clearFiles: () => void
	store: MessageEditorStore
	clearContent: () => void
	clearContentAfterSend: () => void
	updateContent: (content: JSONContent | undefined) => void
	focus: (params?: { enableWhenIsMobile?: boolean; preventScroll?: boolean }) => void
	addFiles: (files: File[]) => Promise<void>
	loadDraftReady: () => Promise<void>
	saveSuperMagicTopicModel: (params: {
		selectedTopic: Topic
		model: ModelItem
		imageModel: ModelItem | null
		videoModel?: ModelItem | null
	}) => void
	setModels: (params: {
		languageModel?: ModelItem | null
		imageModel?: ModelItem | null
		videoModel?: ModelItem | null
	}) => void
}

export default function useMessageEditorImperativeRef({
	ref,
	tiptapEditor,
	canSendMessage,
	files,
	clearFiles,
	store,
	clearContent,
	clearContentAfterSend,
	updateContent,
	focus,
	addFiles,
	loadDraftReady,
	saveSuperMagicTopicModel,
	setModels,
}: UseMessageEditorImperativeRefParams) {
	useImperativeHandle(
		ref,
		() => ({
			getDraftKey: store.draftStore.getDraftKey,
			beginDraftSwitch: store.draftStore.beginDraftSwitch,
			endDraftSwitch: store.draftStore.endDraftSwitch,
			prepareQueueDraft: store.draftStore.prepareQueueDraft,
			restoreQueueDraft: store.draftStore.restoreQueueDraft,
			getQueueDraft: store.draftStore.getQueueDraft,
			subscribeQueueDraft: store.draftStore.subscribeQueueDraft,
			keepQueueDraft: store.draftStore.keepQueueDraft,
			completeQueueDraft: store.draftStore.completeQueueDraft,
			editor: tiptapEditor,
			canSendMessage: canSendMessage ?? false,
			getFiles: () => files,
			clearFiles,
			getValue: () => store.editorStore.value,
			clearContent,
			clearContentAfterSend,
			setContent: updateContent,
			restoreMentionItems: () => undefined,
			restoreContent: (content?: JSONContent) => {
				updateContent(content)
			},
			focus,
			addUploadFiles: addFiles,
			loadDraftReady,
			saveSuperMagicTopicModel,
			setModels,
		}),
		[
			tiptapEditor,
			canSendMessage,
			clearFiles,
			clearContent,
			clearContentAfterSend,
			updateContent,
			focus,
			addFiles,
			loadDraftReady,
			files,
			store.editorStore.value,
			store.draftStore,
			saveSuperMagicTopicModel,
			setModels,
		],
	)
}
