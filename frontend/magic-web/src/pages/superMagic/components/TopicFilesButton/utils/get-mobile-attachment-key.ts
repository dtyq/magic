import type { AttachmentItem } from "../hooks/types"

/**
 * Stable row key for mobile file tree selection; must match collectSelectedItemIds lookups.
 */
export function getMobileAttachmentKey(item: AttachmentItem): string {
	return (
		item.file_id ||
		item.relative_file_path ||
		item.path ||
		`${item.parent_id || "root"}:${item.file_name || item.filename || item.name || "attachment"}`
	)
}
