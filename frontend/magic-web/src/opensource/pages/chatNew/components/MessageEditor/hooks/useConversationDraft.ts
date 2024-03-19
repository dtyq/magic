import { useEffect, useRef } from "react"
import { useDebounceFn, useMemoizedFn } from "ahooks"
import { omit } from "lodash-es"
import type { JSONContent } from "@tiptap/react"
import type { MagicRichEditorRef } from "@/opensource/components/base/MagicRichEditor"

/** Services */
import EditorDraftService from "@/opensource/services/chat/editor/DraftService"
import EditorDraftStore from "@/opensource/stores/chatNew/editorDraft"
import EditorStore from "@/opensource/stores/chatNew/messageUI/editor"

/** Types */
import type { FileData } from "../components/InputFiles/types"

export interface UseConversationDraftOptions {
	/** Editor reference */
	editorRef: React.RefObject<MagicRichEditorRef>
	/** Current files */
	files: FileData[]
	/** Set files function */
	setFiles: (files: FileData[]) => void
	/** Set empty state function */
	setIsEmpty?: (isEmpty: boolean) => void
	/** Set editor value function */
	setValue: (value: JSONContent | undefined) => void
	/** Current conversation ID */
	conversationId?: string
	/** Current topic ID */
	topicId?: string
	/** Whether editor is ready */
	editorReady: boolean
	/** Setting content flag reference */
	settingContent: React.MutableRefObject<boolean>
	/** Debounce wait time in milliseconds */
	debounceWait?: number
}

export interface UseConversationDraftReturn {
	/** Write current draft (debounced) */
	writeCurrentDraft: () => void
	/** Delete draft for specific conversation and topic */
	deleteDraft: (conversationId: string, topicId: string) => void
	/** Check if draft exists */
	hasDraft: (conversationId: string, topicId: string) => boolean
	/** Get draft content */
	getDraft: (conversationId: string, topicId: string) => any
	/** Force write draft immediately (without debounce) */
	writeDraftSync: (conversationId: string, topicId: string) => void
}

/**
 * Conversation draft management hook
 * Handles draft saving, loading, and switching between conversations/topics
 */
function useConversationDraft({
	editorRef,
	files,
	setFiles,
	setValue,
	setIsEmpty,
	conversationId,
	topicId,
	editorReady,
	settingContent,
	debounceWait = 1000,
}: UseConversationDraftOptions): UseConversationDraftReturn {
	// Track initialization to prevent unnecessary operations
	const initialized = useRef(false)

	/** ========================== Write Draft ========================== */
	const writeDraftSync = useMemoizedFn((targetConversationId: string, targetTopicId: string) => {
		try {
			const content = editorRef.current?.editor?.getJSON() ?? {}
			const processedFiles = files.map((file) => omit(file, ["error", "cancel"]))

			EditorDraftService.writeDraft(targetConversationId, targetTopicId, {
				content,
				files: processedFiles,
			})
		} catch (error) {
			console.error("Error writing draft:", error)
		}
	})

	const { run: writeCurrentDraft } = useDebounceFn(
		() => {
			if (conversationId) {
				writeDraftSync(conversationId, topicId ?? "")
			}
		},
		{ wait: debounceWait },
	)

	/** ========================== Draft Operations ========================== */
	const deleteDraft = useMemoizedFn((targetConversationId: string, targetTopicId: string) => {
		EditorDraftService.deleteDraft(targetConversationId, targetTopicId)
	})

	const hasDraft = useMemoizedFn((targetConversationId: string, targetTopicId: string) => {
		return EditorDraftStore.hasDraft(targetConversationId, targetTopicId)
	})

	const getDraft = useMemoizedFn((targetConversationId: string, targetTopicId: string) => {
		return EditorDraftStore.getDraft(targetConversationId, targetTopicId)
	})

	/** ========================== Draft Loading Helper ========================== */
	const loadDraft = useMemoizedFn((targetConversationId: string, targetTopicId: string) => {
		if (!editorReady || settingContent.current) return

		settingContent.current = true

		try {
			if (hasDraft(targetConversationId, targetTopicId)) {
				const draft = getDraft(targetConversationId, targetTopicId)

				// Set editor content
				editorRef.current?.editor?.commands.setContent(draft?.content ?? "", {
					emitUpdate: true,
				})

				// Set internal state
				setValue(draft?.content)

				// Set files
				const draftFiles = (draft?.files ?? [])
					.filter((file) => file.file !== null)
					.map((file) => ({ ...file, file: file.file as File }))
				setFiles(draftFiles)

				// Update empty state
				const text = editorRef.current?.editor?.getText()
				setIsEmpty?.(!text)
			} else {
				// Clear editor if no draft
				editorRef.current?.editor?.chain().clearContent().run()
				setIsEmpty?.(true)
				setValue(undefined)
				setFiles([])
			}
		} catch (error) {
			console.error("Error loading draft:", error)
			// Fallback to clear state
			editorRef.current?.editor?.chain().clearContent().run()
			setIsEmpty?.(true)
			setValue(undefined)
			setFiles([])
		} finally {
			settingContent.current = false
		}
	})

	/** ========================== Save and Load Drafts When Switching ========================== */
	useEffect(() => {
		if (!conversationId || !editorReady || settingContent.current) return

		// Save previous draft if conversation/topic changed
		if (
			initialized.current &&
			(EditorStore.lastConversationId !== conversationId ||
				EditorStore.lastTopicId !== topicId)
		) {
			// Save previous draft
			if (EditorStore.lastConversationId) {
				writeDraftSync(EditorStore.lastConversationId, EditorStore.lastTopicId ?? "")
			}
		}

		// Load current draft
		loadDraft(conversationId, topicId ?? "")

		// Update last conversation/topic IDs
		EditorStore.setLastConversationId(conversationId)
		EditorStore.setLastTopicId(topicId ?? "")

		// Mark as initialized
		initialized.current = true

		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [conversationId, topicId, editorReady])

	return {
		writeCurrentDraft,
		deleteDraft,
		hasDraft,
		getDraft,
		writeDraftSync,
	}
}

export default useConversationDraft
