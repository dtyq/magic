/**
 * SaveImageToProject Extension
 *
 * This extension handles image upload to project storage with smart error handling.
 *
 * Error Handling Strategy:
 * ========================
 *
 * Two types of errors with different handling strategies:
 *
 * 1. Validation Errors (Cannot Retry):
 *    - Invalid file format (not an image)
 *    - File size exceeds limit
 *    Action: Remove the image node immediately and clean up all caches
 *    Rationale: User must fix the file before uploading again
 *
 * 2. Upload Errors (Can Retry):
 *    - Network connection issues
 *    - Server errors
 *    - Storage service unavailable
 *    Action: Keep the node with error state and file cache for retry
 *    Rationale: Temporary issues that might be resolved
 *
 * Upload Flow:
 * ============
 * 1. Insert placeholder node with temp src
 * 2. Validate file (format, size)
 * 3. Upload to storage with progress tracking
 * 4. Update node with final path on success
 * 5. Handle errors according to error type
 */
import { Extension } from "@tiptap/react"
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import type { ProjectImageStorageInterface } from "@/services/tiptap-image-project"
import { normalizeImageName } from "@/services/tiptap-image-storage"
import { handleCustomDragData } from "./drag-handlers"
import { calculateRelativePath } from "@/utils/path"
import { generateTempSrc, isTempPath } from "./temp-path-utils"
import { normalizeImagePath } from "./utils/url-utils"

// Global cache for files being uploaded
const uploadingFiles = new Map<string, File>()

// Global cache for abort controllers
const uploadControllers = new Map<string, AbortController>()

export interface SaveImageToProjectOptions {
	/**
	 * Image storage implementation
	 */
	imageStorage: ProjectImageStorageInterface

	/**
	 * Project ID (required)
	 */
	projectId: string

	/**
	 * Current document path (relative to project root)
	 * Used to calculate relative paths from document to images
	 * @example "./docs/guide.md"
	 */
	documentPath?: string

	/**
	 * Folder path for images in project
	 * If not provided, will automatically use an 'images' folder at the same level as documentPath
	 * @default undefined (auto-calculated based on documentPath)
	 */
	folderPath?: string

	/**
	 * Maximum file size in bytes
	 * @default 5 * 1024 * 1024 (5MB)
	 */
	maxSize?: number

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
	onSuccess?: (relativePath: string) => void
}

const saveImageToProjectPluginKey = new PluginKey("saveImageToProject")

/**
 * Error types for image upload
 * Exported for use in other components that handle project images
 */
export enum ImageUploadErrorType {
	// Validation errors - cannot retry, should remove node
	INVALID_FILE = "tiptap:projectImage.errors.invalidFile",
	FILE_TOO_LARGE = "tiptap:projectImage.errors.fileTooLarge",
	UNSUPPORTED_FILE_TYPE = "tiptap:projectImage.errors.unsupportedFileType",

	// Configuration errors
	PROJECT_ID_REQUIRED = "tiptap:projectImage.errors.projectIdRequired",

	// Upload errors - can retry, keep node with error state
	UPLOAD_FAILED = "tiptap:projectImage.errors.uploadFailed",
	NETWORK_ERROR = "tiptap:projectImage.errors.networkError",
	STORAGE_UNAVAILABLE = "tiptap:projectImage.errors.storageUnavailable",

	// Runtime errors
	LOAD_FAILED = "tiptap:projectImage.errors.loadFailed",
	PATH_NOT_FOUND = "tiptap:projectImage.errors.pathNotFound",
	UPLOAD_CANCELLED = "tiptap:projectImage.errors.uploadCancelled",
}

/**
 * Check if error is a validation error that should remove the node
 * Validation errors are typically client-side checks that fail before upload
 */
function isValidationError(errorMessage: string): boolean {
	return (
		errorMessage === ImageUploadErrorType.INVALID_FILE ||
		errorMessage === ImageUploadErrorType.FILE_TOO_LARGE ||
		errorMessage === ImageUploadErrorType.UNSUPPORTED_FILE_TYPE
	)
}

/**
 * Validate image file
 * @throws {Error} Throws validation errors that should remove the node
 */
function validateImageFile(file: File, maxSize: number): void {
	if (!file.type.startsWith("image/")) {
		throw new Error(ImageUploadErrorType.INVALID_FILE)
	}

	if (file.size > maxSize) {
		throw new Error(ImageUploadErrorType.FILE_TOO_LARGE)
	}
}

/**
 * Update node upload status
 */
function updateNodeUploadStatus(
	view: EditorView,
	tempSrc: string,
	status: {
		uploading?: boolean
		uploadProgress?: number
		uploadError?: string | null
		src?: string
	},
) {
	const { state } = view
	const tr = state.tr
	let updated = false

	state.doc.descendants((node, pos) => {
		if (node.type.name === "image" && node.attrs.src === tempSrc) {
			tr.setNodeMarkup(pos, undefined, {
				...node.attrs,
				...status,
			})
			updated = true
			return false
		}
		return true
	})

	if (updated) {
		view.dispatch(tr)
	}
}

/**
 * Remove node by temp src
 */
function removeNodeByTempSrc(view: EditorView, tempSrc: string) {
	const { state } = view
	const tr = state.tr
	let removed = false

	state.doc.descendants((node, pos) => {
		if (node.type.name === "image" && node.attrs.src === tempSrc) {
			tr.delete(pos, pos + node.nodeSize)
			removed = true
			return false
		}
		return true
	})

	if (removed) {
		view.dispatch(tr)
	}
}

/**
 * Calculate folder path based on document path
 * If folderPath is not provided, create an 'images' folder at the same level as the document
 */
function calculateFolderPath(
	documentPath: string | undefined,
	providedFolderPath: string | undefined,
): string {
	// If folderPath is explicitly provided, use it
	if (providedFolderPath !== undefined) {
		return providedFolderPath
	}

	// If documentPath is provided, calculate folder path as sibling 'images' folder
	if (documentPath) {
		// Normalize path separators to forward slash
		const normalizedPath = documentPath.replace(/\\/g, "/")

		// Get directory part of documentPath (remove filename)
		const lastSlashIndex = normalizedPath.lastIndexOf("/")

		if (lastSlashIndex === -1) {
			// No directory separator, file is in root
			return "images"
		}

		const directory = normalizedPath.substring(0, lastSlashIndex)

		// Handle edge case where directory might be empty or just '.'
		if (directory === "" || directory === ".") {
			return "images"
		}

		return `${directory}/images`
	}

	// Default fallback
	return "images"
}

/**
 * Handle single image file upload
 *
 * Error handling strategy:
 * 1. Validation errors (file too large, invalid format):
 *    - Remove the image node immediately
 *    - Clean up all caches
 *    - Cannot retry
 *
 * 2. Upload errors (network issues, server errors):
 *    - Keep the node with error state
 *    - Keep file cache for retry
 *    - Can retry later
 *
 * @param file - The image file to upload
 * @param tempSrc - Temporary src identifier for the image node
 * @param view - Editor view instance
 * @param options - Upload options
 */
async function handleSingleImageUpload(
	file: File,
	tempSrc: string,
	view: EditorView,
	options: SaveImageToProjectOptions,
): Promise<void> {
	const {
		imageStorage,
		projectId,
		folderPath: providedFolderPath,
		documentPath,
		maxSize = 5 * 1024 * 1024,
		onError,
		onSuccess,
	} = options

	// Calculate actual folder path
	const folderPath = calculateFolderPath(documentPath, providedFolderPath)

	try {
		// Validate file
		validateImageFile(file, maxSize)

		// Normalize file name before uploading
		const normalizedFileName = normalizeImageName(file.name)
		// Create a new File object with normalized name
		const normalizedFile = new File([file], normalizedFileName, {
			type: file.type,
			lastModified: file.lastModified,
		})

		// Create abort controller for cancellation support
		const controller = new AbortController()
		uploadControllers.set(tempSrc, controller)

		// Upload to OSS and save to project with progress tracking
		const result = await imageStorage.uploadImage(normalizedFile, projectId, folderPath, {
			signal: controller.signal,
			onProgress: (progress) => {
				// Update node with upload progress
				updateNodeUploadStatus(view, tempSrc, {
					uploadProgress: progress,
				})
			},
		})

		// Calculate relative path from document to image if documentPath is provided
		let finalPath: string | undefined
		if (options.documentPath && result.relative_file_path) {
			// Use calculateRelativePath to handle all path normalization
			finalPath = calculateRelativePath(options.documentPath, result.relative_file_path)
		} else if (result.relative_file_path) {
			// Normalize path (handles data URLs, http/https, and relative paths)
			finalPath = normalizeImagePath(result.relative_file_path)
		} else {
			finalPath = result.relative_file_path
		}

		// Update node to success state
		updateNodeUploadStatus(view, tempSrc, {
			uploading: false,
			uploadError: null,
			src: finalPath,
		})

		// Clean up
		uploadingFiles.delete(tempSrc)
		uploadControllers.delete(tempSrc)

		onSuccess?.(finalPath)
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : ImageUploadErrorType.UPLOAD_FAILED

		// Validation errors: remove node and clean up completely
		// These errors cannot be retried (file too large, invalid format, etc.)
		if (isValidationError(errorMessage)) {
			removeNodeByTempSrc(view, tempSrc)
			uploadingFiles.delete(tempSrc)
			uploadControllers.delete(tempSrc)
		}
		// Upload errors: keep node with error state for retry
		// These errors might be temporary (network issues, server problems, etc.)
		else {
			updateNodeUploadStatus(view, tempSrc, {
				uploading: false,
				uploadError: errorMessage,
			})
			// Clean up controller but keep file for retry
			uploadControllers.delete(tempSrc)
		}

		// Notify error handler
		onError?.(error instanceof Error ? error : new Error(ImageUploadErrorType.UPLOAD_FAILED))
	}
}

/**
 * Handle image files and insert them into the editor
 */
async function handleImageFiles(
	files: File[],
	view: EditorView,
	options: SaveImageToProjectOptions,
): Promise<boolean> {
	const imageFiles = files.filter((file) => file.type.startsWith("image/"))

	console.log("imageFiles", imageFiles, options)

	if (imageFiles.length === 0) {
		return false
	}

	const { imageStorage, projectId, onError, onStorageUnavailable } = options

	// Check if projectId is provided
	if (!projectId) {
		onError?.(new Error(ImageUploadErrorType.PROJECT_ID_REQUIRED))
		return true
	}

	// Check storage availability
	try {
		const isAvailable = await imageStorage.checkAvailability()

		if (!isAvailable) {
			onStorageUnavailable?.()
			return true // Handled, but failed
		}
	} catch (error) {
		onError?.(
			error instanceof Error ? error : new Error(ImageUploadErrorType.STORAGE_UNAVAILABLE),
		)
		return true
	}

	// Get current selection position
	const { state } = view
	const { from } = state.selection

	// Process each image file
	for (const file of imageFiles) {
		// Generate temporary src
		const tempSrc = generateTempSrc(file.name)

		// Save file for retry
		uploadingFiles.set(tempSrc, file)

		// Insert placeholder node immediately
		const tr = view.state.tr
		const node = view.state.schema.nodes.image?.create({
			src: tempSrc,
			uploading: true,
			uploadProgress: 0,
		})

		if (node) {
			tr.insert(from, node)
			view.dispatch(tr)

			// Start upload asynchronously
			handleSingleImageUpload(file, tempSrc, view, options)
		} else {
			onError?.(new Error(ImageUploadErrorType.UPLOAD_FAILED))
		}
	}

	return true
}

/**
 * Tiptap extension for saving images to project
 * Intercepts paste and drop events, uploads images to OSS, and inserts project image nodes
 */
export const SaveImageToProjectExtension = Extension.create<SaveImageToProjectOptions>({
	name: "saveImageToProject",

	addOptions() {
		return {
			imageStorage: {} as ProjectImageStorageInterface,
			projectId: "",
			documentPath: undefined,
			folderPath: undefined,
			maxSize: 5 * 1024 * 1024, // 5MB
			onError: undefined,
			onStorageUnavailable: undefined,
			onSuccess: undefined,
		}
	},

	addProseMirrorPlugins() {
		// Capture options in closure to ensure they're available when plugins are created
		const options = this.options
		const editor = this.editor

		return [
			new Plugin({
				key: saveImageToProjectPluginKey,

				props: {
					handlePaste(view, event) {
						let hasHandledContent = false
						const clipboardData = event.clipboardData

						// Check for actual image files first
						const files = Array.from(clipboardData?.files || [])
						const imageFiles = files.filter((file) => file.type.startsWith("image/"))

						// If there are image files, handle them
						if (imageFiles.length > 0) {
							event.preventDefault()
							handleImageFiles(files, view, options)
							hasHandledContent = true
							return true
						}

						// Get HTML and plain text content
						const html = clipboardData?.getData("text/html") || ""
						const plainText = clipboardData?.getData("text/plain") ?? ""
						const markdownText = clipboardData?.getData("text/markdown") ?? ""

						// Check for base64 images in HTML content
						// This prevents pasting non-image files with base64 thumbnails
						// Only block if we haven't already handled real image files
						if (!hasHandledContent) {
							// First, check if plain text contains markdown image syntax
							// This should be checked regardless of HTML content
							const hasMarkdownImage = /!\[.*?\]\(.*?\)/.test(plainText)
							const hasMarkdownText = markdownText.trim().length > 0

							// If markdown syntax is detected, insert content using editor commands
							// This will allow Markdown extension's transformPastedText to process it
							if (hasMarkdownImage || hasMarkdownText) {
								// Prevent default paste to avoid HTML being inserted
								event.preventDefault()

								// Use the text that contains markdown syntax
								const textToPaste = markdownText.trim() || plainText

								// Use editor commands to insert content, which will trigger Markdown extension
								if (editor) {
									// Use chain API to ensure the operation is added to history
									editor.chain().focus().insertContent(textToPaste).run()
								} else {
									// Fallback to pasteText if editor instance is not available
									view.pasteText(textToPaste)
								}

								return true
							}

							// Check for base64 images in HTML content
							const hasImgTag = html.includes("<img")
							const hasDataImage = html.includes("data:image")

							if (hasImgTag && hasDataImage) {
								const hasValidTextContent = plainText.trim().length > 0

								// If there's plain text but no markdown syntax, use pasteText
								if (hasValidTextContent) {
									event.preventDefault()
									view.pasteText(plainText)
									return true
								}

								// Block base64 image if no valid text content
								event.preventDefault()
								return true
							}
						}

						return hasHandledContent
					},

					handleDrop(view, event, _slice, moved) {
						if (moved) return false

						// 1. 首先检查是否有自定义数据

						const result = handleCustomDragData(view, event, options.documentPath)

						if (result !== null) {
							return true
						}

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
			// Plugin to clean up when nodes are deleted
			new Plugin({
				key: new PluginKey("cleanupUploadOnDelete"),
				appendTransaction: (transactions, _oldState, newState) => {
					// Collect temp srcs from old state
					const oldTempSrcs = new Set<string>()
					_oldState.doc.descendants((node) => {
						if (node.type.name === "image" && node.attrs.src) {
							const src = node.attrs.src
							if (isTempPath(src)) {
								oldTempSrcs.add(src)
							}
						}
					})

					// Collect temp srcs from new state
					const newTempSrcs = new Set<string>()
					newState.doc.descendants((node) => {
						if (node.type.name === "image" && node.attrs.src) {
							const src = node.attrs.src
							if (isTempPath(src)) {
								newTempSrcs.add(src)
							}
						}
					})

					// Find deleted temp srcs (exist in old state but not in new state)
					let hasChanges = false
					oldTempSrcs.forEach((src) => {
						if (!newTempSrcs.has(src)) {
							// Node was deleted, clean up
							const controller = uploadControllers.get(src)
							controller?.abort()

							// Clean up caches
							uploadingFiles.delete(src)
							uploadControllers.delete(src)

							hasChanges = true
						}
					})

					return hasChanges ? null : null
				},
			}),
		]
	},

	addCommands() {
		// Capture options in closure to ensure they're available when commands are created
		const options = this.options

		return {
			insertProjectImageFromFile:
				(file: File) =>
					({ view }) => {
						handleImageFiles([file], view, options)
						return true
					},

			/**
			 * Insert a project image from an existing path
			 * The path will be calculated relative to the current document if documentPath is provided
			 */
			insertProjectImageFromPath:
				(imagePath: string) =>
					({ view, tr }) => {
						const { documentPath } = options

						// Calculate relative path if documentPath is provided
						let finalPath: string
						if (documentPath && imagePath) {
							finalPath = calculateRelativePath(documentPath, imagePath)
						} else {
							// Normalize path (handles data URLs, http/https, and relative paths)
							finalPath = normalizeImagePath(imagePath)
						}

						// Get current selection position
						const { from } = view.state.selection

						// Create image node
						const node = view.state.schema.nodes.image?.create({
							src: finalPath,
							uploading: false,
							uploadProgress: undefined,
							uploadError: null,
						})

						if (!node) return false

						// Insert node at current position
						tr.insert(from, node)
						view.dispatch(tr)

						return true
					},
		}
	},

	addStorage() {
		// Capture options in closure to ensure they're available when storage is created
		const options = this.options

		return {
			// Store projectId and documentPath for easy access
			projectId: options.projectId,
			documentPath: options.documentPath,

			/**
			 * Retry upload for a failed image
			 */
			retryUpload: async (tempSrc: string, view: EditorView) => {
				const file = uploadingFiles.get(tempSrc)
				if (!file) {
					throw new Error("File not found for retry")
				}

				// Clear error status and set uploading
				updateNodeUploadStatus(view, tempSrc, {
					uploadError: null,
					uploading: true,
					uploadProgress: 0,
				})

				// Retry upload
				await handleSingleImageUpload(file, tempSrc, view, options)
			},

			/**
			 * Clear file cache
			 */
			clearFile: (tempSrc: string) => {
				uploadingFiles.delete(tempSrc)
				uploadControllers.delete(tempSrc)
			},

			/**
			 * Get uploading files count
			 */
			getUploadingCount: () => {
				return uploadingFiles.size
			},
		}
	},
})

declare module "@tiptap/react" {
	interface Commands<ReturnType> {
		saveImageToProject: {
			/**
			 * Insert a project image from a file
			 */
			insertProjectImageFromFile: (file: File) => ReturnType

			/**
			 * Insert a project image from an existing path
			 * The path will be calculated relative to the current document if documentPath is provided
			 */
			insertProjectImageFromPath: (imagePath: string) => ReturnType
		}
	}
}

declare module "@tiptap/core" {
	interface EditorStorage {
		saveImageToProject: {
			projectId: string
			documentPath?: string
			retryUpload: (tempSrc: string, view: EditorView) => Promise<void>
			clearFile: (tempSrc: string) => void
			getUploadingCount: () => number
		}
	}
}

export default SaveImageToProjectExtension
