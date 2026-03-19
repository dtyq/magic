import { JSONContent, Editor } from "@tiptap/react"
import { FileData } from "../types"

/**
 * Store configuration for MessageEditor
 */
export interface StoreConfig {
	/** Maximum number of files that can be uploaded */
	maxUploadCount: number
	/** Maximum file size in bytes */
	maxUploadSize: number
	/** Enable auto-save functionality */
	enableAutoSave: boolean
}

/**
 * Draft key parameters for loading/saving drafts
 */
export interface DraftKeyParams {
	workspaceId: string
	projectId: string
	topicId: string
}

/**
 * Parameters for saving a draft
 */
export interface SaveDraftParams extends DraftKeyParams {
	value: JSONContent | undefined
}

/**
 * Parameters for sending a message
 */
export interface SendMessageParams extends DraftKeyParams {
	onSend: (data: { value: JSONContent | undefined }) => void
}

/**
 * File upload configuration
 */
export interface FileUploadConfig {
	maxUploadCount: number
	maxUploadSize: number
}

/**
 * Editor state interface
 */
export interface EditorState {
	value: JSONContent | undefined
	tiptapEditor: Editor | null
	isComposing: boolean
	isOAuthInProgress: boolean
	placeholder: string
}

/**
 * File upload state interface
 */
export interface FileUploadState {
	files: FileData[]
}

/**
 * Draft state interface
 */
export interface DraftState {
	currentDraft: Record<string, unknown> | null
	draftVersions: Record<string, unknown>[]
	isDraftReady: boolean
	isSaving: boolean
}
