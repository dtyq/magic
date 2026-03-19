// @ts-nocheck
import { useUpdateEffect } from "ahooks"
import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { extractStatus } from "./extractStatus"
import { extractContent, extractCommands } from "./utils/streamUtils"

interface StreamProcessorProps {
	responseBody: ReadableStream<Uint8Array> | null
	messageId: string
	onTextUpdate: (text: string) => void
	onCommandsReceived: (commands: any[]) => void
	onError: (error: string) => void
	onComplete: () => void
	userScrolling: boolean
	onCommandProcessingStatusChange?: (isProcessing: boolean) => void // 新增回调，用于通知父组件指令处理状态
}

// 使用function组件声明方式替代React.FC泛型
function StreamProcessor(props: StreamProcessorProps): React.ReactElement | null {
	const {
		responseBody,
		messageId,
		onTextUpdate,
		onCommandsReceived,
		onError,
		onComplete,
		userScrolling,
		onCommandProcessingStatusChange,
	} = props

	const { t } = useTranslation()
	const [isProcessing, setIsProcessing] = useState(false)
	const completeContentRef = useRef<string>("") // 存储完整内容
	const displayContentRef = useRef<string>("") // 存储当前显示内容
	const newContentBufferRef = useRef<string>("") // 存储新接收但未显示的内容
	const typingTimerRef = useRef<NodeJS.Timeout | null>(null)
	const processingCommandsRef = useRef<boolean>(false)
	const streamProcessingRef = useRef<boolean>(false) // 新增：标记流是否正在处理
	const currentStreamRef = useRef<ReadableStream<Uint8Array> | null>(null) // 新增：记录当前正在处理的流
	const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null) // 新增: 保存reader引用
	const responseBodyIdRef = useRef<string>("") // 用于唯一标识每个流，避免重复处理
	const commandBufferRef = useRef<string>("") // 新增: 存储命令累积缓冲区
	const isCollectingCommandRef = useRef<boolean>(false) // 标记是否正在收集指令数据
	const partialCommandStartRef = useRef<string>("") // 新增: 用于累积可能被分割的命令开始标记
	const partialCommandEndRef = useRef<string>("") // 新增: 用于累积可能被分割的命令结束标记
	const errorDetectedRef = useRef<boolean>(false) // 新增：标记是否检测到错误
	const processedCommandsRef = useRef<Set<string>>(new Set()) // 新增：记录已处理过的命令

	// 打字机效果参数
	const typingSpeedRef = useRef<number>(30) // 字符之间的毫秒延迟
	const typingBatchSizeRef = useRef<number>(2) // 每次更新的字符数

	// 检测可能被分割的命令标记
	const detectPartialMarker = useCallback(
		(text: string, marker: string, accumulatorRef: React.MutableRefObject<string>): boolean => {
			// 当前累积的部分标记
			const accumulated = accumulatorRef.current + text

			// 如果当前累积文本包含完整标记
			if (accumulated.includes(marker)) {
				// 找到标记并重置累积器
				accumulatorRef.current = ""
				return true
			}

			// 检查是否有部分标记匹配
			for (let i = 1; i < marker.length; i += 1) {
				// 尝试不同长度的子字符串，看是否匹配标记的开头部分
				const potentialPartial = marker.substring(0, i)
				if (accumulated.endsWith(potentialPartial)) {
					// 找到潜在的部分匹配，更新累积器
					accumulatorRef.current = potentialPartial
					return false
				}
			}

			// 检查文本是否可能是标记的中间部分
			for (let i = 1; i < marker.length - 1; i += 1) {
				for (let j = i + 1; j <= marker.length; j += 1) {
					const middlePart = marker.substring(i, j)
					if (text === middlePart || accumulated.endsWith(middlePart)) {
						// 保存当前累积的部分
						accumulatorRef.current = accumulated.substring(
							Math.max(0, accumulated.length - marker.length),
						)
						return false
					}
				}
			}

			// 没有找到匹配，重置累积器
			accumulatorRef.current = ""
			return false
		},
		[],
	)

	// 新增: 检测和处理命令收集开始和结束标记
	const processCommandMarkers = useCallback(
		(text: string): string => {
			const COMMAND_START = "<!-- COMMAND_START -->"
			const COMMAND_END = "<!-- COMMAND_END -->"

			// 检测完整的标记或跨多个数据行的部分标记
			const hasStartMarker =
				text.includes(COMMAND_START) ||
				detectPartialMarker(text, COMMAND_START, partialCommandStartRef)

			const hasEndMarker =
				text.includes(COMMAND_END) ||
				detectPartialMarker(text, COMMAND_END, partialCommandEndRef)

			// 处理指令开始标记
			if (hasStartMarker && !isCollectingCommandRef.current) {
				isCollectingCommandRef.current = true
				// 通知父组件开始收集指令
				if (onCommandProcessingStatusChange) {
					onCommandProcessingStatusChange(true)
				}
				console.log("检测到指令开始标记")
			}

			// 处理指令结束标记
			if (hasEndMarker && isCollectingCommandRef.current) {
				isCollectingCommandRef.current = false
				// 通知父组件结束收集指令
				if (onCommandProcessingStatusChange) {
					onCommandProcessingStatusChange(false)
				}
				console.log("检测到指令结束标记")
			}

			// 处理显示逻辑
			if (isCollectingCommandRef.current) {
				// 在收集指令阶段，查找最后一个开始标记的位置
				const startPos = text.lastIndexOf(COMMAND_START)
				if (startPos >= 0) {
					// 只返回开始标记之前的内容
					return text.substring(0, startPos)
				}
			}

			return text
		},
		[detectPartialMarker, onCommandProcessingStatusChange],
	)

	// 检查并处理缓冲区中的命令
	const processCommandBuffer = useCallback(() => {
		// 循环处理所有可能的命令
		const buffer = commandBufferRef.current
		let commandsProcessed = false

		// 使用正则表达式查找所有完整的命令
		const commandRegex = /<!-- COMMAND_START -->\s*([\s\S]*?)\s*<!-- COMMAND_END -->/g
		let match = null
		let lastIndex = 0
		const commands: any[] = []

		// 查找所有完整的命令

		while ((match = commandRegex.exec(buffer)) !== null) {
			try {
				const commandJson = match[1].trim()
				console.log("尝试解析命令:", commandJson)
				const command = JSON.parse(commandJson)
				commands.push(command)
				lastIndex = match.index + match[0].length
				commandsProcessed = true

				// 如果之前正在收集指令，现在找到了完整指令，通知结束收集
				if (isCollectingCommandRef.current) {
					isCollectingCommandRef.current = false
					if (onCommandProcessingStatusChange) {
						onCommandProcessingStatusChange(false)
					}
				}
			} catch (error) {
				console.error("解析命令JSON失败:", error, "命令内容:", match[1])
			}
		}

		// 执行找到的所有命令
		if (commands.length > 0 && !processingCommandsRef.current) {
			processingCommandsRef.current = true
			try {
				// 将命令保存到已处理命令的记录中
				commands.forEach((cmd) => {
					processedCommandsRef.current.add(JSON.stringify(cmd))
				})
				onCommandsReceived(commands)
			} catch (error) {
				console.error("处理命令时出错:", error)
			} finally {
				processingCommandsRef.current = false
			}
		}

		// 只保留缓冲区中未处理的部分（可能包含不完整的命令）
		if (commandsProcessed && lastIndex > 0) {
			commandBufferRef.current = buffer.substring(lastIndex)
		}

		return commandsProcessed
	}, [onCommandsReceived, onCommandProcessingStatusChange])

	// 处理完整内容，提取命令
	const processCompleteContent = useCallback(() => {
		// 打印当前的完整内容
		console.log("开始处理完整内容, 长度:", completeContentRef.current.length)
		console.log("completeContentRef.current截取:", completeContentRef.current.substring(0, 100))

		// 检查是否包含命令标记
		const hasCommandStart = completeContentRef.current.includes("<!-- COMMAND_START -->")
		const hasCommandEnd = completeContentRef.current.includes("<!-- COMMAND_END -->")
		console.log("完整内容命令标记检查:", { hasCommandStart, hasCommandEnd })

		// 提取命令和状态，并清理内容
		const { updatedContent: contentWithoutCommands, commands } = extractCommands(
			completeContentRef.current,
		)

		console.log("处理命令后的内容:", contentWithoutCommands.substring(0, 100))

		// 过滤掉已经处理过的命令
		const newCommands = commands.filter((cmd) => {
			const cmdStr = JSON.stringify(cmd)
			return !processedCommandsRef.current.has(cmdStr)
		})

		console.log(`找到${commands.length}个命令，其中${newCommands.length}个是新命令`)

		// 检查是否有新命令
		if (newCommands.length > 0 && !processingCommandsRef.current) {
			processingCommandsRef.current = true
			try {
				// 将新命令添加到已处理命令的记录中
				newCommands.forEach((cmd) => {
					processedCommandsRef.current.add(JSON.stringify(cmd))
				})
				onCommandsReceived(newCommands)
			} catch (error) {
				console.error("处理命令时出错:", error)
			} finally {
				// 命令处理完成后立即重置标志
				processingCommandsRef.current = false
			}
		}

		// 移除状态信息
		const cleanContent = extractStatus(contentWithoutCommands)
		console.log("处理状态后的内容:", cleanContent.substring(0, 100))
		completeContentRef.current = cleanContent

		return cleanContent
	}, [onCommandsReceived])

	// 打字机效果 - 逐字显示新内容
	const startTypingEffect = useCallback(() => {
		// 取消之前的定时器
		if (typingTimerRef.current) {
			clearTimeout(typingTimerRef.current)
			typingTimerRef.current = null
		}

		// 如果没有新内容要显示，直接返回
		if (newContentBufferRef.current.length === 0) return

		// 打字机效果函数
		const typeNextBatch = () => {
			if (newContentBufferRef.current.length > 0) {
				// 决定本次显示的字符数
				const charsToDisplay = Math.min(
					typingBatchSizeRef.current,
					newContentBufferRef.current.length,
				)

				// 从缓冲区取出要显示的字符
				const textToAdd = newContentBufferRef.current.substring(0, charsToDisplay)
				newContentBufferRef.current = newContentBufferRef.current.substring(charsToDisplay)

				// 添加到显示内容
				displayContentRef.current += textToAdd

				// 更新UI
				onTextUpdate(displayContentRef.current)

				// 安排下一批字符显示
				typingTimerRef.current = setTimeout(typeNextBatch, typingSpeedRef.current)
			} else {
				// 所有文字已显示
				typingTimerRef.current = null

				// 检查完整内容中是否有命令需要处理
				processCompleteContent()
			}
		}

		// 开始打字机效果
		typeNextBatch()
	}, [onTextUpdate, processCompleteContent])

	// 添加新内容到缓冲区并开始打字效果
	const addNewContent = useCallback(
		(newText: string) => {
			if (!newText) return

			// 将新内容添加到完整内容
			completeContentRef.current += newText

			// 累积命令缓冲区
			commandBufferRef.current += newText

			// 尝试处理命令缓冲区中的完整命令
			processCommandBuffer()

			// 处理命令标记
			const processedText = processCommandMarkers(newText)

			// 仅当不在收集指令数据阶段或处理后仍有内容时，才添加到显示缓冲区
			if (processedText.length > 0) {
				// 将处理后的新内容添加到待显示缓冲区
				newContentBufferRef.current += processedText

				// 如果当前没有进行打字效果，开始新的打字效果
				if (!typingTimerRef.current) {
					startTypingEffect()
				}
			}
		},
		[startTypingEffect, processCommandBuffer, processCommandMarkers],
	)

	// 清理流资源
	const cleanupStreamResources = useCallback(() => {
		// 清除打字机效果的定时器
		if (typingTimerRef.current) {
			clearTimeout(typingTimerRef.current)
			typingTimerRef.current = null
		}

		// 如果reader存在，释放它
		if (readerRef.current) {
			try {
				// 调用cancel告诉流我们不再需要更多数据
				readerRef.current.cancel().catch((err) => {
					console.error("取消reader失败:", err)
				})
			} catch (error) {
				console.error("取消reader时出错:", error)
			} finally {
				readerRef.current = null
			}
		}

		// 重置流处理状态
		streamProcessingRef.current = false
		currentStreamRef.current = null
	}, [])

	// 判断是否是同一个流的辅助函数
	const isSameStream = useCallback(
		(
			stream1: ReadableStream<Uint8Array> | null,
			stream2: ReadableStream<Uint8Array> | null,
		): boolean => {
			if (!stream1 || !stream2) return false
			if (stream1 === stream2) return true

			// 这里还可以添加其他判断逻辑，如比较两个流的某些属性等
			return false
		},
		[],
	)

	// 生成流ID，用于唯一标识流
	const generateStreamId = useCallback((stream: ReadableStream<Uint8Array> | null): string => {
		if (!stream) return ""
		// 使用void操作符避免linter错误
		return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
	}, [])

	useUpdateEffect(() => {
		// 当messageId更新时，清理所有消息内容，防止消息叠加
		completeContentRef.current = ""
		displayContentRef.current = ""
		newContentBufferRef.current = ""
		commandBufferRef.current = "" // 重置命令缓冲区
		isCollectingCommandRef.current = false // 重置指令收集状态
		partialCommandStartRef.current = "" // 重置部分指令开始标记
		partialCommandEndRef.current = "" // 重置部分指令结束标记
		errorDetectedRef.current = false // 重置错误检测标记
		processedCommandsRef.current = new Set() // 重置已处理命令记录

		// 重置指令收集状态通知
		if (onCommandProcessingStatusChange) {
			onCommandProcessingStatusChange(false)
		}

		// 取消当前的打字机效果
		if (typingTimerRef.current) {
			clearTimeout(typingTimerRef.current)
			typingTimerRef.current = null
		}

		// 清空UI上显示的文本
		onTextUpdate("")
	}, [messageId, onCommandProcessingStatusChange])

	// 处理SSE流
	useEffect(() => {
		// 如果没有ResponseBody则直接返回
		if (!responseBody || !messageId) return

		// 生成新的响应体ID，用于更可靠地区分不同的流
		const currentResponseBodyId = generateStreamId(responseBody)

		// 1. 先判断是否是同一个流，避免重复处理
		// 检查对象引用 + ID比对双重保险，防止React多次重渲染时重复处理同一个流
		if (
			isSameStream(currentStreamRef.current, responseBody) &&
			responseBodyIdRef.current === currentResponseBodyId
		) {
			console.log("已经在处理相同的流，跳过")
			return
		}

		// 2. 安全地清理之前的资源，避免多个reader同时工作
		cleanupStreamResources()

		// 3. 重置相关状态并更新引用
		setIsProcessing(true)
		streamProcessingRef.current = true
		currentStreamRef.current = responseBody
		responseBodyIdRef.current = currentResponseBodyId
		errorDetectedRef.current = false // 重置错误检测标记

		// 4. 记录下流启动处理的时间，用于日志
		const streamStartTime = Date.now()
		console.log(
			`开始处理新流: ${currentResponseBodyId}, 时间: ${new Date(
				streamStartTime,
			).toLocaleTimeString()}`,
		)

		const decoder = new TextDecoder("utf-8")
		let isAborted = false

		const processStream = async () => {
			try {
				// 5. 增强流锁定检测，提前检查流是否已经被锁定
				// 即使最开始不是锁定状态，避免在下面创建reader时仍然报错
				try {
					if (!responseBody || responseBody.locked) {
						console.warn("流已被锁定或不存在，无法处理")
						setIsProcessing(false)
						streamProcessingRef.current = false
						return
					}
				} catch (lockCheckError) {
					console.error("检查流锁定状态时出错:", lockCheckError)
					onError(`${t("flowAssistant.error", { ns: "flow" })}: 无法检查流状态`)
					setIsProcessing(false)
					streamProcessingRef.current = false
					return
				}

				// 6. 尝试创建reader，这里用try/catch包裹确保异常能够被捕获
				try {
					readerRef.current = responseBody.getReader()
					console.log(`成功创建reader: ${currentResponseBodyId}`)
				} catch (readerError) {
					// 7. 详细记录创建reader时的错误信息
					const errorMessage =
						readerError instanceof Error ? readerError.message : String(readerError)
					console.error(`创建reader失败(流ID: ${currentResponseBodyId}):`, errorMessage)

					// 8. 如果是流锁定错误，提供更具体的错误信息
					if (errorMessage.includes("locked to a reader")) {
						onError(
							`${t("flowAssistant.error", { ns: "flow" })}: 流已被锁定，无法读取响应`,
						)
					} else {
						onError(`${t("flowAssistant.error", { ns: "flow" })}: ${errorMessage}`)
					}

					setIsProcessing(false)
					streamProcessingRef.current = false
					return
				}

				// 9. 处理数据块函数
				const processNextChunk = async (): Promise<void> => {
					if (isAborted || !readerRef.current) return

					try {
						const result = await readerRef.current.read()

						if (result.done) {
							// 确保显示所有内容
							if (newContentBufferRef.current.length > 0) {
								// 最后的内容立即全部显示，而不是逐字显示
								displayContentRef.current += newContentBufferRef.current
								newContentBufferRef.current = ""
								onTextUpdate(displayContentRef.current)

								// 最后一次处理命令缓冲区
								processCommandBuffer()

								// 添加：处理完整内容中可能的命令
								processCompleteContent()
							}

							// 10. 记录流处理完成的时间和持续时间
							const streamEndTime = Date.now()
							console.log(
								`流处理完成: ${currentResponseBodyId}, ` +
									`持续时间: ${(streamEndTime - streamStartTime) / 1000}秒`,
							)

							setIsProcessing(false)
							streamProcessingRef.current = false
							onComplete()
							return
						}

						const chunk = decoder.decode(result.value, { stream: true })

						// 按行处理SSE数据
						const lines = chunk.split("\n").filter((line) => line.trim())

						// 使用forEach替代for...of循环
						lines.forEach((line) => {
							const extractedData = extractContent(line)
							if (extractedData.isError) {
								// 处理错误信息，显示大模型错误并提示重试
								console.error("大模型报错:", extractedData.errorInfo)
								// 将错误信息传递给父组件
								onError(
									`${extractedData.errorInfo} 请点击重试按钮或刷新页面重新尝试。`,
								)
								// 标记流处理完成
								setIsProcessing(false)
								streamProcessingRef.current = false
								// 设置错误标记为true
								errorDetectedRef.current = true
							} else if (extractedData.content) {
								addNewContent(extractedData.content)
							}
						})

						// 递归处理下一个数据块
						if (!isAborted && !errorDetectedRef.current) {
							// 使用setTimeout避免堵塞主线程
							setTimeout(() => {
								processNextChunk()
							}, 0)
						}
					} catch (error) {
						if (!isAborted) {
							const errorMessage =
								error instanceof Error ? error.message : String(error)
							console.error(
								`处理数据块失败(流ID: ${currentResponseBodyId}):`,
								errorMessage,
							)
							setIsProcessing(false)
							streamProcessingRef.current = false
							errorDetectedRef.current = true
							isCollectingCommandRef.current = false
							cleanupStreamResources()
							onError(`${t("flowAssistant.error", { ns: "flow" })}: ${errorMessage}`)
						}
					}
				}

				// 开始处理第一个数据块
				await processNextChunk()
			} catch (error) {
				if (!isAborted) {
					const errorMessage = error instanceof Error ? error.message : String(error)
					console.error(`处理流数据失败(流ID: ${currentResponseBodyId}):`, errorMessage)
					onError(`${t("flowAssistant.error", { ns: "flow" })}: ${errorMessage}`)
					setIsProcessing(false)
					streamProcessingRef.current = false
					errorDetectedRef.current = true
				}
			}
		}

		// 启动流处理
		processStream().catch((error) => {
			console.error(`启动流处理失败(流ID: ${currentResponseBodyId}):`, error)
		})

		// 清理函数

		return () => {
			console.log(`useEffect清理函数执行(流ID: ${currentResponseBodyId})`)
			isAborted = true
			cleanupStreamResources()

			// 重置指令收集状态
			if (isCollectingCommandRef.current && onCommandProcessingStatusChange) {
				isCollectingCommandRef.current = false
				onCommandProcessingStatusChange(false)
			}
		}
	}, [
		responseBody,
		messageId,
		onTextUpdate,
		onCommandsReceived,
		onError,
		onComplete,
		t,
		addNewContent,
		processCompleteContent,
		processCommandBuffer,
		cleanupStreamResources,
		isSameStream,
		generateStreamId,
		onCommandProcessingStatusChange,
	])

	// 新增一个单独的effect来响应userScrolling变化，调整打字机效果参数
	useEffect(() => {
		// 根据用户滚动状态动态调整打字机效果参数
		if (userScrolling) {
			// 用户正在滚动，降低更新频率
			typingSpeedRef.current = 100
			typingBatchSizeRef.current = 10
		} else {
			// 用户没有滚动，使用默认值
			typingSpeedRef.current = 30
			typingBatchSizeRef.current = 2
		}
	}, [userScrolling])

	return null // 这是一个逻辑组件，不渲染UI
}

/**
 * 使用完整的文本响应测试StreamProcessor组件功能
 * 主要用于测试消息中的命令处理功能
 * @param completeResponse 完整的响应文本
 * @param onTextUpdate 文本更新回调
 * @param onCommandsReceived 命令接收回调
 * @param onComplete 完成回调
 * @param onCommandProcessingStatusChange 指令处理状态变化回调（可选）
 */
StreamProcessor.testWithCompleteResponse = (
	completeResponse: string,
	onTextUpdate: (text: string) => void,
	onCommandsReceived: (commands: any[]) => void,
	onComplete?: () => void,
	onCommandProcessingStatusChange?: (isProcessing: boolean) => void,
): void => {
	// 检查是否包含命令开始标记
	if (completeResponse.includes("<!-- COMMAND_START -->") && onCommandProcessingStatusChange) {
		onCommandProcessingStatusChange(true)
	}

	// 提取命令
	const { updatedContent, commands } = extractCommands(completeResponse)

	// 清理状态信息
	const cleanContent = extractStatus(updatedContent)

	// 更新显示文本
	onTextUpdate(cleanContent)

	// 处理命令
	if (commands.length > 0) {
		onCommandsReceived(commands)
	}

	// 命令处理完成
	if (onCommandProcessingStatusChange) {
		onCommandProcessingStatusChange(false)
	}

	// 完成回调
	if (onComplete) {
		onComplete()
	}
}

/**
 * 创建模拟SSE流的ReadableStream
 * 用于测试StreamProcessor组件
 * @param completeResponse 完整的响应文本
 * @returns 模拟的SSE流
 */
StreamProcessor.createMockStream = (completeResponse: string): ReadableStream<Uint8Array> => {
	// 创建编码器
	const encoder = new TextEncoder()

	// 创建并返回ReadableStream
	return new ReadableStream({
		start(controller) {
			// 格式化为SSE格式的数据行
			const sseData = `data:{"message":{"content":${JSON.stringify(completeResponse)}}}`
			controller.enqueue(encoder.encode(sseData))
			// 完成流
			controller.close()
		},
	})
}

export default StreamProcessor
