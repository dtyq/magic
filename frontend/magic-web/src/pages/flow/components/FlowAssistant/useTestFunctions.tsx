// @ts-nocheck
import { useRef, useEffect } from "react"
import { useMemoizedFn } from "ahooks"
import type { MessageProps } from "./MessageItem"
import StreamProcessor from "./StreamProcessor"

interface Message extends MessageProps {}

interface UseTestFunctionsProps {
	setMessages: React.Dispatch<React.SetStateAction<Message[]>>
	setProcessingMessageId: React.Dispatch<React.SetStateAction<string | null>>
	setCommandQueue: React.Dispatch<React.SetStateAction<any[]>>
	setIsCommandProcessing: React.Dispatch<React.SetStateAction<boolean>>
	commandQueue: any[]
	setStreamResponse: React.Dispatch<React.SetStateAction<ReadableStream<Uint8Array> | null>>
	setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>
}

/**
 * 测试功能钩子
 * 提供测试流式响应和命令处理的功能
 */
export default function useTestFunctions({
	setMessages,
	setProcessingMessageId,
	setCommandQueue,
	setIsCommandProcessing,
	commandQueue,
	setStreamResponse,
	setIsProcessing,
}: UseTestFunctionsProps) {
	// 追踪当前测试会话ID，确保不会有重叠的测试
	const currentTestSessionRef = useRef<string | null>(null)
	// 追踪正在处理命令的状态
	const processingRef = useRef<boolean>(false)

	/**
	 * 强制清理所有测试状态
	 */
	const forceCleanupState = useMemoizedFn(() => {
		// 立即重置所有状态
		setProcessingMessageId(null)
		setIsCommandProcessing(false)
		setCommandQueue([])
		currentTestSessionRef.current = null
		processingRef.current = false
		console.log("测试状态已重置")
	})

	/**
	 * 创建模拟真实SSE流的ReadableStream，采用更可靠的数据传输方式
	 * @param sseLines SSE事件行数组
	 * @param delayBetweenLines 行之间的延迟(毫秒)
	 * @returns 模拟的SSE流
	 */
	const createMockSSEStream = useMemoizedFn(
		(sseLines: string[], delayBetweenLines: number): ReadableStream<Uint8Array> => {
			// 确保最小延迟，避免处理不及时
			const safeDelay = Math.max(150, delayBetweenLines)
			console.log(`使用安全延迟: ${safeDelay}ms`)

			let lineIndex = 0
			const encoder = new TextEncoder()

			// 使用更可靠的队列方式处理数据
			return new ReadableStream({
				start(controller) {
					// 加入结束检测计数器
					let processingTimeoutId: NodeJS.Timeout | null = null

					// 定义发送下一行的函数
					const sendNextLine = () => {
						// 清除之前的超时
						if (processingTimeoutId) {
							clearTimeout(processingTimeoutId)
							processingTimeoutId = null
						}

						if (lineIndex >= sseLines.length) {
							// 所有行已发送完毕，关闭流
							console.log(`SSE流全部行发送完成 (${sseLines.length}行)`)

							// 发送结束标记并关闭流
							setTimeout(() => {
								controller.enqueue(encoder.encode("data:[DONE]\n"))
								controller.close()
								console.log("SSE流已关闭")
							}, safeDelay)
							return
						}

						// 获取当前行并准备下一行
						const line = sseLines[lineIndex]
						lineIndex += 1

						try {
							// 确保每行都有换行符，对于SSE事件处理至关重要
							const lineWithNewline = line.endsWith("\n") ? line : `${line}\n`
							const encodedLine = encoder.encode(lineWithNewline)

							// 入队并记录日志
							controller.enqueue(encodedLine)
							console.log(
								`已发送第${lineIndex}/${sseLines.length}行: ${line.slice(0, 50)}${
									line.length > 50 ? "..." : ""
								}`,
							)

							// 安排发送下一行，并设置超时保护
							processingTimeoutId = setTimeout(() => {
								sendNextLine()
							}, safeDelay)
						} catch (error) {
							console.error(`发送SSE行时出错:`, error)
							// 出错时也尝试继续发送下一行
							processingTimeoutId = setTimeout(() => {
								sendNextLine()
							}, safeDelay * 2) // 出错时使用更长的延迟
						}
					}

					// 开始发送第一行
					console.log(`开始发送SSE流, 共${sseLines.length}行, 延迟: ${safeDelay}ms`)
					sendNextLine()
				},

				cancel() {
					console.log("模拟SSE流被取消")
					// 防止进一步发送
					lineIndex = sseLines.length
				},
			})
		},
	)

	/**
	 * 测试使用真实SSE事件流格式
	 * @param sseLines SSE事件行数组，每行格式为 data:{...}
	 * @param delayBetweenLines 行之间的延迟时间(毫秒)
	 */
	const testWithStreamEvents = useMemoizedFn(
		(sseLines: string[], delayBetweenLines: number = 200) => {
			// 如果已经有测试在进行中，先强制清理
			if (processingRef.current || currentTestSessionRef.current) {
				console.warn("检测到有未完成的测试，先执行强制清理")
				forceCleanupState()
			}

			// 生成新的测试会话ID
			const testSessionId = `test-${Date.now()}`
			currentTestSessionRef.current = testSessionId
			processingRef.current = true

			// 创建一个新的AI消息ID
			const assistantMessageId = `msg-${Date.now()}`

			// 添加一个空的AI消息，注意状态设为loading
			const newAssistantMessage: Message = {
				id: assistantMessageId,
				role: "assistant",
				content: "",
				status: "loading", // 初始状态为loading
			}

			console.log(`开始新的SSE流测试会话: ${testSessionId}, 消息ID: ${assistantMessageId}`)

			// 重置状态并添加消息
			setCommandQueue([]) // 清空命令队列
			setProcessingMessageId(assistantMessageId)
			setMessages((prev) => [...prev, newAssistantMessage])
			setIsProcessing(true)

			// 创建模拟的SSE流
			const mockStream = createMockSSEStream(sseLines, delayBetweenLines)

			// 手动监听流处理进度，确保消息状态正确更新
			const checkStreamProgress = () => {
				// 每秒检查一次流处理状态
				const checkInterval = setInterval(() => {
					// 如果会话ID不匹配或未处理中，取消检查
					if (currentTestSessionRef.current !== testSessionId || !processingRef.current) {
						clearInterval(checkInterval)
						return
					}

					// 获取消息最新状态
					let messageHasContent = false

					setMessages((prevMessages) => {
						// 查找当前消息
						const currentMessage = prevMessages.find(
							(msg) => msg.id === assistantMessageId,
						)

						// 检查消息是否已有内容但仍处于loading状态
						if (
							currentMessage &&
							currentMessage.status === "loading" &&
							currentMessage.content
						) {
							messageHasContent = true
							// 更新状态为done
							return prevMessages.map((msg) =>
								msg.id === assistantMessageId ? { ...msg, status: "done" } : msg,
							)
						}
						return prevMessages
					})

					// 如果消息有内容但仍是loading状态，确保处理完成时消息状态正确
					if (messageHasContent) {
						console.log(`检测到消息有内容但状态未更新，修正状态: ${assistantMessageId}`)
					}
				}, 1000)

				// 60秒后强制清理，防止检查器无限运行
				setTimeout(() => {
					clearInterval(checkInterval)

					// 如果仍在处理中，强制更新消息状态并结束处理
					if (currentTestSessionRef.current === testSessionId && processingRef.current) {
						console.warn(`流处理超时，强制完成: ${testSessionId}`)

						// 更新消息状态为done
						setMessages((prevMessages) =>
							prevMessages.map((msg) =>
								msg.id === assistantMessageId ? { ...msg, status: "done" } : msg,
							),
						)

						// 清理处理状态
						setProcessingMessageId(null)
						setIsProcessing(false)
						processingRef.current = false
						currentTestSessionRef.current = null
						setStreamResponse(null)
					}
				}, 60000)
			}

			// 启动进度检查
			checkStreamProgress()

			// 设置响应流，让StreamProcessor组件处理
			setStreamResponse(mockStream)
		},
	)

	/**
	 * 以最原始方式从SSE格式数据中提取内容，完全保留所有特殊字符
	 * @param sseContent SSE格式的完整内容
	 * @returns 提取的原始内容，如果失败则返回null
	 */
	const extractContentFromSSE = (sseContent: string): string | null => {
		try {
			// 按行分割SSE内容
			const lines = sseContent.split("\n").filter((line) => line.trim().length > 0)
			if (lines.length === 0) return null

			// 收集每行的字符内容
			const contentFragments: string[] = []

			// 使用forEach代替for循环，避免linter错误
			lines.forEach((line) => {
				// 确保是data:开头
				if (!line.startsWith("data:")) return // 使用return代替continue

				try {
					// 提取data:后的JSON字符串
					const jsonStr = line.substring(5)
					// 尝试解析JSON
					const data = JSON.parse(jsonStr)

					// 尝试多种路径提取内容
					if (data.message?.content !== undefined) {
						// 常见结构：{"message":{"content":"某内容"}}
						contentFragments.push(data.message.content)
					} else if (data.content !== undefined) {
						// 简单结构：{"content":"某内容"}
						contentFragments.push(data.content)
					} else if (typeof data === "string") {
						// 纯字符串结构
						contentFragments.push(data)
					}
				} catch (e) {
					// JSON解析失败，记录日志但继续处理其他行
					console.warn(`无法解析SSE行JSON数据: ${line.substring(0, 50)}...`)

					// 尝试使用正则表达式直接提取content内容
					const contentMatch = /"content":"([^"]*)"/g.exec(line)
					if (contentMatch && contentMatch[1]) {
						// 需要处理转义的双引号和其他特殊字符
						try {
							// 使用JSON.parse解码转义字符
							const decodedContent = JSON.parse(`"${contentMatch[1]}"`)
							contentFragments.push(decodedContent)
						} catch (decodeError) {
							// 解码失败，直接使用原始匹配内容
							contentFragments.push(contentMatch[1])
						}
					}
				}
			})

			// 如果提取到内容，拼接并返回
			if (contentFragments.length > 0) {
				const result = contentFragments.join("")
				// 检查特殊字符是否存在
				const hasSpecialChars = /[:"\\\n\r\t]/.test(result)
				if (hasSpecialChars) {
					console.log("提取内容包含特殊字符，确保正确处理")
				}
				return result
			}

			// 没有找到内容
			return null
		} catch (e) {
			console.error("从SSE提取内容失败:", e)
			return null
		}
	}

	/**
	 * 直接从原始SSE事件数组中提取纯文本内容，不使用JSON解析
	 * 这个方法专门处理一个字符一个事件的极端情况
	 * @param sseEvents SSE事件数组，每个事件格式为data:{"message":{"content":"字符"}}
	 * @returns 提取的纯文本内容
	 */
	const extractTextFromSSEEvents = (sseEvents: string[]): string => {
		const fragments: string[] = []

		// 记录特殊字符匹配情况
		let specialCharCount = 0

		// 使用forEach避免linter错误
		sseEvents.forEach((event) => {
			if (!event.startsWith("data:")) return // 使用return代替continue

			// 使用直接字符串匹配，避免JSON解析错误
			const contentRegex = /"content":"((?:\\"|[^"])*)"/
			const match = contentRegex.exec(event)

			if (match && match[1] !== undefined) {
				try {
					// 获取引号内的内容并处理转义
					const rawContent = match[1]
					// 使用JSON.parse处理转义字符
					const content = JSON.parse(`"${rawContent}"`)

					// 检查特殊字符
					if (/[:"\\\n\r\t]/.test(content)) {
						specialCharCount += 1 // 避免使用++
					}

					fragments.push(content)
				} catch (e) {
					// 解析失败时，直接使用原始匹配内容
					fragments.push(match[1])
				}
			}
		})

		// 记录特殊字符情况
		if (specialCharCount > 0) {
			console.log(`从SSE事件中提取了${specialCharCount}个包含特殊字符的片段`)
		}

		return fragments.join("")
	}

	/**
	 * 测试使用原始字符串内容（非SSE格式，直接是内容本身）
	 * 处理较大文本块，自动分割成小块，确保特殊字符（换行符、冒号等）被保留
	 * @param fullContent 完整的响应内容（不是SSE格式，而是纯内容）
	 * @param delayBetweenChunks 文本块之间的延迟时间(毫秒)
	 * @param chunkSize 每个文本块的大小(字符数)
	 */
	const testWithRawContent = useMemoizedFn(
		(fullContent: string, delayBetweenChunks: number = 200, chunkSize: number = 10) => {
			// 检查参数合法性
			if (!fullContent) {
				console.warn("内容为空，无法测试")
				return
			}

			// 如果已经有测试在进行中，先强制清理
			if (processingRef.current || currentTestSessionRef.current) {
				console.warn("检测到有未完成的测试，先执行强制清理")
				forceCleanupState()
			}

			// 生成新的测试会话ID
			const testSessionId = `test-${Date.now()}`
			currentTestSessionRef.current = testSessionId
			processingRef.current = true

			// 创建一个新的AI消息ID
			const assistantMessageId = `msg-${Date.now()}`

			// 添加一个空的AI消息，注意状态设为loading
			const newAssistantMessage: Message = {
				id: assistantMessageId,
				role: "assistant",
				content: "",
				status: "loading", // 初始状态为loading
			}

			console.log(`开始新的原始内容测试会话: ${testSessionId}, 消息ID: ${assistantMessageId}`)
			console.log(`原始内容长度: ${fullContent.length}字符`)

			// 重置状态并添加消息
			setCommandQueue([]) // 清空命令队列
			setProcessingMessageId(assistantMessageId)
			setMessages((prev) => [...prev, newAssistantMessage])
			setIsProcessing(true)

			// 检查内容是否包含特殊字符
			const hasSpecialChars = /[\r\n\t":{}[\]\\]/.test(fullContent)

			// 记录特殊字符
			if (hasSpecialChars) {
				console.log("检测到内容包含特殊字符，使用更小的块大小和精确编码")
				// 简单记录特殊字符存在
				console.log("发现特殊字符，将使用更严格的处理方式")

				// 打印含有特殊字符的一小段样本
				let sampleWithSpecialChars = ""
				for (
					let i = 0;
					i < fullContent.length && sampleWithSpecialChars.length < 100;
					i += 1
				) {
					if (/[\r\n\t":{}[\]\\]/.test(fullContent[i])) {
						const start = Math.max(0, i - 10)
						const end = Math.min(fullContent.length, i + 10)
						sampleWithSpecialChars = fullContent.substring(start, end)
						console.log(
							`特殊字符样本位置: ${i}, 上下文: "${sampleWithSpecialChars.replace(
								/\n/g,
								"\\n",
							)}"`,
						)
						break
					}
				}
			}

			// 将完整内容分割成小块，每个块都成为一个SSE事件
			const chunks: string[] = []

			// 使用更小的块大小处理特殊字符，确保编码正确
			const safeChunkSize = hasSpecialChars ? Math.min(chunkSize, 3) : chunkSize
			console.log(
				`使用块大小: ${safeChunkSize} (${
					hasSpecialChars ? "检测到特殊字符" : "无特殊字符"
				})`,
			)

			// 记录原始内容和JSON编码后的内容，帮助调试
			console.log(
				`原始内容样例: "${fullContent.substring(0, 50)}${
					fullContent.length > 50 ? "..." : ""
				}"`,
			)
			const jsonEncoded = JSON.stringify(fullContent.substring(0, 50))
			console.log(`JSON编码后: ${jsonEncoded}`)

			// 测试解码是否正确
			const testDecoded = JSON.parse(jsonEncoded)
			console.log(`解码测试: "${testDecoded}"`)
			if (testDecoded !== fullContent.substring(0, 50)) {
				console.warn("警告: JSON编码/解码测试不匹配!")
			}

			// 分块处理内容
			for (let i = 0; i < fullContent.length; i += safeChunkSize) {
				const chunk = fullContent.substring(
					i,
					Math.min(i + safeChunkSize, fullContent.length),
				)

				// 记录特殊字符
				const hasSpecialInChunk = /[\r\n\t":{}[\]\\]/.test(chunk)
				if (hasSpecialInChunk) {
					// 转换为字符编码，便于调试
					const charCodes = Array.from(chunk)
						.map((c) => `${c}(${c.charCodeAt(0)})`)
						.join(" ")
					console.log(`块 ${Math.floor(i / safeChunkSize)} 包含特殊字符: ${charCodes}`)
				}

				// 使用最严格的JSON字符串编码
				const escapedContent = JSON.stringify(chunk)

				// 确保JSON格式完全正确
				try {
					// 验证转义后的内容是否可以被解析回来
					const testParse = JSON.parse(escapedContent)
					if (testParse !== chunk) {
						console.warn(`警告: JSON编码/解码不匹配!`)
						console.log(`期望: "${chunk}"`)
						console.log(`实际: "${testParse}"`)

						// 记录详细的字符编码，帮助诊断问题
						const originalChars = Array.from(chunk).map(
							(c) => `${c}(${c.charCodeAt(0)})`,
						)
						const parsedChars = Array.from(testParse).map(
							// @ts-ignore
							(c) => `${c}(${c.charCodeAt(0)})`,
						)
						console.log(`原始字符编码: ${originalChars.join(" ")}`)
						console.log(`解析后字符编码: ${parsedChars.join(" ")}`)
					}
				} catch (e) {
					console.error(`JSON验证失败: ${e}`)
				}

				// 直接从转义后的内容构建SSE事件，确保完全保留原始内容
				const sseEvent = `data:{"id":"${testSessionId}","event":"message","conversation_id":"test","message":{"role":"assistant","content":${escapedContent}}}`
				chunks.push(sseEvent)

				// 记录SSE事件样例
				if (i === 0) {
					console.log(`SSE事件样例: ${sseEvent}`)
				}
			}

			console.log(`将${fullContent.length}字符的内容分割成${chunks.length}个事件块`)

			// 使用SSE流测试方法处理这些事件
			testWithStreamEvents(chunks, delayBetweenChunks)
		},
	)

	/**
	 * 使用完整响应文本测试StreamProcessor组件功能
	 * @param completeResponse 完整的响应文本
	 */
	const testWithCompleteResponse = useMemoizedFn((completeResponse: string) => {
		// 如果已经有测试在进行中，先强制清理
		if (processingRef.current || currentTestSessionRef.current) {
			console.warn("检测到有未完成的测试，先执行强制清理")
			forceCleanupState()
		}

		// 生成新的测试会话ID
		const testSessionId = `test-${Date.now()}`
		currentTestSessionRef.current = testSessionId
		processingRef.current = true

		// 创建一个新的AI消息ID
		const assistantMessageId = `msg-${Date.now()}`

		// 添加一个空的AI消息，注意状态设为loading
		const newAssistantMessage: Message = {
			id: assistantMessageId,
			role: "assistant",
			content: "",
			status: "loading", // 初始状态为loading
		}

		console.log(`开始新测试会话: ${testSessionId}, 消息ID: ${assistantMessageId}`)

		// 重置状态并添加消息
		setCommandQueue([]) // 清空命令队列
		setProcessingMessageId(assistantMessageId)
		setMessages((prev) => [...prev, newAssistantMessage])

		// 使用StreamProcessor的静态方法处理完整响应
		StreamProcessor.testWithCompleteResponse(
			completeResponse,
			// 文本更新回调
			(text) => {
				// 检查是否是当前测试会话
				if (currentTestSessionRef.current !== testSessionId) {
					console.warn("忽略过时的测试会话回调")
					return
				}

				// 更新消息内容并将状态改为done
				setMessages((prev) =>
					prev.map((msg) =>
						msg.id === assistantMessageId
							? { ...msg, content: text, status: "done" }
							: msg,
					),
				)
			},
			// 命令接收回调
			(commands) => {
				// 检查是否是当前测试会话
				if (currentTestSessionRef.current !== testSessionId) {
					console.warn("忽略过时的测试会话命令")
					return
				}

				if (commands.length > 0) {
					console.log(`收到命令: ${commands.length}个, 会话: ${testSessionId}`)

					// 设置命令队列，使用函数式更新避免闭包陷阱
					setCommandQueue(commands)

					// 标记命令处理开始
					setIsCommandProcessing(true)

					// 如果有命令，更新消息内容指示正在处理命令
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === assistantMessageId
								? {
										...msg,
										content: msg.content || "我正在处理命令...",
										status: "done",
									}
								: msg,
						),
					)
				} else {
					console.log(`没有命令需要处理, 会话: ${testSessionId}`)

					// 没有命令，确保消息状态为done
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === assistantMessageId ? { ...msg, status: "done" } : msg,
						),
					)

					// 完成处理
					setProcessingMessageId(null)
					processingRef.current = false
					currentTestSessionRef.current = null
				}
			},
			// 完成回调
			() => {
				console.log(`测试会话内容处理完成: ${testSessionId}`)

				// 获取最新的命令队列状态进行检查
				const currentCommands = commandQueue
				const hasCommands = currentCommands && currentCommands.length > 0

				// 如果没有命令，清理处理状态
				if (!hasCommands) {
					setProcessingMessageId(null)
					setIsCommandProcessing(false)
					processingRef.current = false
					currentTestSessionRef.current = null
					console.log(`测试会话已完成: ${testSessionId}`)
				}
				// 注意：如果有命令，不要在这里清除processingMessageId
				// 让CommandProcessor完成后再清除
			},
		)
	})

	/**
	 * 创建模拟SSE流
	 * @param content 完整的响应文本
	 * @returns 模拟的ReadableStream
	 */
	const createMockStream = useMemoizedFn((content: string): ReadableStream<Uint8Array> => {
		return StreamProcessor.createMockStream(content)
	})

	/**
	 * 测试使用完整的SSE事件字符串
	 * 接收单个包含多行SSE数据的字符串，自动分割处理
	 * @param sseContent 完整的SSE事件字符串，包含多行data:格式数据
	 * @param delayBetweenLines 行之间的延迟时间(毫秒)
	 */
	const testWithFullSSEContent = useMemoizedFn(
		(sseContent: string, delayBetweenLines: number = 200) => {
			// 如果内容为空，直接返回
			if (!sseContent) {
				console.warn("SSE内容为空，无法测试")
				return
			}

			console.log("开始处理SSE内容，长度:", sseContent.length)

			// 检查是否是SSE格式
			const isSSEFormat = sseContent.trim().startsWith("data:")

			if (isSSEFormat) {
				// 1. 尝试提取原始内容
				console.log("检测到SSE格式数据，尝试两种方法提取内容")

				// 方法1: 按行处理整个文本
				const contentFromText = extractContentFromSSE(sseContent)

				// 方法2: 将数据拆分为事件数组处理（适用于逐字符发送）
				const events = sseContent.split("\n").filter((line) => line.trim().length > 0)
				const contentFromEvents = extractTextFromSSEEvents(events)

				// 比较两种方法的结果，选择包含特殊字符更多的那个
				let finalContent: string

				if (contentFromText && contentFromEvents) {
					// 检查哪个包含更多的特殊字符
					const specialCharsInText = (contentFromText.match(/[:"\\\n\r\t]/g) || []).length
					const specialCharsInEvents = (contentFromEvents.match(/[:"\\\n\r\t]/g) || [])
						.length

					if (specialCharsInEvents > specialCharsInText) {
						console.log("使用事件数组提取方法，它保留了更多特殊字符")
						finalContent = contentFromEvents
					} else {
						console.log("使用文本提取方法，它保留了更多特殊字符")
						finalContent = contentFromText
					}
				} else {
					// 使用非空的那个结果
					finalContent = contentFromText || contentFromEvents || sseContent
				}

				console.log(`提取到原始内容，长度: ${finalContent.length}字符`)

				// 直接使用testWithRawContent处理提取出的内容，确保特殊字符被正确保留
				testWithRawContent(finalContent, delayBetweenLines, 3) // 使用小块大小确保特殊字符处理正确
			} else {
				// 不是SSE格式，作为原始内容处理
				console.log("内容不是SSE格式，作为原始内容处理")
				testWithRawContent(sseContent, delayBetweenLines)
			}
		},
	)

	/**
	 * 将测试方法暴露到window对象，方便控制台调用
	 */
	const exposeTestFunctions = useMemoizedFn(() => {
		// @ts-ignore
		window.testFlowAssistant = {
			testWithCompleteResponse,
			createMockStream,
			forceCleanupState, // 暴露强制清理方法，方便手动重置
			testWithStreamEvents, // 暴露SSE流测试方法(数组版本)
			testWithFullSSEContent, // 暴露SSE流测试方法(字符串版本)
			testWithRawContent, // 添加：测试纯文本内容，保留所有特殊字符
		}
	})

	/**
	 * 清理暴露的测试方法
	 */
	const cleanupTestFunctions = useMemoizedFn(() => {
		// @ts-ignore
		delete window.testFlowAssistant
	})

	// 组件挂载时暴露测试方法，卸载时清理
	useEffect(() => {
		exposeTestFunctions()
		return () => {
			cleanupTestFunctions()
			forceCleanupState() // 组件卸载时确保清理
		}
	}, [exposeTestFunctions, cleanupTestFunctions, forceCleanupState])

	return {
		testWithCompleteResponse,
		createMockStream,
		forceCleanupState,
		testWithStreamEvents,
		testWithFullSSEContent,
		testWithRawContent,
	}
}
