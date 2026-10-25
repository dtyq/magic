import { safeDecodeURIComponent } from "@/utils/encoding"

export { findAttachmentByPath } from "@/pages/superMagic/utils/markdownFileReference"

/**
 * XMarkdown 会把中文 URL 转义，这里还原成中文路径。
 */
export function decodePathForDisplay(path: string): string {
	if (!path) return ""

	return safeDecodeURIComponent(path)
}
