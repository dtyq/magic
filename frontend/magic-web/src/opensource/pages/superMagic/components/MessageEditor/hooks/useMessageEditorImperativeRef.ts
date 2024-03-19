import type { Editor, JSONContent } from "@tiptap/react"
import { useImperativeHandle } from "react"
import type { ForwardedRef } from "react"
import type { MentionListItem } from "@/opensource/components/business/MentionPanel/tiptap-plugin/types"
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
	focus: (params?: { enableWhenIsMobile?: boolean }) => void
	addFiles: (files: File[]) => Promise<void>
	loadDraftReady: () => Promise<void>
	saveSuperMagicTopicModel: (params: {
		selectedTopic: Topic
		model: ModelItem
		imageModel: ModelItem | null
	}) => void
	setModels: (params: { languageModel?: ModelItem | null; imageModel?: ModelItem | null }) => void
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
			editor: tiptapEditor,
			canSendMessage: canSendMessage ?? false,
			getFiles: () => files,
			clearFiles,
			getValue: () => store.editorStore.value,
			clearContent,
			clearContentAfterSend,
			setContent: updateContent,
			restoreMentionItems: (_items: MentionListItem[]) => undefined,
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
			saveSuperMagicTopicModel,
			setModels,
		],
	)
}
