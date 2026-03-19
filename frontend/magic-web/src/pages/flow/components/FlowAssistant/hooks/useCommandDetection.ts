import { useCallback } from "react"

interface UseCommandDetectionResult {
	detectCommands: (content: string) => {
		updatedContent: string
		hasCommands: boolean
		commandCount: number
	}
	processCommandMarkers: (content: string, isCollectingCommand: boolean) => string
}

/**
 * 自定义Hook，用于检测和处理消息内容中的命令标记
 */
export function useCommandDetection(): UseCommandDetectionResult {
	/**
	 * 检测消息内容中的命令标记
	 * @param content 消息内容
	 * @returns 处理后的内容、是否包含命令、命令数量
	 */
	const detectCommands = useCallback((content: string) => {
		const updatedContent = content || ""
		let hasCommands = false

		// 找出所有命令标记
		const commandStartRegex = /<!-- COMMAND_START -->/g
		const commandMatches = [...updatedContent.matchAll(commandStartRegex)]
		const commandCount = commandMatches.length

		hasCommands = commandCount > 0

		return {
			updatedContent,
			hasCommands,
			commandCount,
		}
	}, [])

	/**
	 * 处理命令标记，根据收集状态决定如何显示内容
	 * @param content 原始内容
	 * @param isCollectingCommand 是否正在收集命令
	 * @returns 处理后的内容
	 */
	const processCommandMarkers = useCallback((content: string, isCollectingCommand: boolean) => {
		let processedContent = content || ""

		if (isCollectingCommand) {
			// 收集命令阶段，只显示命令标记之前的内容
			const commandStartIndex = processedContent.indexOf("<!-- COMMAND_START -->")
			if (commandStartIndex >= 0) {
				processedContent = processedContent.substring(0, commandStartIndex)
			}
		} else if (processedContent.includes("<!-- COMMAND_START -->")) {
			// 不在收集命令阶段，但内容中有命令标记，则替换为指令数据收集中
			while (processedContent.includes("<!-- COMMAND_START -->")) {
				const startIndex = processedContent.indexOf("<!-- COMMAND_START -->")
				let endIndex

				// 查找结束标记或下一个状态标记
				const endTagIndex = processedContent.indexOf("<!-- COMMAND_END -->", startIndex)
				const statusIndex = processedContent.indexOf("<!-- STATUS_START -->", startIndex)
				const nextCommandIndex = processedContent.indexOf(
					"<!-- COMMAND_START -->",
					startIndex + 1,
				)

				if (endTagIndex > -1) {
					// 找到结束标记
					endIndex = endTagIndex + "<!-- COMMAND_END -->".length
				} else if (
					statusIndex > -1 &&
					(nextCommandIndex === -1 || statusIndex < nextCommandIndex)
				) {
					// 找到状态标记
					endIndex = statusIndex
				} else if (nextCommandIndex > -1) {
					// 找到下一个命令标记
					endIndex = nextCommandIndex
				} else {
					// 都没找到，尝试查找JSON结构
					const jsonStartIndex = processedContent.indexOf("{", startIndex)
					if (jsonStartIndex > -1) {
						// 查找匹配的最后一个}
						let bracketCount = 1
						let i = jsonStartIndex + 1
						for (; i < processedContent.length; i += 1) {
							if (processedContent[i] === "{") bracketCount += 1
							else if (processedContent[i] === "}") {
								bracketCount -= 1
								if (bracketCount === 0) break
							}
						}
						endIndex = i + 1
					} else {
						// 没找到JSON，使用命令标记后的所有内容
						endIndex = processedContent.length
					}
				}

				// 替换命令部分为指令数据收集中
				if (endIndex > startIndex) {
					processedContent = `${processedContent.substring(
						0,
						startIndex,
					)}指令数据收集中${processedContent.substring(endIndex)}`
				}
			}
		}

		return processedContent
	}, [])

	return {
		detectCommands,
		processCommandMarkers,
	}
}

export default useCommandDetection
