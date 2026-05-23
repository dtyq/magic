import type { AttachmentItem } from "../hooks/types"

/** Stable row key for attachment tree nodes (selection, navigation, hierarchy). */
export function getAttachmentKey(item: AttachmentItem): string {
	return (
		item.file_id ||
		item.relative_file_path ||
		item.path ||
		`${item.parent_id || "root"}:${item.file_name || item.filename || item.name || "attachment"}`
	)
}

/** Visible children only — hidden nodes are excluded from mobile file UI. */
export function getVisibleAttachmentChildren(item?: AttachmentItem): AttachmentItem[] {
	return (item?.children || []).filter((child) => !child?.is_hidden)
}

export function getAttachmentDisplayName(item: AttachmentItem): string {
	return item.display_filename || item.file_name || item.filename || item.name || ""
}
