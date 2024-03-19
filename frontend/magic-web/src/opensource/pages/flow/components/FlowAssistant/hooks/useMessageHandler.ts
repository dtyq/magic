// @ts-nocheck
import { useState, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import type { Message } from "../index"
import { useSendAgentMessage } from "./useSendAgentMessage"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface UseMessageHandlerProps {
	conversationId: string
	setMessages: React.Dispatch<React.SetStateAction<Message[]>>
	hasSentFlowData: boolean
	setHasSentFlowData: React.Dispatch<React.SetStateAction<boolean>>
	setForceScroll: React.Dispatch<React.SetStateAction<boolean>>
	getFlowData?: () => string
}

interface UseMessageHandlerResult {
	isProcessing: boolean
	streamResponse: ReadableStream<Uint8Array> | null
	processingMessageId: string | null
	sendMessage: (content: string) => Promise<void>
	handleRetryMessage: (messageId: string) => Promise<void>
	handleStreamError: (errorMessage: string) => void
	handleStreamComplete: () => void
	setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>
	setStreamResponse: React.Dispatch<React.SetStateAction<ReadableStream<Uint8Array> | null>>
	setProcessingMessageId: React.Dispatch<React.SetStateAction<string | null>>
}

export function useMessageHandler({
	conversationId,
	setMessages,
	hasSentFlowData,
	setHasSentFlowData,
	setForceScroll,
	getFlowData,
}: UseMessageHandlerProps): UseMessageHandlerResult {
	const { t } = useTranslation()
	const [isProcessing, setIsProcessing] = useState(false)
	const [streamResponse, setStreamResponse] = useState<ReadableStream<Uint8Array> | null>(null)
	const [processingMessageId, setProcessingMessageId] = useState<string | null>(null)
	const lastMessageCountRef = useRef(1) // 初始有一条欢迎消息

	// 使用sendAgentMessage钩子
	const { sendAgentMessage } = useSendAgentMessage()

	// 处理流处理错误
	const handleStreamError = useMemoizedFn((errorMessage: string) => {
		if (!processingMessageId) return

		setMessages((prev) =>
			prev.map((msg) =>
				msg.id === processingMessageId
					? { ...msg, content: errorMessage, status: "error" }
					: msg,
			),
		)

		// 标记流处理完成，但保持错误状态
		setIsProcessing(false)
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

						// 如果消息状态是error，保持error状态
						if (msg.status === "error") {
							return msg
						}

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

	// 发送消息
	const sendMessage = useMemoizedFn(async (content: string) => {
		if (!content.trim() || isProcessing) return

		const userMessage = content.trim()

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
		lastMessageCountRef.current += 2 // 更新消息计数

		setIsProcessing(true)
		setProcessingMessageId(assistantMessageId)

		try {
			// 使用封装的发送消息函数
			const result = await sendAgentMessage(userMessage, {
				conversationId: conversationId || "temp-conversation",
				includeFlowData: !hasSentFlowData, // 仅在第一次发送时包含流程数据
				getFetchFlowData: getFlowData,
			})

			// 如果是第一次发送，标记已发送流程数据
			if (!hasSentFlowData && getFlowData) {
				setHasSentFlowData(true)
			}

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
				setProcessingMessageId(null)
				return
			}

			// 设置流处理参数
			if (result.stream) {
				setStreamResponse(result.stream)
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
				setProcessingMessageId(null)
			}
		} catch (error) {
			console.error("Error processing message:", error)
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
			setProcessingMessageId(null)
		}
	})

	// 重试消息
	const handleRetryMessage = useMemoizedFn(async (messageId: string) => {
		// 查找要重试的消息
		const messageIndex = setMessages((prevMessages) => {
			const index = prevMessages.findIndex((msg) => msg.id === messageId)
			if (index <= 0) return prevMessages // 消息不存在或者是第一条消息

			// 查找这条消息之前的最近一条用户消息
			let userMessageContent = ""
			let userMessageIndex = -1

			for (let i = index - 1; i >= 0; i -= 1) {
				if (prevMessages[i].role === "user") {
					userMessageContent = prevMessages[i].content
					userMessageIndex = i
					break
				}
			}

			if (!userMessageContent) return prevMessages // 没找到对应的用户消息

			// 移除错误消息
			const newMessages = [...prevMessages]
			newMessages.splice(index, 1)

			// 创建新的助手消息
			const newAssistantMessageId = Date.now().toString()
			const newAssistantMessage: Message = {
				id: newAssistantMessageId,
				role: "assistant",
				content: "",
				status: "loading",
			}

			// 将新消息添加到用户消息后面
			newMessages.splice(userMessageIndex + 1, 0, newAssistantMessage)

			// 异步发送请求
			setTimeout(async () => {
				setIsProcessing(true)
				setProcessingMessageId(newAssistantMessageId)

				try {
					// 使用之前的用户消息重新发送请求
					const result = await sendAgentMessage(userMessageContent, {
						conversationId: conversationId || "temp-conversation",
						includeFlowData: false, // 重试时不需要再次包含流程数据
					})

					// 处理响应
					if (result.isError) {
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
						setProcessingMessageId(null)
						return
					}

					// 设置流处理参数
					if (result.stream) {
						setStreamResponse(result.stream)
					} else if (result.contentStr) {
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
						setProcessingMessageId(null)
					}
				} catch (error) {
					console.error("重试消息失败:", error)
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

					magicToast.error(t("flowAssistant.processError", { ns: "flow" }))
					setIsProcessing(false)
					setProcessingMessageId(null)
				}
			}, 0)

			return newMessages
		})

		// 设置强制滚动以显示新消息
		setForceScroll(true)
	})

	return {
		isProcessing,
		streamResponse,
		processingMessageId,
		sendMessage,
		handleRetryMessage,
		handleStreamError,
		handleStreamComplete,
		setIsProcessing,
		setStreamResponse,
		setProcessingMessageId,
	}
}
