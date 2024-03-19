/**
 * 流处理相关的工具函数
 */

/**
 * 提取SSE数据行中的内容
 * 格式如: data:{"id":"xyz","event":"message","message":{"role":"assistant","content":"内容"}}
 */
export const extractContent = (
	line: string,
): { content: string; isError: boolean; errorInfo: string } => {
	if (!line.startsWith("data:") || line === "data:[DONE]")
		return { content: "", isError: false, errorInfo: "" }

	try {
		const jsonStr = line.substring(5).trim()
		const data = JSON.parse(jsonStr)

		// 检查是否是错误消息
		if (data.event === "error" && data.error_information) {
			return {
				content: "",
				isError: true,
				errorInfo: data.error_information,
			}
		}

		// 尝试从各种可能的位置提取内容
		let content = ""

		if (data.message?.content) {
			content = data.message.content
		} else if (data.type === "message" && data.content) {
			content = data.content
		} else if (typeof data.content === "string") {
			content = data.content
		}

		// 关键改动：不要对内容进行任何处理，原样保留
		// 特别是不要对引号和特殊字符做处理，以免破坏JSON结构
		// 因为内容可能是分块传输的JSON片段

		return { content, isError: false, errorInfo: "" }
	} catch (error) {
		console.error("解析SSE数据行失败:", error, "原始行:", line)
		return { content: "", isError: false, errorInfo: "" }
	}
}

/**
 * 标准化JSON字符串，处理多行格式化的JSON
 * @param json 原始JSON字符串
 * @returns 标准化后的JSON字符串
 */
export const normalizeJson = (json: string): string => {
	// 如果输入就是单行，直接返回
	if (!json.includes("\n")) return json

	try {
		// 尝试解析并重新序列化，会自动处理格式问题
		const parsed = JSON.parse(json)
		return JSON.stringify(parsed)
	} catch (e) {
		console.log("JSON解析失败，尝试手动标准化:", e)

		// 手动清理格式
		const normalized = json
			// 删除注释
			.replace(/\/\/.*$/gm, "")
			// 删除行首和行尾的空白
			.replace(/^\s+|\s+$/gm, "")
			// 将多个空白替换为单个空格
			.replace(/\s+/g, " ")

		return normalized
	}
}

/**
 * 修复JSON属性名，确保使用双引号
 * @param json JSON字符串
 * @returns 修复后的JSON字符串
 */
export const fixJsonPropertyNames = (json: string): string => {
	// 针对常见的JSON属性名不带引号或使用单引号的情况进行修复
	// 匹配：属性名前是{或,后跟冒号的情况
	return (
		json
			// 将不带引号的属性名改为带双引号
			.replace(/([{,]\s*)([a-zA-Z0-9_$]+)(\s*:)/g, '$1"$2"$3')
			// 将单引号包围的属性名改为双引号
			.replace(/([{,]\s*)'([^']+)'(\s*:)/g, '$1"$2"$3')
	)
}

/**
 * 验证JSON字符串中的大括号是否平衡
 * @param json JSON字符串
 * @returns 0表示平衡，正数表示右括号多，负数表示左括号多
 */
export const validateJsonBrackets = (json: string): number => {
	let balance = 0
	let inString = false
	let escapeNext = false

	for (let i = 0; i < json.length; i += 1) {
		const char = json[i]

		// 处理字符串中的引号和转义
		if (char === '"' && !escapeNext) {
			inString = !inString
		} else if (char === "\\" && !escapeNext) {
			escapeNext = true

			continue
		}

		escapeNext = false

		// 只在字符串外计算括号
		if (!inString) {
			if (char === "{") balance += 1
			if (char === "}") balance -= 1
		}
	}

	return balance * -1 // 返回值为0表示平衡，负数表示缺少右括号，正数表示多出右括号
}

/**
 * 移除多余的右括号
 */
export const removeExtraBrackets = (json: string, count: number): string => {
	let result = json
	// 从后向前移除指定数量的右括号
	for (let i = 0; i < count; i += 1) {
		const lastBracketIndex = result.lastIndexOf("}")
		if (lastBracketIndex !== -1) {
			result = result.substring(0, lastBracketIndex) + result.substring(lastBracketIndex + 1)
		}
	}
	return result
}

/**
 * 添加缺失的右括号
 */
export const addMissingBrackets = (json: string, count: number): string => {
	let result = json
	// 在末尾添加指定数量的右括号
	for (let i = 0; i < count; i += 1) {
		result += "}"
	}
	return result
}

/**
 * 尝试修复和解析JSON
 * @param jsonStr JSON字符串
 * @returns 解析后的JSON对象
 */
export const tryParseAndFixJSON = (jsonStr: string): any => {
	// 首先尝试直接解析
	try {
		return JSON.parse(jsonStr)
	} catch (initialError) {
		console.log("初次JSON解析失败，尝试修复:", initialError)
	}

	// 尝试标准化JSON
	let attemptStr = normalizeJson(jsonStr)

	try {
		return JSON.parse(attemptStr)
	} catch (normalizeError) {
		console.log("标准化后JSON解析失败，继续尝试修复:", normalizeError)
	}

	// 检查并修复括号平衡
	const balance = validateJsonBrackets(attemptStr)
	if (balance !== 0) {
		console.log(`检测到JSON括号不平衡，差值: ${balance}`)
		if (balance > 0) {
			attemptStr = removeExtraBrackets(attemptStr, balance)
		} else if (balance < 0) {
			attemptStr = addMissingBrackets(attemptStr, Math.abs(balance))
		}
	}

	// 修复常见格式问题
	attemptStr = attemptStr.replace(/,\s*}/g, "}").replace(/,\s*]/, "]")
	attemptStr = fixJsonPropertyNames(attemptStr)

	// 再次尝试解析
	try {
		return JSON.parse(attemptStr)
	} catch (fixedError) {
		console.log("修复后JSON解析仍然失败:", fixedError)

		// 最后尝试: 针对嵌套结构中常见的错误进行修复
		attemptStr = attemptStr
			// 修复缺少值的属性 如 "key": ,
			.replace(/:\s*,/g, ": null,")
			// 修复结尾缺少值的属性 如 "key":
			.replace(/:\s*}/g, ": null}")
			// 修复多余的逗号 如 [1,2,]
			.replace(/,\s*]/g, "]")

		try {
			return JSON.parse(attemptStr)
		} catch (error) {
			// 所有尝试都失败，抛出原始错误
			console.error("所有JSON修复尝试都失败:", error)
			throw new Error(
				`无法解析JSON: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}
}

/**
 * 提取HTML注释标记中的命令
 */
export const extractCommands = (content: string): { updatedContent: string; commands: any[] } => {
	let updatedContent = content
	const commands: any[] = []

	// 添加调试日志查看原始内容
	console.log("原始内容:", content)

	// 处理完整的命令标记情况 - 更新正则表达式以支持多行内容
	const commandRegex = /<!-- COMMAND_START -->([\s\S]*?)<!-- COMMAND_END -->/g
	let commandMatch

	// 检查是否有命令标记
	const hasCommandStart = content.includes("<!-- COMMAND_START -->")
	const hasCommandEnd = content.includes("<!-- COMMAND_END -->")

	console.log("命令标记检查:", { hasCommandStart, hasCommandEnd })

	while ((commandMatch = commandRegex.exec(content))) {
		try {
			const fullMatch = commandMatch[0] // 完整匹配，包括标记
			const commandJson = commandMatch[1].trim()
			console.log("提取到命令JSON:", commandJson)

			// 使用增强的JSON解析和修复方法
			let command
			try {
				command = tryParseAndFixJSON(commandJson)
				console.log("成功解析命令:", command)
			} catch (parseError) {
				console.error("所有解析尝试都失败:", parseError)
				// 跳过此命令继续处理下一个

				continue
			}

			// 检查是否是确认操作命令
			if (command.type === "confirmOperation") {
				console.log("发现确认操作命令:", command)
				// 替换文本为确认提示而不是"指令数据收集中"
				const confirmMessage = command.message || "请确认是否执行此操作？"
				updatedContent = updatedContent.replace(fullMatch, `${confirmMessage}`)

				// 特别标记确认操作命令
				command.isConfirmationCommand = true
			} else {
				// 其他命令类型使用普通替换
				updatedContent = updatedContent.replace(fullMatch, "指令数据收集中...")
			}

			commands.push(command)
			console.log("替换后内容:", updatedContent)
		} catch (error) {
			console.error("处理命令失败:", error, "原始命令:", commandMatch[1])
		}
	}

	// 检查替换后是否还有命令标记
	const stillHasCommandStart = updatedContent.includes("<!-- COMMAND_START -->")
	console.log("替换后仍有命令开始标记:", stillHasCommandStart)

	// 如果没有完整标记但有开始标记，尝试处理不完整的命令
	if (stillHasCommandStart) {
		console.log("尝试处理不完整的命令")
		// 找到命令开始位置
		const startIndex = updatedContent.indexOf("<!-- COMMAND_START -->")
		// 查找下一个可能的边界(STATUS_START或文本结束)
		const statusIndex = updatedContent.indexOf("<!-- STATUS_START -->", startIndex)
		const endIndex = statusIndex > -1 ? statusIndex : updatedContent.length

		// 提取命令部分并替换
		const commandPart = updatedContent.substring(startIndex, endIndex)
		updatedContent = updatedContent.replace(commandPart, "指令数据收集中")
		console.log("处理不完整命令后的内容:", updatedContent)
	}

	return { updatedContent, commands }
}

/**
 * 提取状态信息
 */
export const extractStatusInline = (content: string): string => {
	let updatedContent = content
	const statusRegex = /<!-- STATUS_START -->([\s\S]*?)<!-- STATUS_END -->/g
	let statusMatch

	while ((statusMatch = statusRegex.exec(content))) {
		// 从显示内容中移除状态部分
		updatedContent = updatedContent.replace(statusMatch[0], statusMatch[1].trim())

		// 记录状态更新
		const statusText = statusMatch[1].trim()
		console.log("状态更新:", statusText)
	}

	return updatedContent
}
