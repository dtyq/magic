import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Input, Button, Card, List } from "antd"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { IconSend, IconX, IconBan } from "@tabler/icons-react"
import { Resizable } from "re-resizable"
import { FlowConverter } from "../../utils/flowConverter"
import { useStyles } from "./styles"
import StreamProcessor from "./StreamProcessor"
import type { MessageProps } from "./MessageItem"
import MessageItem from "./MessageItem"
import CommandProcessor from "./CommandProcessor"
import useFlowOperations from "./useFlowOperations"
import useTestFunctions from "./useTestFunctions"
import { useConfirmOperations } from "./hooks/useConfirmOperations"
import { useSendAgentMessage } from "./hooks/useSendAgentMessage"
import { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import { FlowApi } from "@/opensource/apis"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

// MD5生成函数
function generateMD5(input: string): string {
	// 简化版的MD5实现，实际项目中应使用crypto库或md5库
	let hash = 0
	for (let i = 0; i < input.length; i += 1) {
		hash = (hash << 5) - hash + input.charCodeAt(i)

		hash |= 0
	}

	// 转为16进制字符串并截取12位
	const hashHex = Math.abs(hash).toString(16).padStart(12, "0")
	return hashHex.substring(0, 12)
}

// 生成会话ID
function generateConversationId(flowId: string): string {
	const randomStr = Math.random().toString(36).substring(2, 10)
	const baseString = `${flowId || "temp-flow"}-${randomStr}`
	return generateMD5(baseString)
}

const { TextArea } = Input

// 修改消息接口定义，重用MessageProps
export interface Message extends MessageProps {}

interface FlowAssistantProps {
	flowInteractionRef: React.MutableRefObject<any>
	flow?: MagicFlow.Flow
	onClose: () => void
	isAgent: boolean
	saveDraft: () => Promise<void>
	isEditRight: boolean
}

interface AgentCallParams {
	message: string
	conversation_id: string
	stream?: boolean
}

// 流处理中的纯解析函数
const parseSSELine = (line: string): { text: string; commands: any[] } => {
	// 跳过结束标记
	if (line === "data:[DONE]") {
		return { text: "", commands: [] }
	}

	// 检查是否是SSE格式数据行
	if (line.startsWith("data:") && line.length > 5) {
		try {
			// 提取JSON字符串
			const jsonStr = line.substring(5).trim()
			const data = JSON.parse(jsonStr)

			// 提取可能的文本内容
			let extractedText = ""

			// 从各种位置尝试提取内容
			if (data.message && typeof data.message.content === "string") {
				extractedText = data.message.content
			} else if (data.type === "message" && typeof data.content === "string") {
				extractedText = data.content
			} else if (typeof data.content === "string") {
				extractedText = data.content
			}

			// 检查json中是否包含命令
			const commands = []
			if (data.type === "flow_commands" && Array.isArray(data.commands)) {
				commands.push(...data.commands)
			}

			return { text: extractedText, commands }
		} catch (error) {
			console.error("解析SSE行失败:", error)
		}
	}

	// 默认返回空结果
	return { text: "", commands: [] }
}

// 默认尺寸常量
const DEFAULT_WIDTH = 420
const DEFAULT_HEIGHT = 600
const MIN_WIDTH = 420
const MIN_HEIGHT = 350
const MAX_WIDTH = 800
const MAX_HEIGHT = 900

// 添加: 默认位置常量
const DEFAULT_POSITION = { x: undefined as number | undefined, y: "20%" as string | number }

// 添加: localStorage存储键名
const STORAGE_KEY = {
	POSITION: "flow_assistant_position",
	SIZE: "flow_assistant_size",
}

// 添加: 从localStorage读取位置信息
const getSavedPosition = (): typeof DEFAULT_POSITION => {
	try {
		const saved = localStorage.getItem(STORAGE_KEY.POSITION)
		if (saved) {
			return JSON.parse(saved)
		}
	} catch (e) {
		console.error("读取保存的位置信息失败:", e)
	}
	return DEFAULT_POSITION
}

// 添加: 从localStorage读取尺寸信息
const getSavedSize = (): { width: number; height: number } => {
	try {
		const saved = localStorage.getItem(STORAGE_KEY.SIZE)
		if (saved) {
			return JSON.parse(saved)
		}
	} catch (e) {
		console.error("读取保存的尺寸信息失败:", e)
	}
	return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }
}

export default function FlowAssistant({
	flowInteractionRef,
	flow,
	onClose,
	saveDraft,
}: FlowAssistantProps) {
	const { t } = useTranslation()
	const { styles } = useStyles()
	const [messages, setMessages] = useState<Message[]>([
		{
			id: "0",
			role: "assistant",
			content: t("flowAssistant.welcome", { ns: "flow" }),
			status: "done",
		},
	])
	const [inputValue, setInputValue] = useState("")
	const [isProcessing, setIsProcessing] = useState(false)
	const [conversationId, setConversationId] = useState<string>("")
	const messagesEndRef = useRef<HTMLDivElement>(null)
	const [streamResponse, setStreamResponse] = useState<ReadableStream<Uint8Array> | null>(null)
	const [processingMessageId, setProcessingMessageId] = useState<string | null>(null)
	const [commandQueue, setCommandQueue] = useState<any[]>([])
	const [isCommandProcessing, setIsCommandProcessing] = useState(false)
	// 添加用户滚动交互状态
	const [userScrolling, setUserScrolling] = useState(false)
	const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	// 新增：强制滚动标记
	const [forceScroll, setForceScroll] = useState(false)
	// 新增：最后一次检测到的消息数量
	const lastMessageCountRef = useRef(1) // 初始有一条欢迎消息
	// 修改：读取保存的尺寸信息
	const [size, setSize] = useState(getSavedSize())
	// 修改：读取保存的位置信息
	const [position, setPosition] = useState(getSavedPosition())
	// 新增：拖拽状态
	const [isDragging, setIsDragging] = useState(false)
	// 新增：拖拽起始位置
	const dragStartRef = useRef({ x: 0, y: 0 })
	// 修改：位置引用也使用保存的位置
	const positionRef = useRef(getSavedPosition())
	// 新增：命令收集状态
	const [isCollectingCommand, setIsCollectingCommand] = useState(false)

	// 使用新的消息发送钩子
	const { sendAgentMessage } = useSendAgentMessage()

	// 使用流程操作钩子
	const flowOperations = useFlowOperations({
		flowInteractionRef,
		saveDraft,
		flowService: FlowApi,
	})

	// 创建获取流程数据的函数
	const getFlowData = useMemoizedFn(() => {
		// 获取当前流程数据
		const currentFlow = flowInteractionRef?.current?.getFlow()
		// 将流程数据转换为YAML格式
		return currentFlow ? FlowConverter.jsonToYamlString(currentFlow) : ""
	})

	// 使用确认操作钩子，传入新的内部发送消息实现
	const { handleConfirmOperationCommand, handleConfirmOperation, handleCancelOperation } =
		useConfirmOperations({
			flowId: flow?.id || "",
			executeOperations: flowOperations.executeOperations,
			setMessages,
			setForceScroll,
			sendMessage: async (content: string) => {
				if (isProcessing) return // 如果正在处理其他消息，不发送

				// 添加用户消息和助手消息，这部分由useConfirmOperations管理
				// 设置处理状态
				setIsProcessing(true)

				try {
					// 初始化一个空内容消息，用于显示Assistant的回复
					const assistantMessageId = Date.now().toString()
					const loadingAssistantMessage: Message = {
						id: assistantMessageId,
						role: "assistant",
						content: "",
						status: "loading",
					}

					// 添加助手消息
					setMessages((prev) => [...prev, loadingAssistantMessage])
					setProcessingMessageId(assistantMessageId)

					// 使用封装的发送消息函数
					const result = await sendAgentMessage(content, {
						conversationId: conversationId || "temp-conversation",
						includeFlowData: false, // 确认操作不需要流程数据
					})

					if (result.isError) {
						// 更新助手消息显示错误
						setMessages((prev) =>
							prev.map((msg) =>
								msg.id === assistantMessageId
									? {
											...msg,
											content: result.errorMessage || "未知错误",
											status: "error",
										}
									: msg,
							),
						)
						setIsProcessing(false)
						return
					}

					// 设置流处理响应
					if (result.stream) {
						setStreamResponse(result.stream)
					} else {
						// 非流式响应处理
						setMessages((prev) =>
							prev.map((msg) =>
								msg.id === assistantMessageId
									? {
											...msg,
											content: result.contentStr || "服务器未返回内容",
											status: "done",
										}
									: msg,
							),
						)
						setIsProcessing(false)
					}
				} catch (error) {
					console.error("Error processing instruction:", error)
					const errorMessage = error instanceof Error ? error.message : String(error)

					// 更新助手消息为错误状态
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === processingMessageId
								? {
										...msg,
										content: `${t("flowAssistant.error", {
											ns: "flow",
										})}: ${errorMessage}`,
										status: "error",
									}
								: msg,
						),
					)

					magicToast.error(t("flowAssistant.processError", { ns: "flow" }))
					setIsProcessing(false)
				}
			},
		})

	// 使用测试功能钩子
	useTestFunctions({
		setMessages,
		setProcessingMessageId,
		setCommandQueue,
		setIsCommandProcessing,
		commandQueue,
		setStreamResponse,
		setIsProcessing,
	})

	// 初始化会话ID，仅在组件首次挂载时生成
	useEffect(() => {
		if (!conversationId) {
			setConversationId(generateConversationId(flow?.id || ""))
		}
	}, [flow?.id, conversationId])

	// 滚动到最新消息
	const scrollToBottom = useMemoizedFn(() => {
		// 当强制滚动或用户没有手动滚动时自动滚动
		if (forceScroll || !userScrolling) {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
			// 重置强制滚动标记
			if (forceScroll) {
				setForceScroll(false)
			}
		}
	})

	useEffect(() => {
		// 检测是否有新消息添加
		if (messages.length > lastMessageCountRef.current) {
			// 新消息添加时，设置强制滚动标记
			setForceScroll(true)
			lastMessageCountRef.current = messages.length
		}
		scrollToBottom()
	}, [messages, scrollToBottom])

	// 处理消息列表滚动事件
	const handleMessagesScroll = useMemoizedFn((e: React.UIEvent<HTMLDivElement>) => {
		const element = e.currentTarget

		// 清除之前的定时器
		if (scrollTimeoutRef.current) {
			clearTimeout(scrollTimeoutRef.current)
		}

		// 检测用户滚动
		// 如果滚动位置不在底部，标记为用户正在滚动
		const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 100 // 增加容差值

		// 只有当不在底部时才设置用户滚动状态
		if (!isAtBottom) {
			setUserScrolling(true)

			// 设置定时器，5秒后检查是否应该重置滚动状态
			scrollTimeoutRef.current = setTimeout(() => {
				// 重新检查当前是否在底部附近
				const currentElement = messagesEndRef.current?.parentElement
				if (currentElement) {
					const currentIsAtBottom =
						currentElement.scrollHeight - currentElement.scrollTop <=
						currentElement.clientHeight + 100

					// 只有当滚动位置接近底部时才重置状态
					if (currentIsAtBottom) {
						setUserScrolling(false)
					}
				}
			}, 5000) // 延长至5秒
		} else if (userScrolling && isAtBottom) {
			// 如果用户主动滚动到底部，立即重置滚动状态
			setUserScrolling(false)
		}
	})

	// 清理滚动定时器
	useEffect(() => {
		return () => {
			if (scrollTimeoutRef.current) {
				clearTimeout(scrollTimeoutRef.current)
			}
		}
	}, [])

	// 添加: 保存位置信息到localStorage
	const savePosition = useMemoizedFn((pos: typeof position) => {
		try {
			localStorage.setItem(STORAGE_KEY.POSITION, JSON.stringify(pos))
		} catch (e) {
			console.error("保存位置信息失败:", e)
		}
	})

	// 添加: 保存尺寸信息到localStorage
	const saveSize = useMemoizedFn((newSize: typeof size) => {
		try {
			localStorage.setItem(STORAGE_KEY.SIZE, JSON.stringify(newSize))
		} catch (e) {
			console.error("保存尺寸信息失败:", e)
		}
	})

	// 处理命令状态更新
	const handleCommandUpdate = useMemoizedFn((messageId: string, commandStatus: any[]) => {
		setMessages((prev) =>
			prev.map((msg) =>
				msg.id === messageId
					? {
							...msg,
							commandStatus: [
								...(msg.commandStatus || []).filter(
									(cmd) =>
										!commandStatus.some((newCmd) => newCmd.type === cmd.type),
								),
								...commandStatus,
							],
						}
					: msg,
			),
		)
	})

	// 处理命令执行完成
	const handleCommandComplete = useMemoizedFn(() => {
		setIsCommandProcessing(false)
		setCommandQueue([])
	})

	// 处理文本更新回调 - 不触发强制滚动
	const handleTextUpdate = useMemoizedFn((text: string) => {
		if (!processingMessageId) return

		// 添加调试日志
		console.log(
			`handleTextUpdate: processingMessageId=${processingMessageId}, text length=${text.length}`,
		)

		setMessages((prev) =>
			prev.map((msg) =>
				msg.id === processingMessageId ? { ...msg, content: text, status: "loading" } : msg,
			),
		)
		// 不设置forceScroll，避免内容更新时强制滚动
	})

	// 修改: 处理尺寸变化 - 添加保存尺寸功能
	const handleResizeStop = useMemoizedFn((e, direction, ref, d) => {
		const newSize = {
			width: size.width + d.width,
			height: size.height + d.height,
		}
		setSize(newSize)
		// 保存新尺寸
		saveSize(newSize)
	})

	// 新增：处理拖拽开始
	const handleDragStart = useMemoizedFn((e: React.MouseEvent) => {
		e.preventDefault()
		setIsDragging(true)
		dragStartRef.current = { x: e.clientX, y: e.clientY }
	})

	// 修改：处理拖拽移动 - 添加保存位置功能
	const handleDragMove = useMemoizedFn((e: MouseEvent) => {
		if (!isDragging) return

		const deltaX = e.clientX - dragStartRef.current.x
		const deltaY = e.clientY - dragStartRef.current.y

		// 获取当前位置
		const currentX =
			typeof positionRef.current.x === "number"
				? positionRef.current.x
				: window.innerWidth - DEFAULT_WIDTH - 34
		const currentY =
			typeof positionRef.current.y === "number"
				? positionRef.current.y
				: window.innerHeight * 0.2

		// 计算新位置
		const newX = currentX + deltaX
		const newY = currentY + deltaY

		// 确保不超出视口边界
		const boundedX = Math.max(0, Math.min(window.innerWidth - size.width, newX))
		const boundedY = Math.max(0, Math.min(window.innerHeight - 100, newY))

		// 更新位置
		const newPosition = { x: boundedX, y: boundedY }
		positionRef.current = newPosition
		setPosition(newPosition)

		// 保存新位置
		savePosition(newPosition)

		// 更新拖拽起始位置
		dragStartRef.current = { x: e.clientX, y: e.clientY }
	})

	// 新增：处理拖拽结束
	const handleDragEnd = useMemoizedFn(() => {
		setIsDragging(false)
	})

	// 新增：注册全局鼠标事件监听
	useEffect(() => {
		if (isDragging) {
			document.addEventListener("mousemove", handleDragMove)
			document.addEventListener("mouseup", handleDragEnd)
		}

		return () => {
			document.removeEventListener("mousemove", handleDragMove)
			document.removeEventListener("mouseup", handleDragEnd)
		}
	}, [isDragging, handleDragMove, handleDragEnd])

	// 新增：处理命令处理状态变化
	const handleCommandProcessingStatusChange = useMemoizedFn((processStatus: boolean) => {
		setIsCollectingCommand(processStatus)

		// 如果有正在处理的消息，更新该消息的状态
		if (processingMessageId) {
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === processingMessageId
						? {
								...msg,
								isCollectingCommand: processStatus,
								// 如果开始收集命令，显示Loading状态提示
								content: processStatus
									? `${msg.content}\n\n正在收集指令数据...`
									: msg.content,
							}
						: msg,
				),
			)
		}
	})

	// 处理命令接收回调
	const handleCommandsReceived = useMemoizedFn((commands: any[]) => {
		if (!processingMessageId || commands.length === 0) return

		console.log("收到命令:", commands)

		// 检查是否有确认操作命令
		for (const command of commands) {
			if (command.type === "confirmOperation") {
				console.log("发现确认操作命令:", command)
				handleConfirmOperationCommand(command, processingMessageId)
				return // 如果找到确认操作命令，不添加到普通命令队列
			}
		}

		// 将命令添加到队列
		setCommandQueue((prev) => {
			// 过滤掉重复的命令（基于类型和其他关键属性）
			const newCommands = commands.filter(
				(newCmd) =>
					!prev.some(
						(existing) =>
							existing.type === newCmd.type &&
							JSON.stringify(existing) === JSON.stringify(newCmd),
					),
			)

			if (newCommands.length === 0) return prev
			return [...prev, ...newCommands]
		})
	})

	// 处理流处理错误
	const handleStreamError = useMemoizedFn((errorMessage: string) => {
		if (!processingMessageId) return
		setIsProcessing(false)
		setMessages((prev) =>
			prev.map((msg) =>
				msg.id === processingMessageId
					? { ...msg, content: errorMessage, status: "error" }
					: msg,
			),
		)
	})

	// 处理流处理完成
	const handleStreamComplete = useMemoizedFn(() => {
		console.log(`handleStreamComplete called, processingMessageId=${processingMessageId}`)
		setIsProcessing(false)
		setStreamResponse(null)

		// 确保当前处理的消息状态被正确更新为done
		if (processingMessageId) {
			setMessages((prev) =>
				prev.map((msg) => {
					// 检查是否是当前正在处理的消息
					if (msg.id === processingMessageId) {
						console.log(
							`Updating message ${msg.id} status to done, current status: ${msg.status}, content: ${msg.content}`,
						)
						// 保留确认操作属性，只更新状态
						return {
							...msg,
							status: "done",
							// 如果消息中包含确认操作，确保它被保留
							confirmOperation: msg.confirmOperation || undefined,
						}
					}
					return msg
				}),
			)
		}

		setProcessingMessageId(null)
	})

	// 添加：处理重试失败消息
	const handleRetry = useMemoizedFn(async (messageId: string) => {
		// 找到对应的错误消息
		const errorMessage = messages.find(
			(msg) => msg.id === messageId && msg.status === "error" && msg.role === "assistant",
		)

		if (!errorMessage) return

		// 找到错误消息之前的最近用户消息
		const errorIndex = messages.findIndex((msg) => msg.id === messageId)
		if (errorIndex <= 0) return

		let userMessageIndex = errorIndex - 1
		while (userMessageIndex >= 0) {
			if (messages[userMessageIndex].role === "user") {
				break
			}
			userMessageIndex--
		}

		if (userMessageIndex < 0) return

		const userMessage = messages[userMessageIndex]

		// 如果当前正在处理其他消息，先不进行重试
		if (isProcessing) {
			magicToast.info(t("flowAssistant.waitForProcessing", { ns: "flow" }))
			return
		}

		// 移除错误消息
		setMessages((prev) => prev.filter((msg) => msg.id !== messageId))

		// 创建新的助手消息
		const newAssistantMessageId = Date.now().toString()
		const loadingAssistantMessage: Message = {
			id: newAssistantMessageId,
			role: "assistant",
			content: "",
			status: "loading",
		}

		// 添加新的助手消息
		setMessages((prev) => [...prev, loadingAssistantMessage])
		setForceScroll(true)
		setProcessingMessageId(newAssistantMessageId)
		setIsProcessing(true)

		try {
			// 使用封装的发送消息函数，重新发送原始用户消息
			const result = await sendAgentMessage(userMessage.content, {
				conversationId: conversationId || "temp-conversation",
				includeFlowData: false, // 重试时不需要再次发送流程数据
			})

			if (result.isError) {
				// 更新助手消息显示错误
				setMessages((prev) =>
					prev.map((msg) =>
						msg.id === newAssistantMessageId
							? {
									...msg,
									content: result.errorMessage || "未知错误",
									status: "error",
								}
							: msg,
					),
				)
				setIsProcessing(false)
				return
			}

			// 设置流处理响应
			if (result.stream) {
				setStreamResponse(result.stream)
			} else {
				// 非流式响应处理
				setMessages((prev) =>
					prev.map((msg) =>
						msg.id === newAssistantMessageId
							? {
									...msg,
									content: result.contentStr || "服务器未返回内容",
									status: "done",
								}
							: msg,
					),
				)
				setIsProcessing(false)
			}
		} catch (error) {
			console.error("Error retrying message:", error)
			const errorMessage = error instanceof Error ? error.message : String(error)

			// 更新助手消息为错误状态
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === newAssistantMessageId
						? {
								...msg,
								content: `${t("flowAssistant.error", {
									ns: "flow",
								})}: ${errorMessage}`,
								status: "error",
							}
						: msg,
				),
			)

			magicToast.error(t("flowAssistant.retryError", { ns: "flow" }))
			setIsProcessing(false)
		}
	})

	// 新增：处理中断流连接的方法
	const handleAbortStream = useMemoizedFn(() => {
		// 如果有正在处理的流，中断它
		if (streamResponse) {
			console.log("主动中断SSE流连接")

			// 重置相关状态
			setStreamResponse(null)
			setIsProcessing(false)

			// 如果有正在处理的消息，更新其状态为中断
			if (processingMessageId) {
				setMessages((prev) =>
					prev.map((msg) =>
						msg.id === processingMessageId
							? {
									...msg,
									content: msg.content + "\n\n[用户中断了响应]",
									status: "done",
								}
							: msg,
					),
				)
				setProcessingMessageId(null)
			}

			// 显示中断提示
			magicToast.info(
				t("flowAssistant.messageStopped", { ns: "flow", defaultValue: "已停止响应" }),
			)
		}
	})

	// 发送消息到AI助手 - 使用新的封装函数
	const sendMessage = useMemoizedFn(async () => {
		if (!inputValue.trim() || isProcessing) return

		// 重置任何之前的状态
		setCommandQueue([])

		const userMessage = inputValue.trim()
		setInputValue("")

		// 添加用户消息和助手消息
		const newUserMessage: Message = {
			id: Date.now().toString(),
			role: "user",
			content: userMessage,
			status: "done", // 明确设置用户消息状态
		}

		const assistantMessageId = (Date.now() + 1).toString()
		const loadingAssistantMessage: Message = {
			id: assistantMessageId,
			role: "assistant",
			content: "",
			status: "loading", // 确保助手消息初始状态为loading
		}

		// 添加消息并设置强制滚动标记
		setMessages((prev) => [...prev, newUserMessage, loadingAssistantMessage])
		setForceScroll(true) // 显式设置强制滚动
		lastMessageCountRef.current = messages.length + 2 // 更新消息计数

		setIsProcessing(true)

		try {
			// 使用封装的发送消息函数
			const result = await sendAgentMessage(userMessage, {
				conversationId: conversationId || "temp-conversation",
				includeFlowData: true, // 仅在第一次发送时包含流程数据
				getFetchFlowData: getFlowData,
			})

			// 处理错误情况
			if (result.isError) {
				// 更新助手消息显示错误
				setMessages((prev) =>
					prev.map((msg) =>
						msg.id === assistantMessageId
							? {
									...msg,
									content: result.errorMessage || "未知错误",
									status: "error",
								}
							: msg,
					),
				)
				setIsProcessing(false)
				return
			}

			// 设置流处理参数
			if (result.stream) {
				setStreamResponse(result.stream)
				setProcessingMessageId(assistantMessageId)
			} else if (result.contentStr) {
				// 非流式响应的处理逻辑
				setMessages((prev) =>
					prev.map((msg) =>
						msg.id === assistantMessageId
							? {
									...msg,
									content: result.contentStr || "服务器未返回内容",
									status: "done",
								}
							: msg,
					),
				)
				setIsProcessing(false)
			}
		} catch (error) {
			console.error("Error processing instruction:", error)
			const errorMessage = error instanceof Error ? error.message : String(error)

			// 更新助手消息为错误状态
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === assistantMessageId
						? {
								...msg,
								content: `${t("flowAssistant.error", {
									ns: "flow",
								})}: ${errorMessage}`,
								status: "error",
							}
						: msg,
				),
			)

			magicToast.error(t("flowAssistant.processError", { ns: "flow" }))
			setIsProcessing(false)
		}
	})

	// 渲染聊天UI部分
	return (
		<Resizable
			className={styles.flowAssistant}
			style={{
				position: "fixed",
				top: position.y,
				left: position.x,
				right: position.x === undefined ? "34px" : "auto",
			}}
			size={{ width: size.width, height: size.height }}
			minWidth={MIN_WIDTH}
			minHeight={MIN_HEIGHT}
			maxWidth={MAX_WIDTH}
			maxHeight={MAX_HEIGHT}
			onResizeStop={handleResizeStop}
			enable={{
				top: false,
				right: true,
				bottom: true,
				left: true,
				topRight: false,
				bottomRight: true,
				bottomLeft: true,
				topLeft: false,
			}}
			handleStyles={{
				right: { width: "6px", right: "0", cursor: "ew-resize" },
				left: { width: "6px", left: "0", cursor: "ew-resize" },
				bottom: { height: "6px", bottom: "0", cursor: "ns-resize" },
				bottomRight: {
					width: "12px",
					height: "12px",
					right: "0",
					bottom: "0",
					cursor: "nwse-resize",
				},
				bottomLeft: {
					width: "12px",
					height: "12px",
					left: "0",
					bottom: "0",
					cursor: "nesw-resize",
				},
			}}
			handleClasses={{
				right: styles.resizeHandle,
				bottom: styles.resizeHandle,
				left: styles.resizeHandle,
				bottomRight: styles.resizeCornerHandle,
				bottomLeft: styles.resizeCornerHandle,
			}}
		>
			{/* StreamProcessor 组件放置在这里 */}

			<StreamProcessor
				responseBody={streamResponse}
				messageId={processingMessageId!}
				onTextUpdate={handleTextUpdate}
				onCommandsReceived={handleCommandsReceived}
				onError={handleStreamError}
				onComplete={handleStreamComplete}
				userScrolling={userScrolling}
				onCommandProcessingStatusChange={handleCommandProcessingStatusChange}
			/>

			{/* CommandProcessor 组件放置在这里 */}

			<CommandProcessor
				commands={commandQueue}
				messageId={processingMessageId!}
				executeOperations={flowOperations.executeOperations}
				flowId={flow?.id || ""}
				commandExecutionRef={flowOperations.commandExecutionRef}
				onCommandUpdate={handleCommandUpdate}
				onComplete={handleCommandComplete}
			/>

			<Card
				title={
					<div
						className={styles.titleContainer}
						onMouseDown={handleDragStart}
						style={{ cursor: "move", width: "100%" }}
					>
						{t("flowAssistant.title", { ns: "flow" })}
					</div>
				}
				extra={
					<Button
						type="text"
						onClick={onClose}
						icon={<IconX size={16} className={styles.closeIcon} />}
					/>
				}
				className={styles.card}
				styles={{ body: { padding: 0 } }}
				variant="borderless"
			>
				<div className={styles.messageContainer} onScroll={handleMessagesScroll}>
					<List
						itemLayout="horizontal"
						dataSource={messages}
						renderItem={(item: Message) => (
							<List.Item style={{ padding: 0, border: "none" }}>
								<MessageItem
									{...item}
									onConfirm={handleConfirmOperation}
									onCancel={handleCancelOperation}
									onRetry={handleRetry}
								/>
							</List.Item>
						)}
					/>
					<div ref={messagesEndRef} />
				</div>

				<div className={styles.inputContainer}>
					<TextArea
						value={inputValue}
						onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
							setInputValue(e.target.value)
						}
						placeholder={t("flowAssistant.inputPlaceholder", { ns: "flow" })}
						autoSize={{ minRows: 1, maxRows: 4 }}
						disabled={isProcessing}
						onPressEnter={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
							if (!e.shiftKey) {
								e.preventDefault()
								sendMessage()
							}
						}}
					/>
					{isProcessing ? (
						<Button
							type="primary"
							danger
							icon={<IconBan size={16} />}
							onClick={handleAbortStream}
						/>
					) : (
						<Button
							type="primary"
							icon={<IconSend size={16} />}
							onClick={sendMessage}
							disabled={!inputValue.trim()}
						/>
					)}
				</div>
			</Card>
		</Resizable>
	)
}
