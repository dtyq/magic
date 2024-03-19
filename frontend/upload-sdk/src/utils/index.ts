/**
 * 检查fileName中是否存在特殊字符
 * @param fileName
 */
export function checkSpecialCharacters(fileName: string) {
	// 在实现使用中存在
	return fileName.includes("%")
}

/**
 * 获取文件后缀名
 * @param fileName
 */
export function getFileExtension(fileName: string): string {
	const lastDotIndex = fileName.lastIndexOf(".")
	if (lastDotIndex === -1) {
		return "" // 文件名中没有后缀名
	}
	const extension = fileName.substring(lastDotIndex + 1)
	return extension.toLowerCase() // 返回小写的后缀名
}
