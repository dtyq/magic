export function getFileExtension(fileName?: string): string {
	return fileName?.split(".").pop()?.toLowerCase() || ""
}

export function isMarkdownFileName(fileName?: string): boolean {
	const ext = getFileExtension(fileName)
	return ext === "md" || ext === "markdown"
}
