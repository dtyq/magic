import { TextSelection } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import {
	TabDragData,
	AttachmentDragData,
	MultipleFilesDragData,
	DRAG_TYPE,
} from "@/opensource/pages/superMagic/components/MessageEditor/utils/drag"
import { t } from "i18next"
import { calculateRelativePath } from "@/opensource/utils/path"
import { normalizeImagePath } from "./utils/url-utils"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

/**
 * Check if file extension is an image format
 */
export function isImageFile(fileExtension?: string): boolean {
	if (!fileExtension) return false
	const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"]
	return imageExtensions.includes(fileExtension.toLowerCase().replace(/^\./, ""))
}

/**
 * Insert an image node into the editor
 */
export function insertProjectImageNode(
	view: EditorView,
	relativePath: string | undefined,
	documentPath?: string,
	pos?: number,
): void {
	const { state } = view
	const tr = state.tr

	// Calculate relative path from document to image if documentPath is provided
	let finalPath: string | undefined
	if (documentPath && relativePath) {
		// Use calculateRelativePath to handle all path normalization
		finalPath = calculateRelativePath(documentPath, relativePath)
	} else if (relativePath) {
		// Normalize path (handles data URLs, http/https, and relative paths)
		finalPath = normalizeImagePath(relativePath)
	} else {
		finalPath = relativePath
	}

	// Create image node
	const node = state.schema.nodes.image?.create({
		src: finalPath,
	})

	if (node) {
		if (pos !== undefined) {
			tr.insert(pos, node)
		} else {
			tr.replaceSelectionWith(node)
		}
		view.dispatch(tr)
	}
}

/**
 * Get drop position from drag event
 */
export function getDropPosition(view: EditorView, event: DragEvent): number | undefined {
	const pos = view.posAtCoords({
		left: event.clientX,
		top: event.clientY,
	})
	return pos?.pos
}

/**
 * Handle TabDragData - insert image from tab file
 */
function handleTabDragData(
	view: EditorView,
	event: DragEvent,
	data: TabDragData,
	documentPath?: string,
): boolean {
	const fileData = data.data.fileData
	if (!fileData || !isImageFile(fileData.file_extension)) {
		return false
	}

	event.preventDefault()
	const pos = getDropPosition(view, event)
	insertProjectImageNode(view, fileData.relative_file_path, documentPath, pos)
	return true
}

/**
 * Handle AttachmentDragData - insert image from project file
 */
function handleAttachmentDragData(
	view: EditorView,
	event: DragEvent,
	data: AttachmentDragData,
	documentPath?: string,
): boolean {
	const fileData = data.data
	if (!fileData || fileData.is_directory || !isImageFile(fileData.file_extension)) {
		return false
	}

	event.preventDefault()
	const pos = getDropPosition(view, event)
	insertProjectImageNode(view, fileData.relative_file_path, documentPath, pos)
	return true
}

/**
 * Handle MultipleFilesDragData - insert multiple images
 */
function handleMultipleFilesDragData(
	view: EditorView,
	event: DragEvent,
	data: MultipleFilesDragData,
	documentPath?: string,
): boolean {
	const imageFiles = data.data.filter(
		(item) => !item.is_directory && isImageFile(item.file_extension),
	)

	if (imageFiles.length === 0) {
		return false
	}

	event.preventDefault()
	const pos = getDropPosition(view, event)

	if (pos) {
		const { state } = view
		const $pos = state.doc.resolve(pos)
		view.dispatch(state.tr.setSelection(TextSelection.near($pos)))

		// Insert all image files sequentially
		imageFiles.forEach((file) => {
			insertProjectImageNode(view, file.relative_file_path, documentPath)
		})
	}

	return true
}

/**
 * Handle custom drag data (Tab, Attachment, or MultipleFiles)
 * @param documentPath - Current document path for calculating relative paths
 * @returns boolean if handled, null if no custom data found
 */
export function handleCustomDragData(
	view: EditorView,
	event: DragEvent,
	documentPath?: string,
): boolean | null {
	const customData = event.dataTransfer?.getData("text/plain")
	if (!customData) {
		return null
	}

	try {
		const parsedData = JSON.parse(customData) as
			| TabDragData
			| AttachmentDragData
			| MultipleFilesDragData

		let result = null
		switch (parsedData.type) {
			case DRAG_TYPE.Tab:
				result = handleTabDragData(view, event, parsedData, documentPath)
				break
			case DRAG_TYPE.ProjectFile:
				result = handleAttachmentDragData(view, event, parsedData, documentPath)
				break
			case DRAG_TYPE.MultipleFiles:
				result = handleMultipleFilesDragData(view, event, parsedData, documentPath)
				break
			default:
				break
		}

		if (result === false) {
			magicToast.error(t("projectImage.errors.unsupportedFileType", { ns: "tiptap" }))
		}

		// If handled, return true
		return true
	} catch (error) {
		console.error("Error parsing drag data:", error)
		return false
	}
}
