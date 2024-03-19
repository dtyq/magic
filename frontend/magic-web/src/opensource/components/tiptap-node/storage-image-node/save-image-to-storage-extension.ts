import { Extension } from "@tiptap/react"
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import type { ImageStorageInterface } from "@/opensource/services/tiptap-image-storage"
import { validateImageFile, normalizeImageName } from "@/opensource/services/tiptap-image-storage"

export interface SaveImageToStorageOptions {
	/**
	 * Image storage implementation
	 */
	imageStorage: ImageStorageInterface

	/**
	 * Maximum file size in bytes
	 * @default 5 * 1024 * 1024 (5MB)
	 */
	maxSize?: number

	/**
	 * Number of days until images expire
	 * @default 7
	 */
	expiresInDays?: number

	/**
	 * Error callback
	 */
	onError?: (error: Error) => void

	/**
	 * Storage unavailable callback
	 */
	onStorageUnavailable?: () => void

	/**
	 * Success callback
	 */
	onSuccess?: (id: string) => void
}

const saveImageToStoragePluginKey = new PluginKey("saveImageToStorage")

/**
 * Handle image files and insert them into the editor
 */
async function handleImageFiles(
	files: File[],
	view: EditorView,
	options: SaveImageToStorageOptions,
): Promise<boolean> {
	const imageFiles = files.filter((file) => file.type.startsWith("image/"))

	if (imageFiles.length === 0) {
		return false
	}

	const {
		imageStorage,
		maxSize = 5 * 1024 * 1024,
		expiresInDays = 7,
		onError,
		onStorageUnavailable,
		onSuccess,
	} = options

	// Check storage availability
	try {
		const isAvailable = await imageStorage.checkAvailability()

		if (!isAvailable) {
			onStorageUnavailable?.()
			return true // Handled, but failed
		}
	} catch (error) {
		onError?.(error instanceof Error ? error : new Error("Storage check failed"))
		return true
	}

	// Process each image file
	for (const file of imageFiles) {
		try {
			// Validate file
			validateImageFile(file, maxSize)

			// Normalize file name before saving
			const normalizedFileName = normalizeImageName(file.name)
			// Create a new File object with normalized name
			const normalizedFile = new File([file], normalizedFileName, {
				type: file.type,
				lastModified: file.lastModified,
			})

			// Get current selection position before async operation
			const { state } = view
			const { from } = state.selection

			// Save to storage with expiration (using normalized file)
			const id = await imageStorage.saveImage(normalizedFile, expiresInDays)

			// Get fresh state after async operation and create transaction
			const currentState = view.state
			const tr = currentState.tr

			// Create storage image node
			// Remove extension from normalized name for alt text
			const altText = normalizedFileName.replace(/\.[^/.]+$/, "")

			const node = currentState.schema.nodes.storageImage?.create({
				id,
				alt: altText,
			})

			if (node) {
				// Insert at the saved position instead of current selection
				// This prevents issues if selection changed during async save
				tr.insert(from, node)
				view.dispatch(tr)

				onSuccess?.(id)
			} else {
				throw new Error("storageImage node type not found in schema")
			}
		} catch (error) {
			onError?.(error instanceof Error ? error : new Error("Failed to save image"))
		}
	}

	return true
}

/**
 * Tiptap extension for saving images to storage
 * Intercepts paste and drop events, saves images to IndexedDB, and inserts storage image nodes
 */
export const SaveImageToStorageExtension = Extension.create<SaveImageToStorageOptions>({
	name: "saveImageToStorage",

	addOptions() {
		return {
			imageStorage: {} as ImageStorageInterface,
			maxSize: 5 * 1024 * 1024, // 5MB
			expiresInDays: 7, // 7 days
			onError: undefined,
			onStorageUnavailable: undefined,
			onSuccess: undefined,
		}
	},

	addProseMirrorPlugins() {
		const options = this.options

		return [
			new Plugin({
				key: saveImageToStoragePluginKey,

				props: {
					handlePaste(view, event) {
						// Check for base64 images in HTML content FIRST
						// This prevents pasting non-image files with base64 thumbnails
						const html = event.clipboardData?.getData("text/html") || ""
						if (html.includes("<img") && html.includes("data:image")) {
							event.preventDefault()
							return true
						}

						const files = Array.from(event.clipboardData?.files || [])
						handleImageFiles(files, view, options)
						return false
					},

					handleDrop(view, event, _slice, moved) {
						if (moved) return false

						const files = Array.from(event.dataTransfer?.files || [])
						const hasImages = files.some((file) => file.type.startsWith("image/"))

						if (hasImages) {
							// Prevent default drop behavior for images
							event.preventDefault()

							// Get drop position
							const pos = view.posAtCoords({
								left: event.clientX,
								top: event.clientY,
							})

							if (pos) {
								// Set selection to drop position
								const $pos = view.state.doc.resolve(pos.pos)
								view.dispatch(view.state.tr.setSelection(TextSelection.near($pos)))
							}

							handleImageFiles(files, view, options)
							return true
						}

						return false
					},
				},
			}),
		]
	},

	addCommands() {
		return {
			insertStorageImageFromFile:
				(file: File) =>
				({ view }) => {
					handleImageFiles([file], view, this.options)
					return true
				},
		}
	},
})

declare module "@tiptap/react" {
	interface Commands<ReturnType> {
		saveImageToStorage: {
			/**
			 * Insert a storage image from a file
			 */
			insertStorageImageFromFile: (file: File) => ReturnType
		}
	}
}

export default SaveImageToStorageExtension
