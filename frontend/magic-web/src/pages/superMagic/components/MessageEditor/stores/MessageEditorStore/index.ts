import { makeAutoObservable } from "mobx"
import type { JSONContent } from "@tiptap/react"
import type { DataService } from "@/components/business/MentionPanel/types"
import { EditorStore } from "../EditorStore"
import { DraftStore } from "../DraftStore"
import { FileUploadStore } from "../FileUploadStore"
import { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"

/**
 * MessageEditorStore - Root store for MessageEditor
 *
 * Integrates all sub-stores and provides unified access
 *
 * Sub-stores:
 * - editorStore: Manages editor content and state
 * - draftStore: Draft management
 * - fileUploadStore: File upload management
 * - topicModelStore: Manages selected models and loading state
 *
 * Future sub-stores (Phase 2):
 * - voiceStore: Voice input management
 * - aiCompletionStore: AI completion management
 *
 * Note: Mention items are now embedded in the editor's JSONContent,
 * so we don't need a separate MentionStore.
 */
export class MessageEditorStore {
	editorStore: EditorStore
	draftStore: DraftStore
	fileUploadStore: FileUploadStore
	topicModelStore: ReturnType<typeof createSuperMagicTopicModelStore>

	// Global states
	isSending = false
	isTaskRunning = false
	stopEventLoading = false

	constructor(options: MessageEditorStoreOptions = {}) {
		// Initialize sub-stores
		this.editorStore = new EditorStore()
		this.draftStore = new DraftStore(this.editorStore)
		this.fileUploadStore = new FileUploadStore()
		this.topicModelStore = createSuperMagicTopicModelStore()
		// Note: config parameter will be added in Phase 2 for fileUploadStore
		if (options.mentionPanelStore) {
			this.draftStore.setMentionPanelStore(options.mentionPanelStore)
		}

		makeAutoObservable(
			this,
			{},
			{
				autoBind: true,
			},
		)
	}

	/**
	 * Computed - Check if message can be sent
	 *
	 * Conditions:
	 * - Editor content is not empty
	 * - Not currently sending
	 */
	get canSendMessage(): boolean {
		return !this.editorStore.isEmpty && !this.isSending
	}

	/**
	 * Set sending state
	 */
	setIsSending(isSending: boolean) {
		this.isSending = isSending
	}

	/**
	 * Set task running state
	 */
	setIsTaskRunning(isRunning: boolean) {
		this.isTaskRunning = isRunning
	}

	/**
	 * Set stop event loading state
	 */
	setStopEventLoading(loading: boolean) {
		this.stopEventLoading = loading
	}

	/**
	 * Clear all content
	 */
	clearContent() {
		this.editorStore.clearContent()
	}

	setValue({ value, mentionPanelStore }: SetValueOptions) {
		this.editorStore.setValue(value)
		this.draftStore.handleContentChange({
			value,
			mentionPanelStore,
			isComposing: this.editorStore.isComposing,
		})
	}

	/**
	 * Dispose all resources
	 */
	dispose() {
		this.draftStore.dispose()
		this.fileUploadStore.dispose()
		this.editorStore.dispose()
	}
}

interface SetValueOptions {
	value: JSONContent | undefined
	mentionPanelStore?: DataService
}

interface MessageEditorStoreOptions {
	mentionPanelStore?: DataService
}
