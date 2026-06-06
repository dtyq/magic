import { getAppEntryFile } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"

export interface AudioAttachmentNode {
	file_id?: string
	is_directory?: boolean
	display_config?: { type?: string; [key: string]: unknown }
	children?: AudioAttachmentNode[]
	[key: string]: unknown
}

/**
 * Walks the attachment tree and returns the index.html entry for the first audio display folder.
 * Used by the recordings detail page to open bundled HTML preview without the file tree.
 */
export function findAudioEntryFile(tree: AudioAttachmentNode[]): AudioAttachmentNode | null {
	for (const item of tree) {
		if (item.is_directory && item.display_config?.type === "audio") {
			const entry = getAppEntryFile(item.children || [], item.display_config)
			if (entry) {
				return {
					...entry,
					display_config: entry.display_config || item.display_config,
				}
			}
		}

		if (item.children?.length) {
			const nested = findAudioEntryFile(item.children)
			if (nested) return nested
		}
	}

	return null
}
