import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { JSONContent } from "@tiptap/core"
import { MentionListItem } from "@/opensource/components/business/MentionPanel/tiptap-plugin/types"
import { ModelItem } from "../../MessageEditor/types"
import { TopicMode } from "../../../pages/Workspace/types"
import { useTranslation } from "react-i18next"
import { RECORD_SUMMARY_EVENTS } from "@/opensource/services/recordSummary/const/events"
import { SuperMagicApi } from "@/opensource/apis"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { useMemoizedFn, useDeepCompareEffect } from "ahooks"
import chatWebSocket from "@/opensource/apis/clients/chatWebSocket"
import recordSummaryStore from "@/opensource/stores/recordingSummary"
import { transformMentions } from "../../MessageEditor/utils/mention"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

export interface QueuedMessage {
	id: string
	content: JSONContent
	mentionItems: MentionListItem[]
	selectedModel?: ModelItem
	selectedImageModel?: ModelItem
	topicMode?: TopicMode
	timestamp: number
	status: "pending" | "processing" | "failed"
	isDeletingLoading?: boolean // 删除操作的loading状态
	isSendingLoading?: boolean // 发送操作的loading状态
	isEditingLoading?: boolean // 编辑操作的loading状态
	topicContext?: string // 话题归属标识，格式：${projectId}-${topicId}
}

export interface UseMessageQueueProps {
	projectId?: string
	topicId?: string
	isTaskRunning?: boolean
	isEmptyStatus?: boolean
	isShowLoadingInit?: boolean
}

function useMessageQueue({
	projectId,
	topicId,
	isTaskRunning,
	isEmptyStatus,
	isShowLoadingInit,
}: UseMessageQueueProps) {
	const { t } = useTranslation("super")
	const [queue, setQueue] = useState<QueuedMessage[]>([])
	const [editingQueueItem, setEditingQueueItem] = useState<QueuedMessage | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	// const isProcessingRef = useRef(false)
	// 操作锁：记录每条消息当前是否有操作在进行
	const operationLocksRef = useRef<Set<string>>(new Set())
	// 用户操作意图：记录用户主动操作的消息ID和操作类型（优先级最高）
	const userOperationIntentRef = useRef<Map<string, "edit" | "delete" | "send">>(new Map())
	// 用ref存储最新的任务运行状态，避免props更新延迟问题
	const isTaskRunningRef = useRef(isTaskRunning)
	// // 用ref存储processNextMessage的引用，避免循环依赖
	// const processNextMessageRef = useRef<(() => void) | null>(null)
	// webSocket断连轮询定时器
	const pollingTimerRef = useRef<NodeJS.Timeout | null>(null)
	// 轮询间隔时间（10秒）
	const POLLING_INTERVAL = 10 * 1000

	// 同步更新任务运行状态的ref
	useEffect(() => {
		isTaskRunningRef.current = isTaskRunning
	}, [isTaskRunning])

	// 锁管理函数
	const acquireLock = useCallback((messageId: string): boolean => {
		if (operationLocksRef.current.has(messageId)) {
			console.warn(`消息 ${messageId} 已有操作在进行中，拒绝新操作`)
			return false
		}
		operationLocksRef.current.add(messageId)
		console.log(`获取消息 ${messageId} 的操作锁`)
		return true
	}, [])

	const releaseLock = useCallback((messageId: string) => {
		operationLocksRef.current.delete(messageId)
		console.log(`释放消息 ${messageId} 的操作锁`)
	}, [])

	// 用户操作意图管理函数
	const setUserOperationIntent = useCallback(
		(messageId: string, operationType: "edit" | "delete" | "send") => {
			userOperationIntentRef.current.set(messageId, operationType)
			console.log(`设置用户操作意图: ${messageId} -> ${operationType}`)
		},
		[],
	)

	const clearUserOperationIntent = useCallback((messageId: string) => {
		userOperationIntentRef.current.delete(messageId)
		console.log(`清除用户操作意图: ${messageId}`)
	}, [])

	// const hasUserOperationIntent = useCallback((messageId: string): boolean => {
	// 	return userOperationIntentRef.current.has(messageId)
	// }, [])

	// // 用户操作完成后检查是否需要恢复队列处理（使用ref避免循环依赖）
	// const checkQueueAfterUserOperation = useCallback(() => {
	// 	// 延迟检查，确保当前操作完全完成
	// 	setTimeout(() => {
	// 		// 检查是否满足自动处理条件
	// 		if (
	// 			!isTaskRunningRef.current && // 没有任务运行
	// 			!editingQueueItem && // 没有编辑中的消息
	// 			queue.length > 0 && // 队列不为空
	// 			projectId && // 有有效的项目ID
	// 			topicId // 有有效的话题ID
	// 		) {
	// 			const currentTopicContext = `${projectId}-${topicId}`
	// 			const hasPendingMessages = queue.some(
	// 				(msg) => msg.status === "pending" && msg.topicContext === currentTopicContext,
	// 			)
	//
	// 			// if (hasPendingMessages && processNextMessageRef.current) {
	// 			// 	console.log("用户操作完成后检测到待处理消息，恢复队列处理")
	// 			// 	processNextMessageRef.current()
	// 			// }
	// 		}
	// 	}, 100) // 短暂延迟确保状态更新完成
	// }, [queue, editingQueueItem, projectId, topicId])

	// 状态映射函数：后端数字状态转前端字符串状态
	const mapStatus = (backendStatus: number): "pending" | "processing" | "failed" => {
		switch (backendStatus) {
			case 0:
				return "pending"
			case 1:
				return "processing"
			case 2:
			case 3:
			default:
				return "failed"
		}
	}

	// 新API格式的消息内容类型
	interface NewMessageContentFormat {
		instructs: Array<{ value: string; instruction: string | null }>
		extra: {
			super_agent: {
				mentions?: MentionListItem[]
				input_mode?: string
				chat_mode?: string
				topic_pattern?: string
				model?: ModelItem
				image_model?: ModelItem
			}
		}
		content: string
	}

	// 将字符串转换为JSONContent格式
	// 反序列化消息内容，适配新的API格式
	const deserializeMessageContent = useCallback(
		(
			messageContent: string | NewMessageContentFormat,
		): {
			content: JSONContent
			mentionItems: MentionListItem[]
			selectedModel?: ModelItem
			selectedImageModel?: ModelItem
			topicMode?: TopicMode
		} => {
			try {
				// 新格式：包含 instructs, extra, content 的对象
				if (
					messageContent &&
					typeof messageContent === "object" &&
					messageContent.content
				) {
					const jsonContent =
						typeof messageContent.content === "string"
							? JSON.parse(messageContent.content)
							: messageContent.content

					const mentions = messageContent.extra?.super_agent?.mentions || []
					const model = messageContent.extra?.super_agent?.model
					const imageModel = messageContent.extra?.super_agent?.image_model
					const topicPattern = messageContent.extra?.super_agent?.topic_pattern as
						| TopicMode
						| undefined

					return {
						content: jsonContent,
						mentionItems: mentions,
						selectedModel: model,
						selectedImageModel: imageModel
							? ({ model_id: imageModel.model_id } as ModelItem)
							: undefined,
						topicMode: topicPattern,
					}
				}

				// 兼容旧格式：字符串形式
				if (typeof messageContent === "string") {
					const parsed = JSON.parse(messageContent)
					// 旧格式1：包含content和mentionItems的对象
					if (
						parsed &&
						typeof parsed === "object" &&
						parsed.content &&
						Array.isArray(parsed.mentionItems)
					) {
						return {
							content: parsed.content,
							mentionItems: parsed.mentionItems,
						}
					}
					// 旧格式2：直接是JSONContent对象
					if (parsed && typeof parsed === "object" && parsed.type) {
						return {
							content: parsed,
							mentionItems: [],
						}
					}
				}
			} catch (error) {
				console.warn("解析消息内容失败:", error)
			}

			// 兜底：当作纯文本处理
			const textContent =
				typeof messageContent === "string" ? messageContent : JSON.stringify(messageContent)
			return {
				content: {
					type: "doc",
					content: [
						{
							type: "paragraph",
							content: [{ type: "text", text: textContent }],
						},
					],
				},
				mentionItems: [],
			}
		},
		[],
	)

	// 获取队列列表
	const fetchQueueList = useMemoizedFn(async () => {
		if (!projectId || !topicId) return

		try {
			setIsLoading(true)

			// 保存当前编辑状态
			const currentEditingQueueItemId = editingQueueItem?.id

			const response = await SuperMagicApi.getMessageQueueList({
				project_id: projectId,
				topic_id: topicId,
			})

			// 转换API响应到本地格式，response直接是数组
			const queueData =
				response?.list?.map(
					(item: {
						queue_id: number
						message_content: string
						status: number
						execute_time?: string | null
						err_message?: string | null
						created_at: string
					}) => {
						// 反序列化消息内容，恢复JSONContent和mentions等信息
						const {
							content,
							mentionItems,
							selectedModel,
							selectedImageModel,
							topicMode,
						} = deserializeMessageContent(item.message_content)
						return {
							id: item.queue_id.toString(),
							content,
							mentionItems,
							selectedModel,
							selectedImageModel,
							topicMode,
							timestamp: new Date(item.created_at).getTime(),
							status: mapStatus(item.status),
							isDeletingLoading: false,
							isSendingLoading: false,
							isEditingLoading: false,
							topicContext: `${projectId}-${topicId}`, // 添加话题归属标识
						}
					},
				) || []

			setQueue(queueData)

			// 如果之前有编辑状态，检查编辑的消息是否还存在
			if (currentEditingQueueItemId) {
				const stillExists = queueData.find(
					(item: QueuedMessage) => item.id === currentEditingQueueItemId,
				)
				if (stillExists) {
					// 如果还存在，检查内容是否有变化再决定是否更新
					// 避免不必要的状态更新导致编辑器内容被重新设置
					const currentItem = editingQueueItem
					const contentChanged =
						JSON.stringify(stillExists.content) !== JSON.stringify(currentItem?.content)
					const mentionsChanged =
						JSON.stringify(stillExists.mentionItems) !==
						JSON.stringify(currentItem?.mentionItems)

					if (contentChanged || mentionsChanged) {
						console.log(
							`维护编辑状态: 消息 ${currentEditingQueueItemId} 内容有变化，更新编辑项`,
						)
						setEditingQueueItem(stillExists)
					} else {
						console.log(
							`维护编辑状态: 消息 ${currentEditingQueueItemId} 仍存在但内容无变化，跳过更新`,
						)
					}
				} else {
					// 如果正在编辑的消息已经被删除（比如被其他地方处理了），清除编辑状态
					console.log(
						`正在编辑的消息 ${currentEditingQueueItemId} 已被移除，清除编辑状态`,
					)
					setEditingQueueItem(null)
				}
			}

			// 返回队列数据供调用者使用
			return queueData
		} catch (error) {
			console.error("Failed to fetch queue list:", error)
			// message.error(t("messageQueue.fetchFailed"))
			return []
		} finally {
			setIsLoading(false)
		}
	})

	const isFloatPanelLoaded = recordSummaryStore.isFloatPanelLoaded
	// 启动轮询
	const startPolling = useCallback(() => {
		// 如果已经有轮询定时器，先清除
		if (pollingTimerRef.current) {
			clearInterval(pollingTimerRef.current)
			pollingTimerRef.current = null
		}

		// 只有在有有效的项目ID和话题ID时才启动轮询
		if (!projectId || !topicId) {
			console.log("缺少 projectId 或 topicId，跳过启动轮询")
			return
		}

		console.log("启动消息队列轮询，间隔: 15秒")
		// 立即执行一次
		fetchQueueList()

		// 启动定时轮询
		pollingTimerRef.current = setInterval(() => {
			console.log("执行消息队列轮询拉取")
			fetchQueueList()
		}, POLLING_INTERVAL)
	}, [projectId, topicId, fetchQueueList, POLLING_INTERVAL])

	// 停止轮询
	const stopPolling = useMemoizedFn(() => {
		// WebSocket 重连后，最后获取一次最新队列数据，确保数据同步
		fetchQueueList()
		if (pollingTimerRef.current) {
			console.log("停止消息队列轮询")
			clearInterval(pollingTimerRef.current)
			pollingTimerRef.current = null
		}
	})

	// 监听webSocket连接状态，管理轮询
	useDeepCompareEffect(() => {
		// 检查初始连接状态
		const isConnected = chatWebSocket.isConnected

		if (!isConnected && projectId && topicId) {
			// 如果一开始就是断连状态，启动轮询
			console.log("检测到 webSocket 断连，启动轮询")
			startPolling()
		}

		// 监听webSocket关闭事件
		const handleClose = () => {
			console.log("webSocket 连接关闭，启动轮询")
			startPolling()
		}

		// 监听webSocket打开事件
		const handleOpen = () => {
			console.log("webSocket 连接建立，停止轮询")
			stopPolling()
		}

		chatWebSocket.on("close", handleClose)
		chatWebSocket.on("open", handleOpen)

		// 清理函数
		return () => {
			chatWebSocket.off("close", handleClose)
			chatWebSocket.off("open", handleOpen)
			stopPolling()
		}
	}, [projectId, topicId])

	// 录音完成时，刷新队列列表
	useEffect(() => {
		if (!isFloatPanelLoaded) return

		let unsubscribe: (() => void) | undefined
		let cancelled = false

		;(async () => {
			try {
				const { initializeService } =
					await import("@/opensource/services/recordSummary/serviceInstance")

				const recordSummaryService = initializeService()

				if (cancelled || !recordSummaryService?.on) return
				unsubscribe = recordSummaryService.on(
					RECORD_SUMMARY_EVENTS.RECORDING_COMPLETE,
					() => {
						fetchQueueList?.()
					},
				)
			} catch (error) {
				console.error("Failed to bind recording complete listener", error)
			}
		})()

		return () => {
			cancelled = true
			if (unsubscribe) unsubscribe()
		}
	}, [fetchQueueList, isFloatPanelLoaded])

	// 将消息信息序列化为新的API格式
	const serializeMessageContent = (
		content: JSONContent,
		mentionItems: MentionListItem[],
		selectedModel?: ModelItem | null,
		selectedImageModel?: ModelItem | null,
		topicMode?: TopicMode,
		inputMode?: string,
	) => {
		const modelObj = selectedModel
			? {
					model_id: selectedModel.model_id,
				}
			: { model_id: "auto" }

		const imageModelObj = selectedImageModel?.model_id
			? {
					model_id: selectedImageModel.model_id,
				}
			: undefined

		// 转换 mention items，自定义发送给 agent 的内容
		const transformedMentionItems = transformMentions(mentionItems)

		return {
			instructs: [
				{
					value: inputMode || "plan",
					instruction: null,
				},
			],
			extra: {
				super_agent: {
					mentions: transformedMentionItems,
					input_mode: inputMode || "plan",
					chat_mode: "normal",
					topic_pattern: topicMode || "general",
					model: modelObj,
					...(imageModelObj && { image_model: imageModelObj }),
				},
			},
			content: JSON.stringify(content),
		}
	}

	// 添加消息到队列
	const addToQueue = useCallback(
		async (params: {
			content: JSONContent
			mentionItems: MentionListItem[]
			selectedModel?: ModelItem | null
			selectedImageModel?: ModelItem | null
			topicMode?: TopicMode
		}) => {
			if (!projectId || !topicId) {
				magicToast.error(t("messageQueue.missingInfo"))
				return
			}

			try {
				// 将完整的消息信息序列化为新的API格式
				const messageContentData = serializeMessageContent(
					params.content,
					params.mentionItems,
					params.selectedModel,
					params.selectedImageModel,
					params.topicMode,
					"plan", // 默认input_mode
				)

				// 调用后端API添加到队列
				const response = await SuperMagicApi.addMessageToQueue({
					project_id: projectId,
					topic_id: topicId,
					message_type: "rich_text",
					message_content: messageContentData,
				})

				// 成功后刷新队列列表
				await fetchQueueList()
				magicToast.success(t("messageQueue.addSuccess"))

				return response?.queue_id
			} catch (error) {
				console.error("Failed to add message to queue:", error)
				// message.error(t("messageQueue.addFailed"))
			}
		},
		[projectId, topicId, fetchQueueList, t],
	)

	// 从队列中删除消息
	const removeFromQueue = useCallback(
		async (messageId: string) => {
			// 🔥 立即设置删除意图
			// setUserOperationIntent(messageId, "delete")

			// 尝试获取操作锁（现在基本不会失败，因为自动处理会检查意图）
			if (!acquireLock(messageId)) {
				clearUserOperationIntent(messageId) // 失败时清除意图
				magicToast.warning(t("messageQueue.operationInProgress"))
				return
			}

			try {
				// 设置删除loading状态
				setQueue((prevQueue) =>
					prevQueue.map((msg) =>
						msg.id === messageId ? { ...msg, isDeletingLoading: true } : msg,
					),
				)

				// 调用后端API删除
				await SuperMagicApi.deleteQueueMessage({ messageId })

				// 成功后刷新队列列表
				await fetchQueueList()
				magicToast.success(t("messageQueue.deleteSuccess"))
			} catch (error) {
				console.error("Failed to delete message from queue:", error)
				// message.error(t("messageQueue.deleteFailed"))

				// 失败时移除loading状态
				setQueue((prevQueue) =>
					prevQueue.map((msg) =>
						msg.id === messageId ? { ...msg, isDeletingLoading: false } : msg,
					),
				)
			} finally {
				// 无论成功失败都要释放锁和清除意图
				releaseLock(messageId)
				clearUserOperationIntent(messageId) // 完成后清除意图

				// 🔥 检查是否需要恢复队列处理
				// checkQueueAfterUserOperation()
			}
		},
		[
			fetchQueueList,
			t,
			acquireLock,
			releaseLock,
			// setUserOperationIntent,
			clearUserOperationIntent,
			// checkQueueAfterUserOperation,
		],
	)

	// 直接发送队列中的消息
	const sendQueuedMessage = useCallback(
		async (messageId: string, isUserInitiated = false, queueData?: QueuedMessage[]) => {
			// 使用传入的队列数据或当前状态中的队列数据
			const currentQueue = queueData || queue
			const queueMessage = currentQueue.find((msg) => msg.id === messageId)
			if (!queueMessage) return

			// 新增：验证消息是否属于当前话题
			const currentTopicContext = `${projectId}-${topicId}`
			if (queueMessage.topicContext !== currentTopicContext) {
				console.warn(`消息 ${messageId} 不属于当前话题 (${currentTopicContext})，取消发送`)
				return
			}

			// 如果要发送的消息正在编辑中，且不是用户主动发起的，则拒绝发送
			if (editingQueueItem && editingQueueItem.id === messageId && !isUserInitiated) {
				console.warn(`消息 ${messageId} 正在编辑中，拒绝自动发送`)
				return
			}

			// 尝试获取操作锁
			if (!acquireLock(messageId)) {
				if (isUserInitiated) {
					magicToast.warning(t("messageQueue.operationInProgress"))
				}
				return
			}

			// 只有用户主动发送正在编辑的消息时，才清除编辑状态
			if (editingQueueItem && editingQueueItem.id === messageId && isUserInitiated) {
				setEditingQueueItem(null)
			}

			try {
				// 设置发送loading状态
				setQueue((prevQueue) =>
					prevQueue.map((msg) =>
						msg.id === messageId
							? { ...msg, isSendingLoading: true, status: "processing" }
							: msg,
					),
				)

				// 先调用消费消息API
				await SuperMagicApi.consumeQueueMessage({ messageId })

				// 发送成功后刷新队列列表
				await fetchQueueList()
				magicToast.success(t("messageQueue.sendSuccess"))
			} catch (error) {
				console.error("Failed to send queued message:", error)
				// message.error(t("messageQueue.sendFailed"))

				// 失败时更新状态
				setQueue((prevQueue) =>
					prevQueue.map((msg) =>
						msg.id === messageId
							? { ...msg, isSendingLoading: false, status: "failed" }
							: msg,
					),
				)
			} finally {
				// 无论成功失败都要释放锁
				releaseLock(messageId)
			}
		},
		[queue, fetchQueueList, t, editingQueueItem, acquireLock, releaseLock, projectId, topicId],
	)

	// // 处理下一个队列消息
	// const processNextMessage = useCallback(
	// 	async (queueData?: QueuedMessage[], isTopicSwitch = false) => {
	// 		if (isEmptyStatus) {
	// 			return
	// 		}
	// 		if (isProcessingRef.current) return
	//
	// 		// 使用ref获取最新的任务运行状态
	// 		if (isTaskRunningRef.current) {
	// 			if (isTopicSwitch) {
	// 				// 话题切换时，延迟重试而不是立即处理
	// 				console.log(`话题切换检测到全局任务运行，延迟检查队列`)
	// 				setTimeout(() => {
	// 					processNextMessage(queueData, false) // 移除话题切换标记
	// 				}, 1000)
	// 				return
	// 			}
	// 			return
	// 		}
	//
	// 		// 安全检查：确保当前有有效的话题ID，避免在话题切换时处理错误的队列
	// 		if (!projectId || !topicId) {
	// 			console.warn("缺少 projectId 或 topicId，跳过队列消息处理")
	// 			return
	// 		}
	//
	// 		// 使用传入的队列数据或当前状态中的队列数据
	// 		const currentQueue = queueData || queue
	//
	// 		// 如果队列为空，直接返回
	// 		if (currentQueue.length === 0) return
	//
	// 		// 新增：检查队列数据的话题归属
	// 		const currentTopicContext = `${projectId}-${topicId}`
	// 		const validMessages = currentQueue.filter(
	// 			(msg) => msg.topicContext === currentTopicContext,
	// 		)
	//
	// 		// 如果没有属于当前话题的消息，说明数据过期了，需要重新获取
	// 		if (validMessages.length === 0) {
	// 			console.log("队列中无当前话题消息，需要重新获取数据")
	// 			return
	// 		}
	//
	// 		// 如果有编辑中的消息，找到编辑消息的位置
	// 		let editingIndex = -1
	// 		if (editingQueueItem) {
	// 			editingIndex = validMessages.findIndex((msg) => msg.id === editingQueueItem.id)
	// 		}
	//
	// 		// 在有效消息中查找下一个可处理的消息
	// 		const nextMessage = validMessages.find((msg, index) => {
	// 			// 消息必须是pending状态
	// 			if (msg.status !== "pending") return false
	//
	// 			// 如果有编辑中的消息，只处理编辑消息之前的消息
	// 			if (editingIndex >= 0 && index >= editingIndex) return false
	//
	// 			return true
	// 		})
	//
	// 		if (!nextMessage) return
	//
	// 		// 🔥 关键：在消费消息前检查用户操作意图
	// 		if (hasUserOperationIntent(nextMessage.id)) {
	// 			const intentType = userOperationIntentRef.current.get(nextMessage.id)
	// 			console.log(`检测到用户操作意图 ${intentType}，取消自动处理消息: ${nextMessage.id}`)
	// 			return // 直接退出，不处理
	// 		}
	//
	// 		// 最后一次安全检查：确保话题ID没有在处理过程中发生变化
	// 		const currentProjectId = projectId
	// 		const currentTopicId = topicId
	//
	// 		console.log(
	// 			`开始自动处理队列消息: ${nextMessage.id}, 项目: ${currentProjectId}, 话题: ${currentTopicId}`,
	// 		)
	//
	// 		isProcessingRef.current = true
	// 		try {
	// 			// 🔥 执行前再次检查（双重保险）
	// 			if (hasUserOperationIntent(nextMessage.id)) {
	// 				console.log(`执行前检测到用户操作意图，取消处理: ${nextMessage.id}`)
	// 				return
	// 			}
	//
	// 			// 在实际发送前再次检查话题ID是否一致
	// 			if (projectId === currentProjectId && topicId === currentTopicId) {
	// 				await sendQueuedMessage(nextMessage.id, false, currentQueue)
	// 			} else {
	// 				console.warn(`话题已切换，取消处理队列消息: ${nextMessage.id}`)
	// 			}
	// 		} finally {
	// 			isProcessingRef.current = false
	// 		}
	// 	},
	// 	[
	// 		isEmptyStatus,
	// 		projectId,
	// 		topicId,
	// 		queue,
	// 		editingQueueItem,
	// 		hasUserOperationIntent,
	// 		sendQueuedMessage,
	// 	],
	// )

	// // 设置 processNextMessage 的 ref 引用
	// processNextMessageRef.current = processNextMessage

	// 清空队列
	const clearQueue = useCallback(() => {
		setQueue([])
	}, [])

	// 开始编辑队列项
	const startEditQueueItem = useCallback(
		(queueId: string) => {
			// 🔥 立即设置编辑意图，抢在自动处理之前
			// setUserOperationIntent(queueId, "edit")

			const item = queue.find((msg) => msg.id === queueId)
			if (item) {
				setEditingQueueItem(item)
			}
		},
		[queue],
	)

	// 取消编辑队列项
	const cancelEditQueueItem = useCallback(() => {
		if (editingQueueItem) {
			clearUserOperationIntent(editingQueueItem.id)
		}
		setEditingQueueItem(null)
		// ✅ 不需要手动恢复队列处理，useUpdateEffect 会自动处理
	}, [editingQueueItem, clearUserOperationIntent])

	// 完成编辑队列项
	const finishEditQueueItem = useCallback(
		async (newContent: JSONContent | undefined, mentionItems: MentionListItem[]) => {
			if (!editingQueueItem || !projectId || !topicId) {
				return
			}

			// 尝试获取操作锁
			if (!acquireLock(editingQueueItem.id)) {
				magicToast.warning(t("messageQueue.operationInProgress"))
				return
			}

			// TODO: 暂时未使用 mentionItems，将来可能需要支持编辑时的mentions
			console.log("编辑队列项，mentions数量:", mentionItems.length)

			try {
				// 如果新内容为空，使用原内容
				const finalContent = newContent || editingQueueItem.content
				// 如果新mentions为空，使用原mentions
				const finalMentions = mentionItems || editingQueueItem.mentionItems
				// 使用原有的模型和模式信息
				const finalModel = editingQueueItem.selectedModel
				const finalImageModel = editingQueueItem.selectedImageModel
				const finalTopicMode = editingQueueItem.topicMode

				// 将完整的消息信息序列化为新的API格式
				const messageContentData = serializeMessageContent(
					finalContent,
					finalMentions,
					finalModel,
					finalImageModel,
					finalTopicMode,
					"plan", // 默认input_mode
				)

				// 设置编辑loading状态
				setQueue((prev) =>
					prev.map((item) =>
						item.id === editingQueueItem.id
							? { ...item, isEditingLoading: true }
							: item,
					),
				)

				// 调用后端API更新
				await SuperMagicApi.updateQueueMessage({
					messageId: editingQueueItem.id,
					project_id: projectId,
					topic_id: topicId,
					message_type: "rich_text",
					message_content: messageContentData,
				})

				// 成功后刷新队列列表
				await fetchQueueList()
				magicToast.success(t("messageQueue.updateSuccess"))

				// 清除编辑状态
				setEditingQueueItem(null)
			} catch (error) {
				console.error("Failed to update queue message:", error)
				// message.error(t("messageQueue.updateFailed"))

				// 失败时移除loading状态
				setQueue((prev) =>
					prev.map((item) =>
						item.id === editingQueueItem.id
							? { ...item, isEditingLoading: false }
							: item,
					),
				)
			} finally {
				// 无论成功失败都要释放锁和清除意图
				releaseLock(editingQueueItem.id)
				clearUserOperationIntent(editingQueueItem.id) // 完成后清除意图
				// ✅ 不需要手动恢复队列处理：
				// - 成功时：setEditingQueueItem(null) 会触发 useUpdateEffect 自动恢复
				// - 失败时：编辑状态保持，不应该恢复队列处理
			}
		},
		[
			editingQueueItem,
			projectId,
			topicId,
			fetchQueueList,
			t,
			acquireLock,
			releaseLock,
			clearUserOperationIntent,
		],
	)

	// 获取队列统计信息
	const queueStats = useMemo(() => {
		return {
			total: queue.length,
			pending: queue.filter((msg) => msg.status === "pending").length,
			processing: queue.filter((msg) => msg.status === "processing").length,
			failed: queue.filter((msg) => msg.status === "failed").length,
		}
	}, [queue])

	// 话题切换时的处理逻辑
	useEffect(() => {
		// 当话题或项目ID变更时，取消进行中的操作并清理状态
		console.log(`话题变更，项目: ${projectId}, 话题: ${topicId}`)

		// 1. 清除编辑状态、锁和用户操作意图
		setEditingQueueItem(null)
		operationLocksRef.current.clear()
		// userOperationIntentRef.current.clear() // 清除所有用户操作意图

		// 2. 如果有有效话题，获取新数据；否则清空队列
		if (projectId && topicId && isShowLoadingInit) {
			// 不立即清空队列，让 fetchQueueList 自然更新
			// 这样 processNextMessage 在数据更新前不会误判
			fetchQueueList().then((_queueData) => {
				// // 数据获取完成后检查是否需要主动处理队列
				// const hasPendingMessages =
				// 	queueData && queueData.some((msg: QueuedMessage) => msg.status === "pending")
				// if (hasPendingMessages) {
				// 	// 直接传入获取到的队列数据，避免状态更新延迟问题
				// 	// 标记为话题切换触发的检查
				//
				// 	setTimeout(() => {
				// 		processNextMessage(queueData, true)
				// 	}, 500)
				// }
			})
		} else {
			// 只有在没有有效话题时才清空
			setQueue([])
		}
	}, [topicId, projectId, isShowLoadingInit])

	useEffect(() => {
		const handler = () => {
			fetchQueueList?.()
		}
		pubsub.subscribe(PubSubEvents.SuperMagicMessageQueueConsumed, handler)
		return () => pubsub.unsubscribe(PubSubEvents.SuperMagicMessageQueueConsumed, handler)
	}, [])

	// // 当任务完成时，自动处理下一个消息
	// useUpdateEffect(() => {
	// 	// 确保有有效的 projectId 和 topicId 才进行队列处理
	// 	if (!isTaskRunningRef.current && queue.length > 0 && projectId && topicId) {
	// 		console.log(`任务完成，准备处理队列消息，项目: ${projectId}, 话题: ${topicId}`)
	// 		// 延迟处理，确保当前任务完全结束
	// 		const timer = setTimeout(() => {
	// 			processNextMessage()
	// 		}, 500)
	//
	// 		return () => clearTimeout(timer)
	// 	}
	// }, [isTaskRunning]) // 只监听 isTaskRunning，不监听话题ID

	// // 当编辑状态退出时，恢复自动处理消息
	// useUpdateEffect(() => {
	// 	// 当编辑状态从有变为无时，尝试处理下一个消息
	// 	if (
	// 		!editingQueueItem &&
	// 		!isTaskRunningRef.current &&
	// 		queue.length > 0 &&
	// 		projectId &&
	// 		topicId
	// 	) {
	// 		console.log(`编辑状态退出，恢复队列处理，项目: ${projectId}, 话题: ${topicId}`)
	// 		const timer = setTimeout(() => {
	// 			processNextMessage()
	// 		}, 100)
	//
	// 		return () => clearTimeout(timer)
	// 	}
	// }, [editingQueueItem]) // 只监听 editingQueueItem，不监听话题ID

	// 用户主动发送队列消息的包装函数
	const sendQueuedMessageByUser = useCallback(
		(messageId: string) => {
			// 🔥 立即设置发送意图
			setUserOperationIntent(messageId, "send")

			// 调用实际发送，传入用户主动标记
			return sendQueuedMessage(messageId, true, queue).finally(() => {
				clearUserOperationIntent(messageId) // 完成后清除意图
			})
		},
		[sendQueuedMessage, queue, setUserOperationIntent, clearUserOperationIntent],
	)

	return {
		queue,
		queueStats,
		editingQueueItem,
		isLoading,
		addToQueue,
		removeFromQueue,
		sendQueuedMessage: sendQueuedMessageByUser, // 返回的是用户主动发送版本
		startEditQueueItem,
		cancelEditQueueItem,
		finishEditQueueItem,
		clearQueue,
		// processNextMessage,
		fetchQueueList,
	}
}

export default useMessageQueue
