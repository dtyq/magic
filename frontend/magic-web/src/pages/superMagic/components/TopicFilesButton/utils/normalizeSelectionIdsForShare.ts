import type { AttachmentItem } from "../hooks/types"
import { getAttachmentKey, getVisibleAttachmentChildren } from "./getAttachmentKey"
import { collectCascadeSelectionKeys } from "./mobileAttachmentTreeSelection"

/**
 * Collapse fully selected folder subtrees into folder IDs for share UI and API.
 * Mobile multi-select stores descendant file keys only; share sheet expects folder IDs when a whole folder is selected.
 */
export function normalizeSelectionIdsForShare(
	attachments: AttachmentItem[],
	selectedKeys: Set<string>,
): string[] {
	if (selectedKeys.size === 0 || attachments.length === 0) {
		return []
	}

	/**
	 * Post-order walk: when every cascade key under a folder is selected, emit the folder ID only.
	 */
	function visit(node: AttachmentItem): string[] {
		const nodeKey = getAttachmentKey(node)

		if (!node.is_directory) {
			return selectedKeys.has(nodeKey) ? [nodeKey] : []
		}

		const childIds = getVisibleAttachmentChildren(node).flatMap((child) => visit(child))
		const cascadeKeys = collectCascadeSelectionKeys(node)
		const isFullySelected =
			cascadeKeys.length > 0 && cascadeKeys.every((id) => selectedKeys.has(id))

		if (isFullySelected) {
			return nodeKey ? [nodeKey] : []
		}

		return childIds
	}

	return attachments
		.filter((item) => !item?.is_hidden)
		.flatMap((item) => visit(item))
}
