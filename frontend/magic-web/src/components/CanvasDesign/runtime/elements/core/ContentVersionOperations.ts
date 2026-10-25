/**
 * Content 版本操作能力。
 *
 * UI 只依赖这组语义操作，不直接修改 element.contents，
 * 以便各媒体元素在切换、设主版本和删除时保留自己的资源清理逻辑。
 */
export interface ContentVersionOperations {
	switchActiveContent(contentId: string): boolean
	setMainContent(contentId: string): boolean
	deleteActiveContent(): boolean | Promise<boolean>
}

export function isContentVersionOperations(value: unknown): value is ContentVersionOperations {
	if (!value || typeof value !== "object") return false
	const operations = value as Partial<ContentVersionOperations>
	return (
		typeof operations.switchActiveContent === "function" &&
		typeof operations.setMainContent === "function" &&
		typeof operations.deleteActiveContent === "function"
	)
}
