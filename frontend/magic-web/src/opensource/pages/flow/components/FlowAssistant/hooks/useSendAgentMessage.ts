import { useMemoizedFn } from "ahooks"
import { env } from "@/opensource/utils/env"
import { useGlobalLanguage } from "@/opensource/models/config/hooks"
import { userStore } from "@/opensource/models/user"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface SendMessageOptions {
	includeFlowData?: boolean
	conversationId: string
	getFetchFlowData?: () => string
}

interface SendMessageResult {
	stream: ReadableStream<Uint8Array> | null
	isError: boolean
	errorMessage?: string
	contentStr?: string
}

/**
 * 封装发送消息到Agent的核心逻辑
 */
export const useSendAgentMessage = () => {
	const language = useGlobalLanguage(false)
	/**
	 * 发送消息到Agent并获取响应
	 */
	const sendAgentMessage = useMemoizedFn(
		async (content: string, options: SendMessageOptions): Promise<SendMessageResult> => {
			// 默认结果
			const defaultResult: SendMessageResult = {
				stream: null,
				isError: false,
			}

			try {
				// 构建发送给助手的消息
				let message = `指令: ${content}`

				// 仅在需要时包含流程数据
				if (options.includeFlowData && options.getFetchFlowData) {
					const flowYaml = options.getFetchFlowData()
					message += `\n流程数据:\n${flowYaml}`
				}

				// 直接使用fetch API发送请求
				const apiUrl = `${env("MAGIC_SERVICE_BASE_URL")}/api/v2/magic/flows/built-chat`

				// 针对 magic API请求需要将组织 Code 换成 magic 生态中的组织 Code，而非 teamshare 的组织 Code
				const magicOrganizationCode = userStore.user.organizationCode

				const headers = {
					"Content-Type": "application/json",
					authorization: userStore.user.authorization ?? "",
					"organization-code": magicOrganizationCode ?? "",
					language,
				}

				console.log("发送Agent请求 headers:", headers)

				// 发送请求
				const response = await fetch(apiUrl, {
					method: "POST",
					headers,
					body: JSON.stringify({
						message,
						conversation_id: options.conversationId || "temp-conversation",
						stream: true,
						flow_code: "flow_assistant",
					}),
				})

				// 记录响应信息
				console.log("Agent响应对象:", response)
				console.log("Agent响应状态:", response.status, response.statusText)

				// 检查响应状态
				if (!response.ok) {
					console.error(`请求错误: ${response.status} ${response.statusText}`)

					// 尝试从响应中提取错误信息
					let errorMessage = `服务器返回错误: ${response.status} ${response.statusText}`

					if (response.body) {
						try {
							// 尝试读取错误信息
							const reader = response.body.getReader()
							const decoder = new TextDecoder("utf-8")
							const { value } = await reader.read()

							if (value) {
								// 解码数据
								const errorContent = decoder.decode(value)

								// 如果有错误内容，尝试解析它
								if (errorContent.trim()) {
									try {
										const errorData = JSON.parse(errorContent)
										if (errorData.message) {
											errorMessage = errorData.message
										}
									} catch (e) {
										// 如果不是JSON格式，使用原始错误内容
										errorMessage = errorContent
									}
								}
							}
						} catch (e) {
							console.error("读取错误响应体失败:", e)
						}
					}

					magicToast.error(errorMessage)
					return { ...defaultResult, isError: true, errorMessage }
				}

				// 检查是否是流式响应
				if (
					response.body &&
					response.headers.get("content-type")?.includes("text/event-stream")
				) {
					// 返回流式响应
					return {
						...defaultResult,
						stream: response.body,
					}
				} else {
					// 处理非流式响应，这种情况较少见
					console.log("收到非流式响应:", response)
					try {
						const responseData = await response.json()
						console.log("响应数据:", responseData)

						// 从响应中提取内容
						if (responseData.messages && responseData.messages.length > 0) {
							const contentStr = responseData.messages[0].message.content
							return { ...defaultResult, contentStr }
						} else {
							const errorMessage = "未收到有效响应"
							return { ...defaultResult, isError: true, errorMessage }
						}
					} catch (e) {
						// 如果无法解析响应为JSON
						console.error("解析响应失败:", e)
						const errorMessage = "无法解析服务器响应"
						return { ...defaultResult, isError: true, errorMessage }
					}
				}
			} catch (error) {
				console.error("发送消息处理失败:", error)
				const errorMessage = error instanceof Error ? error.message : String(error)
				magicToast.error(`发送消息失败: ${errorMessage}`)
				return { ...defaultResult, isError: true, errorMessage }
			}
		},
	)

	return {
		sendAgentMessage,
	}
}

export default useSendAgentMessage
