import type { AttachmentItem } from "../../../TopicFilesButton/hooks/types"

export const SLIDES_TEMPLATE_PROJECT_RELOAD_DEBOUNCE_MS = 600

function getAttachmentName(item: AttachmentItem | undefined): string {
	if (!item) return ""
	return item.file_name || item.filename || item.name || item.display_filename || ""
}

function collectSubtreeIdentity(root: AttachmentItem | undefined): string[] {
	if (!root) return []
	const parts: string[] = []
	const visit = (item: AttachmentItem) => {
		parts.push(
			[item.file_id || "", getAttachmentName(item), item.relative_file_path || ""].join(":"),
		)
		for (const child of item.children || []) visit(child)
	}
	visit(root)
	return parts
}

function findManifestFile(root: AttachmentItem | undefined): AttachmentItem | undefined {
	return root?.children?.find(
		(item) => !item.is_directory && getAttachmentName(item) === "template.json",
	)
}

/**
 * Identity of this template folder only.
 * Sibling template writes must not change this key.
 */
export function getSlidesTemplateSyncKey(root: AttachmentItem | undefined): string {
	if (!root) return ""
	const manifest = findManifestFile(root)
	return [
		collectSubtreeIdentity(root).join("|"),
		manifest?.updated_at || "",
		manifest?.file_version || "",
	].join("#")
}
