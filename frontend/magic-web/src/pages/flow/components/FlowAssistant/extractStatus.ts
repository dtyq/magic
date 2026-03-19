/**
 * 提取状态信息并替换状态标记
 * @param content 原始内容
 * @returns 处理后的内容
 */
export const extractStatus = (content: string): string => {
	let updatedContent = content
	// 添加调试日志
	console.log("处理状态标记, 原始内容长度:", content.length)

	// 状态标记的正则表达式
	const statusRegex = /<!-- STATUS_START -->([\s\S]*?)<!-- STATUS_END -->/g

	// 检查是否包含状态标记
	const hasStartTag = content.includes("<!-- STATUS_START -->")
	const hasEndTag = content.includes("<!-- STATUS_END -->")
	console.log("状态标记检查:", { hasStartTag, hasEndTag })

	// 处理完整的状态标记
	let statusMatch
	while ((statusMatch = statusRegex.exec(content))) {
		const statusBlock = statusMatch[0] // 完整匹配，包括标记
		const statusText = statusMatch[1].trim() // 仅状态文本
		console.log("提取状态文本:", statusText)

		// 从内容中替换状态块
		updatedContent = updatedContent.replace(statusBlock, statusText)
	}

	// 处理不完整的状态标记
	if (
		updatedContent.includes("<!-- STATUS_START -->") &&
		!updatedContent.includes("<!-- STATUS_END -->")
	) {
		console.log("发现不完整的状态标记")
		const startIndex = updatedContent.indexOf("<!-- STATUS_START -->")
		const endIndex = updatedContent.length

		// 提取状态文本部分，去掉标记
		const statusPart = updatedContent.substring(startIndex, endIndex)
		const statusTextPart = statusPart.replace("<!-- STATUS_START -->", "").trim()

		// 替换不完整的状态块
		updatedContent = updatedContent.substring(0, startIndex) + statusTextPart
	}

	return updatedContent
}

export default extractStatus
