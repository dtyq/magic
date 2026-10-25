import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin/types"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import type { ResolveCanvasResourceReference } from "../../../public/resource-reference"
import { resolveCanvasStorageResourceReference } from "../../shared/path/canvasResourcePath"

/**
 * Expand canvas-relative mention paths (`./images/x.png`) to workspace paths
 * (`/画布名/images/x.png`) and attach structured attachment ids when available.
 * This keeps SuperMagic paste rematch unique across multiple canvases that share
 * the same relative resource layout.
 */
export function enrichCanvasMentionForClipboard(
	attrs: TiptapMentionAttributes,
	resolveResourceReference?: ResolveCanvasResourceReference,
): TiptapMentionAttributes {
	if (!resolveResourceReference) return attrs
	if (attrs.type !== MentionItemType.PROJECT_FILE && attrs.type !== MentionItemType.UPLOAD_FILE) {
		return attrs
	}

	const data =
		attrs.data && typeof attrs.data === "object"
			? (attrs.data as Record<string, unknown>)
			: null
	if (!data) return attrs

	const path = String(data.file_path || data.relative_file_path || "").trim()
	if (!path) return attrs

	const resolution = resolveCanvasStorageResourceReference(path, resolveResourceReference)
	if (resolution.status !== "resolved" || !resolution.workspacePath) return attrs

	return {
		...attrs,
		data: {
			...data,
			file_path: resolution.workspacePath,
			relative_file_path: resolution.workspacePath,
			...(resolution.attachmentId ? { file_id: resolution.attachmentId } : {}),
		},
	}
}
