import type { ReferenceResourcePanelItem } from "../../../public/props"
import type { ResolveCanvasResourceReference } from "../../../public/resource-reference"
import { areCanvasResourceReferencesSame } from "../../../runtime/shared/path/canvasResourcePath"
import type { MessageEditorMentionMatcher } from "../message/MessageEditor"

/** 创建仅按 Canvas canonical resource identity 匹配的 mention matcher。 */
export function createCanvasMentionPathMatcher(
	path?: string,
	resolveResourceReference?: ResolveCanvasResourceReference,
): MessageEditorMentionMatcher {
	return (item: ReferenceResourcePanelItem) => {
		const mentionedPath = item.data?.file_path
		return Boolean(
			path &&
			mentionedPath &&
			areCanvasResourceReferencesSame(mentionedPath, path, resolveResourceReference),
		)
	}
}
