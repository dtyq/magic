import type { Editor } from "@tiptap/react"

export interface ProjectImageDropdownProps {
	/**
	 * The Tiptap editor instance
	 */
	editor: Editor | null

	/**
	 * Callback when dropdown should close
	 */
	onClose: () => void

	/**
	 * Callback after image is successfully inserted
	 */
	onInserted?: () => void

	/**
	 * Project ID for fetching project images
	 */
	projectId?: string
}

export interface ImageAttachment {
	file_id: string
	file_name: string
	file_extension: string
	file_size: number
	relative_file_path?: string
}

export type TabKey = "upload" | "link" | "project"
