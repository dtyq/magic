/**
 * 流助手工具函数
 * 提供处理流助手相关的功能
 */

/**
 * 提取流助手消息中的内容
 * @param message 助手消息
 * @returns 提取的内容
 */
export const extractContent = (message: string): string => {
	try {
		if (!message) return ""
		// 处理引号和转义字符
		return message
			.replace(/\\"/g, '"') // 替换转义的双引号
			.replace(/\\n/g, "\n") // 替换转义的换行符
			.replace(/\\t/g, "\t") // 替换转义的制表符
			.replace(/\\\\/g, "\\") // 替换转义的反斜杠
	} catch (error) {
		console.error("提取内容时出错:", error)
		return message || ""
	}
}

/**
 * 解析命令
 * @param command 命令字符串
 * @returns 解析后的命令对象
 */
export const parseCommand = (command: string): any => {
	try {
		if (!command) return null
		return JSON.parse(command)
	} catch (error) {
		console.error("解析命令失败:", error)
		return null
	}
}

/**
 * 处理流数据
 * @param data 流数据
 * @returns 处理后的数据
 */
export const processStreamData = (data: string): { content: string; commands: any[] } => {
	try {
		const lines = data.split("\n").filter((line) => line.trim() !== "")
		let content = ""
		const commands: any[] = []

		for (const line of lines) {
			if (line.startsWith("data:")) {
				const jsonStr = line.substring(5).trim()
				if (jsonStr === "[DONE]") continue

				try {
					const parsedData = JSON.parse(jsonStr)
					if (parsedData.content) {
						content += parsedData.content
					}
					if (parsedData.command) {
						commands.push(parseCommand(parsedData.command))
					}
				} catch (e) {
					console.error("解析流数据行失败:", e)
				}
			}
		}

		return { content, commands }
	} catch (error) {
		console.error("处理流数据失败:", error)
		return { content: "", commands: [] }
	}
}

/**
 * 去重命令
 * @param commands 命令数组
 * @returns 去重后的命令数组
 */
export const deduplicateCommands = (commands: any[]): any[] => {
	if (!commands || commands.length === 0) return []

	const seen = new Set()
	return commands.filter((cmd) => {
		if (!cmd) return false

		// 创建唯一标识，例如：操作类型+节点ID
		const identifier = `${cmd.type || ""}_${cmd.nodeId || ""}_${cmd.nodeType || ""}`
		if (seen.has(identifier)) return false

		seen.add(identifier)
		return true
	})
}

/**
 * 获取打字效果的渐进内容
 * @param fullContent 完整内容
 * @param displayedLength 已显示长度
 * @param charsPerFrame 每帧增加的字符数
 * @returns 显示的内容
 */
export const getTypingEffect = (
	fullContent: string,
	displayedLength: number,
	charsPerFrame: number = 3,
): {
	displayContent: string
	isComplete: boolean
	newLength: number
} => {
	if (!fullContent) {
		return { displayContent: "", isComplete: true, newLength: 0 }
	}

	const newLength = Math.min(displayedLength + charsPerFrame, fullContent.length)
	const displayContent = fullContent.substring(0, newLength)
	const isComplete = newLength >= fullContent.length

	return { displayContent, isComplete, newLength }
}
