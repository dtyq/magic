import { useMemo } from "react"
import { CustomLinkNode } from "../extensions/custom-link-node-extension"
import type { CustomLinkNodeOptions } from "../extensions/custom-link-node-extension"

export interface UseCustomLinkNodeOptions {
	/**
	 * Custom click handler for links
	 */
	onLinkClick?: CustomLinkNodeOptions["onLinkClick"]
	/**
	 * Current document path
	 */
	documentPath?: string
}

/**
 * Hook to create CustomLinkNode extension with configured options
 */
export function useCustomLinkNode(options: UseCustomLinkNodeOptions = {}) {
	const { onLinkClick, documentPath } = options

	return useMemo(
		() =>
			CustomLinkNode.configure({
				openOnClick: false,
				enableClickSelection: true,
				onLinkClick,
				documentPath,
			}),
		[onLinkClick, documentPath],
	)
}
