import { useMemo } from "react"
import type { AttachmentItem } from "./types"
import { resolveFilePresentation } from "../utils/file-presentation"

/** React 边界只组合调用方的作用域与快照；不隐式访问全局项目。 */
export function useFilePresentation(
	item: AttachmentItem,
	options: Parameters<typeof resolveFilePresentation>[1] = {},
) {
	const { context, index, skillKind, path } = options
	return useMemo(
		() => resolveFilePresentation(item, { context, index, skillKind, path }),
		[item, context, index, skillKind, path],
	)
}
