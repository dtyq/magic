import ChatFileService from "@/opensource/services/chat/file/ChatFileService"
import { Image } from "../image"

export interface ParsedImageInfo {
	file_id?: string
	file_name?: string
	file_size?: string | number
	file_extension?: string
	alt?: string
	title?: string
}

/**
 * Parse HTML content to extract image information with file_id
 * @param html HTML content
 * @returns Array of parsed image information
 */
export function parseImagesFromHTML(html: string): ParsedImageInfo[] {
	if (!html) return []

	try {
		// Create a temporary DOM to parse HTML
		const parser = new DOMParser()
		const doc = parser.parseFromString(html, "text/html")
		const images = Array.from(doc.querySelectorAll("img"))

		console.log("🔍 All images found in HTML:", images.length)
		images.forEach((img, index) => {
			console.log(`Image ${index}:`, {
				file_id: img.getAttribute("file_id"),
				file_name: img.getAttribute("file_name"),
				src: img.getAttribute("src"),
				"data-message-id": img.getAttribute("data-message-id"),
			})
		})

		return images
			.map((img) => {
				const file_id = img.getAttribute("file_id")
				// Only process images with file_id (from chat messages)
				if (!file_id) return null

				return {
					file_id,
					file_name: img.getAttribute("file_name") || undefined,
					file_size: img.getAttribute("file_size") || undefined,
					file_extension: img.getAttribute("file_extension") || undefined,
					alt: img.getAttribute("alt") || undefined,
					title: img.getAttribute("title") || undefined,
				}
			})
			.filter(Boolean) as ParsedImageInfo[]
	} catch (error) {
		console.error("Error parsing images from HTML:", error)
		return []
	}
}

/**
 * Get message ID from HTML content
 * @param html HTML content
 * @returns message ID if found
 */
export function getMessageIdFromHTML(html: string): string | null {
	if (!html) return null

	try {
		const parser = new DOMParser()
		const doc = parser.parseFromString(html, "text/html")

		// First try to get message_id from image data-message-id attribute
		const imageWithMessageId = doc.querySelector("img[data-message-id]")
		if (imageWithMessageId) {
			const messageId = imageWithMessageId.getAttribute("data-message-id")
			if (messageId) return messageId
		}

		// Fallback: Look for element with id="message_copy_${messageId}"
		const messageContainer = doc.querySelector('[id^="message_copy_"]')
		if (messageContainer) {
			const id = messageContainer.getAttribute("id")
			const messageId = id?.replace("message_copy_", "")
			return messageId || null
		}

		return null
	} catch (error) {
		console.error("Error parsing message ID from HTML:", error)
		return null
	}
}

/**
 * Convert parsed image info to editor content
 * @param imageInfo Parsed image information
 * @param messageId Message ID for fetching file URL
 * @returns Promise of image content for editor
 */
export async function convertImageToEditorContent(
	imageInfo: ParsedImageInfo,
	messageId: string,
): Promise<object> {
	if (!imageInfo.file_id) {
		throw new Error("Missing file_id")
	}

	try {
		// Fetch file URL using ChatFileService
		const fileUrls = await ChatFileService.fetchFileUrl([
			{
				file_id: imageInfo.file_id,
				message_id: messageId,
			},
		])

		const fileData = fileUrls[imageInfo.file_id]
		if (!fileData?.url) {
			throw new Error("Failed to get file URL")
		}

		const imageContent = {
			type: Image.name,
			attrs: {
				src: fileData.url,
				file_id: imageInfo.file_id,
				file_name: imageInfo.file_name,
				file_size: imageInfo.file_size,
				file_extension: imageInfo.file_extension,
				alt: imageInfo.alt,
				title: imageInfo.title,
			},
		}

		console.log("✅ Image content created:", imageContent)
		return imageContent
	} catch (error) {
		console.error("❌ Error converting image to editor content:", error)
		throw error
	}
}

/**
 * Process HTML content with mixed text and images, maintaining order
 * @param html Original HTML content
 * @param parsedImages Parsed image information
 * @param messageId Message ID for fetching file URLs
 * @param editor Editor instance
 * @param onPaste Paste handler
 */
export function processHtmlWithImages(
	html: string,
	parsedImages: ParsedImageInfo[],
	messageId: string,
	editor: any,
	onPaste?: (editor: any, files: File[]) => void,
) {
	// Create placeholder map for images
	const imagePlaceholders = new Map<string, ParsedImageInfo>()
	let processedHtml = html

	// Replace each image with a unique placeholder
	parsedImages.forEach((imageInfo, index) => {
		const placeholderId = `magic-image-placeholder-${Date.now()}-${index}`
		const placeholder = `<span class="magic-image-placeholder" data-placeholder-id="${placeholderId}">Loading...</span>`

		// Store the mapping
		imagePlaceholders.set(placeholderId, imageInfo)

		// Replace the first occurrence of an image with this file_id
		const imageRegex = new RegExp(`<img[^>]*file_id=["']${imageInfo.file_id}["'][^>]*>`, "g")
		processedHtml = processedHtml.replace(imageRegex, placeholder)
	})

	// Insert the content with placeholders
	try {
		const parser = new DOMParser()
		const doc = parser.parseFromString(processedHtml, "text/html")
		const content = doc.body.innerHTML
		if (content.trim()) {
			editor.commands.insertContent(content)
		}
	} catch (e) {
		console.error("Failed to parse processed HTML:", e)
		return
	}

	// Asynchronously download and replace each image placeholder
	for (const [placeholderId, imageInfo] of imagePlaceholders) {
		// Don't await here - process all images in parallel
		downloadAndReuploadImage(imageInfo, messageId)
			.then((file) => {
				console.log(`✅ Image ready for placeholder: ${placeholderId}`)
				// Find and replace the placeholder with actual image
				replacePlaceholderWithImage(editor, placeholderId, file, onPaste)
			})
			.catch((error) => {
				console.error(`❌ Error processing image placeholder ${placeholderId}:`, error)
				// Replace placeholder with error message
				replacePlaceholderWithError(editor, placeholderId)
			})
	}
}

/**
 * Replace image placeholder with actual uploaded image
 * @param editor Editor instance
 * @param placeholderId Placeholder ID
 * @param file Downloaded file
 * @param onPaste Paste handler
 */
function replacePlaceholderWithImage(
	editor: any,
	placeholderId: string,
	file: File,
	onPaste?: (editor: any, files: File[]) => void,
) {
	// Get current document content as text to search for placeholder
	const htmlContent = editor.getHTML()
	const placeholderText = "Loading..."

	if (htmlContent.includes(placeholderText)) {
		// Use editor commands to find and replace the placeholder
		const { state } = editor
		const { doc } = state
		let found = false

		// Find the position of the placeholder text
		doc.descendants((node: any, pos: number) => {
			if (found) return false

			if (node.isText && node.text?.includes(placeholderText)) {
				const text = node.text
				const startIdx = text.indexOf(placeholderText)

				if (startIdx !== -1) {
					const from = pos + startIdx
					const to = pos + startIdx + placeholderText.length

					// Focus at the placeholder position
					editor.commands.focus(from)

					// Select the placeholder text
					editor.commands.setTextSelection({ from, to })

					// Delete the selected text
					editor.commands.deleteSelection()

					// Upload and insert the image at current position
					if (onPaste) {
						setTimeout(() => {
							onPaste(editor, [file])
						}, 10) // Small delay to ensure deletion is processed
					}

					found = true
					return false
				}
			}
			return true
		})

		if (!found) {
			console.warn(`Could not find placeholder text in editor`)
			// Fallback: just trigger the upload at current position
			if (onPaste) {
				onPaste(editor, [file])
			}
		}
	} else {
		console.warn(`Placeholder text not found in HTML content`)
		// Fallback: just trigger the upload at current position
		if (onPaste) {
			onPaste(editor, [file])
		}
	}
}

/**
 * Replace image placeholder with error message
 * @param editor Editor instance
 * @param placeholderId Placeholder ID
 */
function replacePlaceholderWithError(editor: any, placeholderId: string) {
	console.log(`❌ Replacing placeholder ${placeholderId} with error message`)

	const htmlContent = editor.getHTML()
	const placeholderText = "Loading..."

	if (htmlContent.includes(placeholderText)) {
		const { state } = editor
		const { doc } = state
		let found = false

		// Find the position of the placeholder text
		doc.descendants((node: any, pos: number) => {
			if (found) return false

			if (node.isText && node.text?.includes(placeholderText)) {
				const text = node.text
				const startIdx = text.indexOf(placeholderText)

				if (startIdx !== -1) {
					const from = pos + startIdx
					const to = pos + startIdx + placeholderText.length

					// Focus at the placeholder position
					editor.commands.focus(from)

					// Select the placeholder text
					editor.commands.setTextSelection({ from, to })

					// Replace with error message
					editor.commands.insertContent("❌ Image failed to load")

					found = true
					return false
				}
			}
			return true
		})
	}
}

/**
 * Download image and convert to File object for reupload
 * @param imageInfo Parsed image information
 * @param messageId Message ID for fetching file URL
 * @returns Promise of File object
 */
export async function downloadAndReuploadImage(
	imageInfo: ParsedImageInfo,
	messageId: string,
): Promise<File> {
	console.log("⬇️ Downloading image for reupload:", { imageInfo, messageId })

	if (!imageInfo.file_id) {
		throw new Error("Missing file_id")
	}

	try {
		// Fetch file URL using ChatFileService
		console.log("📡 Fetching file URL for download:", imageInfo.file_id)
		const fileUrls = await ChatFileService.fetchFileUrl([
			{
				file_id: imageInfo.file_id,
				message_id: messageId,
			},
		])

		console.log("📡 File URLs response for download:", fileUrls)
		const fileData = fileUrls[imageInfo.file_id]
		if (!fileData?.url) {
			throw new Error("Failed to get file URL for download")
		}

		// Download the image
		console.log("⬇️ Downloading image from URL:", fileData.url)
		const response = await fetch(fileData.url)
		if (!response.ok) {
			throw new Error(`Failed to download image: ${response.statusText}`)
		}

		const blob = await response.blob()
		console.log("✅ Image downloaded, blob size:", blob.size)

		// Create File object with original name or generate one
		const fileName =
			imageInfo.file_name || `image_${Date.now()}.${imageInfo.file_extension || "jpg"}`
		const file = new File([blob], fileName, { type: blob.type || "image/jpeg" })

		console.log("✅ File object created:", {
			name: file.name,
			size: file.size,
			type: file.type,
		})

		return file
	} catch (error) {
		console.error("❌ Error downloading and reuploading image:", error)
		throw error
	}
}
