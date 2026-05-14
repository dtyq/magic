export function ensureFileName(fileName: string): string {
	return fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`
}

export function downloadBlobFile(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob)
	const anchor = document.createElement("a")
	anchor.href = url
	anchor.download = ensureFileName(fileName)
	anchor.click()
	setTimeout(() => URL.revokeObjectURL(url), 0)
}
