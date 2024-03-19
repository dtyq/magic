/**
 * @description: 提取文件路径中的扩展名
 * @param {string} path 文件路径
 * @return {string} 文件扩展名（带点，如 ".mp4"）或空字符串（如果没有扩展名）
 */
export function parseExtname(path: string) {
	// 首先检查是否为空
	if (!path) return ""

	// 检查路径末尾是否为斜杠或反斜杠
	if (path.endsWith("/") || path.endsWith("\\")) return ""

	// 获取最后一个/或\后面的部分
	const fileName = path.split(/[/\\]/).pop() || ""

	// 如果文件名以点开头且没有其他点，返回整个文件名
	if (fileName.startsWith(".") && fileName.indexOf(".", 1) === -1) {
		return fileName
	}

	// 查找最后一个点之后的部分
	const lastDotIndex = fileName.lastIndexOf(".")
	if (lastDotIndex === -1) return "" // 没有扩展名

	return fileName.substring(lastDotIndex)
}
