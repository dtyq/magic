/** 全屏预览顶栏：优先使用显式标题，否则从 path 取末段。 */
export function getFullscreenMediaFileLabel(path: string, title?: string): string {
	const trimmed = title?.trim()
	if (trimmed) return trimmed
	const segments = path.split("/").filter(Boolean)
	const last = segments.at(-1)
	return last ?? path
}
