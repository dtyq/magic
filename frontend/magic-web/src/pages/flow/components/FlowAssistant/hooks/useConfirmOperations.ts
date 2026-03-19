import { useMemoizedFn } from "ahooks"
import type { Message } from ".."

/**
 * 确认操作的钩子，用于管理确认操作相关的状态和方法
 */
interface UseConfirmOperationsProps {
	flowId: string
	executeOperations: (operations: any[], flowId: string) => Promise<any[]>
	setMessages: React.Dispatch<React.SetStateAction<Message[]>>
	setForceScroll: React.Dispatch<React.SetStateAction<boolean>>
	sendMessage?: (content: string) => Promise<void>
}

interface UseConfirmOperationsResult {
	handleConfirmOperationCommand: (command: any, messageId: string) => void
	handleConfirmOperation: (operationType: string, data?: any) => Promise<void>
	handleCancelOperation: (operationType: string) => void
}

export function useConfirmOperations({
	flowId,
	executeOperations,
	setMessages,
	setForceScroll,
	sendMessage,
}: UseConfirmOperationsProps): UseConfirmOperationsResult {
	// 处理从流式响应提取确认操作命令
	const handleConfirmOperationCommand = useMemoizedFn((command: any, messageId: string) => {
		if (command && command.type === "confirmOperation" && messageId) {
			console.log("处理确认操作命令:", command, "messageId:", messageId)

			// 从消息中提取确认操作需要的数据
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === messageId
						? {
								...msg,
								confirmOperation: {
									type: "confirmOperation",
									message: command.message || "请确认是否执行此操作？",
									data: command.data || {},
								},
							}
						: msg,
				),
			)

			// 强制滚动确保用户能看到确认按钮
			setForceScroll(true)
		}
	})

	// 处理确认操作 - 发送确认消息
	const handleConfirmOperation = useMemoizedFn(async (operationType: string, data?: any) => {
		// 移除所有消息的确认操作按钮
		setMessages((prev) =>
			prev.map((msg) => ({
				...msg,
				confirmOperation: undefined,
			})),
		)

		// 如果没有提供发送消息的函数，则使用直接执行操作的模式
		if (!sendMessage) {
			try {
				// 创建一个新的助手消息，显示确认处理中
				const assistantMessageId = Date.now().toString()
				const confirmMessage: Message = {
					id: assistantMessageId,
					role: "assistant",
					content: `正在执行${operationType}操作...`,
					status: "loading",
				}

				// 添加确认消息
				setMessages((prev) => [...prev, confirmMessage])
				setForceScroll(true)

				// 执行操作逻辑
				if (operationType === "confirmOperation" && data?.commands) {
					await executeOperations(data.commands, flowId || "")
				}

				// 更新消息为完成状态
				setMessages((prev) =>
					prev.map((msg) =>
						msg.id === assistantMessageId
							? {
									...msg,
									content: "操作已成功执行",
									status: "done",
								}
							: msg,
					),
				)
			} catch (error) {
				console.error("确认操作执行失败:", error)
				const errorMessage = error instanceof Error ? error.message : String(error)

				// 添加错误消息
				const errorMessageId = Date.now().toString()
				setMessages((prev) => [
					...prev,
					{
						id: errorMessageId,
						role: "assistant",
						content: `操作执行失败: ${errorMessage}`,
						status: "error",
					},
				])
				setForceScroll(true)
			}
			return
		}

		// 构建确认操作的消息格式
		let confirmContent = `确认执行`

		// 如果有命令信息，添加命令详情
		if (data && typeof data === "object") {
			const commandInfo = JSON.stringify(data, null, 2)
			confirmContent += `\n\n命令信息: ${commandInfo}`
		}

		// 直接发送确认消息到服务端，让sendMessage函数负责创建和添加用户消息
		try {
			await sendMessage(confirmContent)
		} catch (error) {
			console.error("发送确认消息失败:", error)
		}
	})

	// 处理取消操作 - 发送取消消息
	const handleCancelOperation = useMemoizedFn((operationType: string) => {
		// 移除所有消息的确认操作按钮
		setMessages((prev) =>
			prev.map((msg) => ({
				...msg,
				confirmOperation: undefined,
			})),
		)

		// 如果没有提供发送消息的函数，则使用直接显示取消消息的模式
		if (!sendMessage) {
			// 创建一个新的助手消息，显示操作已取消
			const assistantMessageId = Date.now().toString()
			const cancelMessage: Message = {
				id: assistantMessageId,
				role: "assistant",
				content: `已取消${operationType}操作`,
				status: "done",
			}

			// 添加取消消息
			setMessages((prev) => [...prev, cancelMessage])
			setForceScroll(true)
			return
		}

		// 构建取消操作的消息
		const cancelContent = `取消${operationType}操作`

		// 直接发送取消消息到服务端，让sendMessage函数负责创建和添加用户消息
		try {
			sendMessage(cancelContent).catch((error) => {
				console.error("发送取消消息失败:", error)
			})
		} catch (error) {
			console.error("发送取消消息失败:", error)
		}
	})

	return {
		handleConfirmOperationCommand,
		handleConfirmOperation,
		handleCancelOperation,
	}
}

export default useConfirmOperations
