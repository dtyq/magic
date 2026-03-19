import type { EditorState, Transaction } from "@tiptap/pm/state"
import type { NodeType } from "@tiptap/pm/model"
import { parseStorageImageTitle } from "./storage-image-metadata"

interface ConvertImagesOptions {
	state: EditorState
	tr: Transaction
	storageImageType: NodeType | null | undefined
	logger?: Pick<typeof console, "log" | "error">
}

/**
 * Convert images to storage images
 * Automatically detects markdown images with storage:// protocol and converts them to storageImage nodes
 * @param param0 {
 *   state: EditorState
 *   tr: Transaction
 *   storageImageType: NodeType | null | undefined
 *   logger?: Pick<typeof console, "log" | "error">
 * }
 * @returns {boolean} - true if any modifications were made
 */
export function convertImagesToStorageImages({
	state,
	tr,
	storageImageType,
	logger = console,
}: ConvertImagesOptions): boolean {
	if (!storageImageType) {
		logger.error("[StorageImage] Missing storageImage node type in schema.")
		return false
	}

	let modified = false
	const replacements: Array<{ pos: number; node: any; nodeSize: number }> = []

	state.doc.descendants((node, pos) => {
		// Only process standard image nodes
		if (node.type.name !== "image") {
			return
		}

		const { src, alt, title } = node.attrs

		// Check if this is a storage image (storage:// protocol)
		if (!src || typeof src !== "string" || !src.startsWith("storage://")) {
			return
		}

		// Extract storage ID from URL
		const id = src.replace("storage://", "").split(" ")[0]

		// Parse dimensions from title attribute
		const { width, height } = parseStorageImageTitle(title)

		// Create storage image node
		const storageImageNode = storageImageType.create({
			id,
			alt: alt || null,
			width,
			height,
		})

		if (storageImageNode) {
			replacements.push({
				pos,
				node: storageImageNode,
				nodeSize: node.nodeSize,
			})
			modified = true
		} else {
			logger.error("[StorageImage] Failed to create storageImage node.")
		}
	})

	// Apply all replacements in reverse order to maintain correct positions
	if (replacements.length > 0) {
		replacements.reverse().forEach(({ pos, node, nodeSize }) => {
			tr.replaceRangeWith(pos, pos + nodeSize, node)
		})
	}

	return modified
}
