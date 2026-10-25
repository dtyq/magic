/** PPT 页面列表的持久化操作。普通 PPT 和模板目录分别提供实现。 */
export interface PPTSlideStructureAdapter {
	reorder(slidePaths: string[]): Promise<void>
	insert(input: { position: number; direction: "before" | "after" }): Promise<{
		filePath: string
		fileId: string
		content: string
	}>
	duplicate(input: { slidePath: string; position: number }): Promise<{
		filePath: string
		fileId: string
		content: string
	}>
	remove(slidePath: string): Promise<void>
	rename(slidePath: string, nextName: string): Promise<string>
	/** Optional lookup used to rebind a path after a best-effort rollback creates a replacement file. */
	getFileId?(slidePath: string): string | undefined
}
