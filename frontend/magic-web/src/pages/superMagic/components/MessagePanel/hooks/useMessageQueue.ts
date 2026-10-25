import modelCache from "@/services/superMagic/topicModel/SuperMagicTopicModelCacheService"
import {
	createElement,
	useState,
	useCallback,
	useRef,
	useEffect,
	useMemo,
	type RefObject,
} from "react"
import { JSONContent } from "@/infrastructure/editors/tiptap/core"
import { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import { ModelItem, type MessageEditorRef, type QueueMessageInput } from "../../MessageEditor/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { useTranslation } from "react-i18next"
import { RECORD_SUMMARY_EVENTS } from "@/services/recordSummary/const/events"
import { SuperMagicApi } from "@/apis"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useMemoizedFn, useDeepCompareEffect, useUpdateEffect } from "ahooks"
import chatWebSocket from "@/apis/clients/chatWebSocket"
import recordSummaryStore from "@/stores/recordingSummary"
import magicToast from "@/components/base/MagicToaster/utils"
import MagicModal from "@/components/base/MagicModal"
import { normalizeQueuePreviewText } from "../components/MessageQueue/utils"
import localstorage from "@/utils/localstorage"
import { platformKey } from "@/utils/storage"
import { userStore } from "@/models/user"
import { getNetworkMonitor } from "@/services/recordSummary/NetworkMonitor"
import useQueueDraft from "./useQueueDraft"
import { serializeMessageContent } from "@/pages/superMagic/services/messageQueueSerialization"
import { resolveAgentSelection } from "@/services/superMagic/DefaultAgentSelectionService"
import type { SuperMagicMessageQueueMessage } from "@/types/chat/intermediate_message"

// Local queue only stores items that cannot be submitted to the server while offline; the server queue remains the source of truth after reconnect.
const CLIENT_MESSAGE_QUEUE_STORAGE_ROOT = "super_magic/message_queue/client"

export interface QueuedMessage {
	id: string
	sortOrder?: string
	content: JSONContent
	mentionItems: MentionListItem[]
	dynamicParams?: Record<string, unknown>
	selectedModel?: ModelItem
	selectedImageModel?: ModelItem
	selectedVideoModel?: ModelItem
	topicMode?: TopicMode
	agentCode?: string
	timestamp: number
	status: "pending" | "processing" | "failed"
	isDeletingLoading?: boolean // 删除操作的loading状态
	isSendingLoading?: boolean // 发送操作的loading状态
	isEditingLoading?: boolean // 编辑操作的loading状态
	topicContext?: string // Topic ownership identifier, format: ${projectId}-${topicId}
	clientSyncId?: string // Correlation ID between local queue and server-returned queue, used for dedup and preserving original order after recovery.
	syncState?: "local" | "submitted" | "detached" // "local" = only on client; "submitted" = posted to server but not yet returned in server queue list.
}

interface StoredClientMessageQueue {
	topics?: Record<string, QueuedMessage[]>
}

function getClientQueueStorageKey() {
	// Isolate local queues by user and org to prevent reading another user's offline queue after account switch.
	const userInfo = userStore.user.userInfo
	const userId = userInfo?.magic_id || userInfo?.user_id
	if (!userId) return undefined

	return platformKey(
		`${CLIENT_MESSAGE_QUEUE_STORAGE_ROOT}/${userId}/${userInfo?.organization_code || "unknown"}`,
	)
}

function normalizeClientQueue(
	queueItems: QueuedMessage[] | undefined,
	topicContext: string,
): QueuedMessage[] {
	// Keep only local-synced queue items for the current topic, dedup by clientSyncId to avoid in-memory / localStorage duplicates.
	if (!Array.isArray(queueItems) || !topicContext) return []

	const queueMap = new Map<string, QueuedMessage>()
	queueItems.forEach((item) => {
		if (!item?.syncState || item.topicContext !== topicContext) return
		queueMap.set(item.clientSyncId || item.id, item)
	})

	return Array.from(queueMap.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
}

function loadClientQueueTopics(storageKey = getClientQueueStorageKey()) {
	// Read all topic local queue snapshots; topic-level filtering is delegated to normalizeClientQueue.
	if (!storageKey) return {}

	const storedQueue = localstorage.get(storageKey, true) as StoredClientMessageQueue
	return storedQueue?.topics || {}
}

function saveClientQueueTopics(
	topics: Record<string, QueuedMessage[]>,
	storageKey = getClientQueueStorageKey(),
) {
	// 保存前统一清理空话题和重复项，队列为空时直接删除 storage，避免残留无效快照。
	if (!storageKey) return

	const normalizedTopics = Object.entries(topics).reduce<Record<string, QueuedMessage[]>>(
		(acc, [topicContext, queueItems]) => {
			const normalizedQueue = normalizeClientQueue(queueItems, topicContext)
			if (normalizedQueue.length > 0) acc[topicContext] = normalizedQueue
			return acc
		},
		{},
	)

	if (Object.keys(normalizedTopics).length === 0) {
		localstorage.remove(storageKey)
		return
	}

	localstorage.set(storageKey, {
		topics: normalizedTopics,
	})
}

async function updateTopicClientQueue(
	topicContext: string,
	updater: (queueItems: QueuedMessage[]) => QueuedMessage[],
	requireLock = false,
): Promise<QueuedMessage[]> {
	const storageKey = getClientQueueStorageKey()
	if (!topicContext || !storageKey) return []
	const update = () => {
		const currentTopics = loadClientQueueTopics(storageKey)
		const nextQueue = normalizeClientQueue(
			updater(currentTopics[topicContext] || []),
			topicContext,
		)
		const nextTopics = { ...currentTopics }
		if (nextQueue.length > 0) nextTopics[topicContext] = nextQueue
		else delete nextTopics[topicContext]
		saveClientQueueTopics(nextTopics, storageKey)
		return nextQueue
	}
	// 同源各页面共享锁；锁只包住本地读改写，不占用网络请求或编辑过程。
	if (navigator.locks) return navigator.locks.request(storageKey, update)
	if (requireLock) throw new Error("local_queue_lock_unavailable")
	return update()
}

function getTopicClientQueue(topicContext: string) {
	// Restore a single topic's local queue, used to display offline-appended items immediately after refresh.
	if (!topicContext) return []
	return normalizeClientQueue(loadClientQueueTopics()[topicContext], topicContext)
}

export interface UseMessageQueueProps {
	editorRef?: RefObject<MessageEditorRef | null>
	projectId?: string
	topicId?: string
	agentCode?: string
	isTaskRunning?: boolean
	isWaitingForUser?: boolean
	isEmptyStatus?: boolean
	isShowLoadingInit?: boolean
}

function useMessageQueue({
	editorRef: providedEditorRef,
	projectId,
	topicId,
	agentCode,
	isTaskRunning,
	isWaitingForUser,
}: UseMessageQueueProps) {
	const { t } = useTranslation("super")
	const [queue, setQueue] = useState<QueuedMessage[]>([])
	const internalEditorRef = useRef<MessageEditorRef | null>(null)
	const editorRef = providedEditorRef ?? internalEditorRef
	const queueVersionRef = useRef(0)
	const queueFetchRequestRef = useRef(0)
	const currentScopeRef = useRef("")
	currentScopeRef.current = `${getClientQueueStorageKey()}/${projectId}/${topicId}`
	const deleteConfirmationRef = useRef<{ destroy: () => void } | null>(null)
	const deletionScope = currentScopeRef.current
	useEffect(() => () => deleteConfirmationRef.current?.destroy(), [deletionScope])
	const [isLoading, setIsLoading] = useState(false)
	const operationLocksRef = useRef<Set<string>>(new Set())
	const [isMutating, setIsMutating] = useState(false)
	// 用户操作意图：记录用户主动操作的消息ID和操作类型（优先级最高）
	const userOperationIntentRef = useRef<Map<string, "edit" | "delete" | "send">>(new Map())
	// 用ref存储最新的任务运行状态，避免props更新延迟问题
	const isTaskRunningRef = useRef(isTaskRunning)
	const queueRef = useRef(queue)
	const syncLocalQueueLockRef = useRef(false)
	// webSocket断连轮询定时器
	const pollingTimerRef = useRef<NodeJS.Timeout | null>(null)
	// 轮询间隔时间（10秒）
	const POLLING_INTERVAL = 10 * 1000

	// 同步更新任务运行状态的ref
	useEffect(() => {
		isTaskRunningRef.current = isTaskRunning
	}, [isTaskRunning])

	useEffect(() => {
		queueRef.current = queue
	}, [queue])

	// Current topic queue ownership key; local queue restoration, dedup, and server reconciliation all rely on this for topic isolation.
	const currentTopicContext = useMemo(() => {
		if (!projectId || !topicId) return ""
		return `${projectId}-${topicId}`
	}, [projectId, topicId])

	const mergeQueueItems = useMemoizedFn(
		(serverQueueItems: QueuedMessage[], localQueueItems: QueuedMessage[] = []) => {
			// 服务端顺序决定实际消费；离线项只在本地按创建次序等待串行上传。
			const all = [...serverQueueItems, ...localQueueItems]
			return [
				...all.filter((item) => !item.syncState),
				...all
					.filter((item) => item.syncState)
					.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)),
			]
		},
	)

	const buildLocalQueueId = useMemoizedFn(
		// No server queue_id when enqueuing offline; the local ID doubles as both display ID and clientSyncId.
		() => `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
	)

	const getNextLocalQueueTimestamp = useMemoizedFn(
		(topicContext: string = currentTopicContext) => {
			if (!topicContext) return Date.now()

			const currentQueueItems = getCurrentTopicClientQueue(topicContext)
			const lastTimestamp = currentQueueItems[currentQueueItems.length - 1]?.timestamp || 0
			const now = Date.now()
			// Local offline queue needs monotonically increasing timestamps to avoid sort distortion when 3/4/5 are enqueued in the same millisecond.
			return now > lastTimestamp ? now : lastTimestamp + 1
		},
	)

	const getCurrentTopicClientQueue = useMemoizedFn(
		(topicContext: string = currentTopicContext) => {
			// 持久化列表是离线待办的依据；不能把其他页面已取出的内存副本合并回来。
			return getTopicClientQueue(topicContext).filter((item) => item.syncState !== "detached")
		},
	)

	// 锁管理函数
	const acquireLock = useCallback((messageId: string): boolean => {
		if (operationLocksRef.current.size > 0) {
			console.warn(`消息 ${messageId} 已有操作在进行中，拒绝新操作`)
			return false
		}
		operationLocksRef.current.add(messageId)
		setIsMutating(true)
		console.log(`获取消息 ${messageId} 的操作锁`)
		return true
	}, [])

	const releaseLock = useCallback((messageId: string) => {
		operationLocksRef.current.delete(messageId)
		setIsMutating(operationLocksRef.current.size > 0)
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

	// 状态映射函数：后端数字状态转前端字符串状态
	const mapStatus = (backendStatus: number): "pending" | "processing" | "failed" | null => {
		switch (backendStatus) {
			case 0:
				return "pending"
			case 1:
				return null
			case 2:
				return "failed"
			case 3:
				return "processing"
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
				agent_code?: string
				model?: ModelItem
				image_model?: ModelItem
				video_model?: ModelItem
				client_queue_sync_id?: string
				dynamic_params?: Record<string, unknown>
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
			selectedVideoModel?: ModelItem
			topicMode?: TopicMode
			agentCode?: string
			dynamicParams?: Record<string, unknown>
			clientSyncId?: string
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
					const videoModel = messageContent.extra?.super_agent?.video_model
					const agentCode = messageContent.extra?.super_agent?.agent_code
					const clientSyncId = messageContent.extra?.super_agent?.client_queue_sync_id
					const dynamicParams = messageContent.extra?.super_agent?.dynamic_params
					const topicPattern = messageContent.extra?.super_agent?.topic_pattern as
						TopicMode | undefined

					return {
						content: jsonContent,
						mentionItems: mentions,
						selectedModel: model
							? { ...model, reasoning_effort: model.reasoning_effort ?? null }
							: undefined,
						selectedImageModel: imageModel,
						selectedVideoModel: videoModel,
						topicMode: topicPattern,
						agentCode,
						dynamicParams,
						clientSyncId,
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
	const fetchQueueList = useMemoizedFn(async (options?: { updateState?: boolean }) => {
		if (!projectId || !topicId) return []

		try {
			const shouldUpdateState = options?.updateState !== false
			if (shouldUpdateState) setIsLoading(true)

			const requestScope = currentScopeRef.current
			const requestVersion = queueVersionRef.current
			const requestId = ++queueFetchRequestRef.current

			const response = await SuperMagicApi.getMessageQueueList({
				project_id: projectId,
				topic_id: topicId,
			})

			if (
				requestId !== queueFetchRequestRef.current ||
				requestScope !== currentScopeRef.current ||
				requestVersion !== queueVersionRef.current
			)
				return []

			// 转换API响应到本地格式，response直接是数组
			const queueData =
				response?.list?.map(
					(item: {
						queue_id: string
						message_content: string
						status: number
						execute_time?: string | null
						err_message?: string | null
						created_at: string
						sort_order: string
					}) => {
						// 反序列化消息内容，恢复JSONContent和mentions等信息
						const {
							content,
							mentionItems,
							selectedModel,
							selectedImageModel,
							selectedVideoModel,
							topicMode,
							agentCode,
							dynamicParams,
							clientSyncId,
						} = deserializeMessageContent(item.message_content)
						return {
							id: item.queue_id,
							sortOrder: item.sort_order,
							content,
							mentionItems,
							selectedModel,
							selectedImageModel,
							selectedVideoModel,
							topicMode,
							agentCode,
							dynamicParams,
							clientSyncId,
							timestamp: new Date(item.created_at).getTime(),
							status: mapStatus(item.status),
							isDeletingLoading: false,
							isSendingLoading: false,
							isEditingLoading: false,
							topicContext: `${projectId}-${topicId}`, // Attach topic ownership identifier
						}
					},
				) || []
			const activeQueueData = queueData.filter(
				(item: { status: QueuedMessage["status"] | null }): item is QueuedMessage =>
					item.status !== null,
			)

			const persistedClientQueue = getCurrentTopicClientQueue(currentTopicContext)
			const serverClientSyncIds = new Set(
				queueData
					.map((item: { clientSyncId?: string }) => item.clientSyncId)
					.filter(Boolean),
			)
			if (shouldUpdateState) {
				await updateTopicClientQueue(currentTopicContext, (queueItems) =>
					queueItems.filter(
						(item) =>
							!(item.clientSyncId && serverClientSyncIds.has(item.clientSyncId)),
					),
				)
			}
			if (
				requestId !== queueFetchRequestRef.current ||
				requestScope !== currentScopeRef.current ||
				requestVersion !== queueVersionRef.current
			)
				return []
			const remainingClientQueue = persistedClientQueue.filter(
				(item) => !(item.clientSyncId && serverClientSyncIds.has(item.clientSyncId)),
			)
			// 只在最终合并后 setQueue，避免先展示服务端顺序再修正导致用户看到短暂错序。
			const mergedQueueData = mergeQueueItems(activeQueueData, remainingClientQueue)
			if (shouldUpdateState) {
				queueRef.current = mergedQueueData
				setQueue(mergedQueueData)
			}

			return mergedQueueData
		} catch (error) {
			console.error("Failed to fetch queue list:", error)
			// message.error(t("messageQueue.fetchFailed"))
			return []
		} finally {
			if (options?.updateState !== false) setIsLoading(false)
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
					await import("@/services/recordSummary/serviceInstance")

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

	const syncLocalQueueMessageToServer = useMemoizedFn(
		async (
			queueMessage: QueuedMessage,
			options?: { silent?: boolean; refreshAfterSuccess?: boolean },
		) => {
			// Only re-submit offline-generated local queue items; messages already having a server queue_id continue through the original consume flow.
			if (
				!projectId ||
				!topicId ||
				(queueMessage.syncState !== "local" && queueMessage.syncState !== "submitted")
			)
				return false
			const isNetworkOffline = getNetworkMonitor().isNetworkOffline()
			if (isNetworkOffline && !chatWebSocket.isConnected) {
				return false
			}

			if (!acquireLock(queueMessage.id)) return false
			if (
				!getCurrentTopicClientQueue().some(
					(item) => item.id === queueMessage.id && item.syncState !== "detached",
				)
			) {
				releaseLock(queueMessage.id)
				return false
			}
			const operationScope = currentScopeRef.current
			queueVersionRef.current += 1
			setQueue((prevQueue) =>
				prevQueue.map((item) =>
					item.id === queueMessage.id ? { ...item, isSendingLoading: true } : item,
				),
			)

			try {
				let claimed = false
				await updateTopicClientQueue(currentTopicContext, (items) => {
					const current = items.find((item) => item.id === queueMessage.id)
					if (!current || current.syncState === "detached") return items
					queueMessage = current
					claimed = true
					return items.map((item) =>
						item.id === current.id
							? { ...item, syncState: "submitted", isSendingLoading: true }
							: item,
					)
				})
				if (!claimed || operationScope !== currentScopeRef.current) return false
				queueRef.current = queueRef.current.map((item) =>
					item.id === queueMessage.id
						? { ...item, syncState: "submitted", isSendingLoading: true }
						: item,
				)
				setQueue(queueRef.current)
				const nextClientSyncId = queueMessage.clientSyncId || queueMessage.id
				const messageContentData = serializeMessageContent(
					queueMessage.content,
					queueMessage.mentionItems,
					queueMessage.selectedModel,
					queueMessage.selectedImageModel,
					queueMessage.selectedVideoModel,
					queueMessage.topicMode,
					queueMessage.agentCode,
					"plan",
					nextClientSyncId,
					queueMessage.dynamicParams,
				)

				const response = await SuperMagicApi.addMessageToQueue({
					project_id: projectId,
					topic_id: topicId,
					message_type: "rich_text",
					message_content: messageContentData,
				})

				if (!response.queue_id) throw new Error("queue_submission_unconfirmed")
				if (operationScope !== currentScopeRef.current) return true
				// 创建响应已确认受理；队首可能立刻被消费，不能等待列表再次出现才删除本地待办。
				await updateTopicClientQueue(
					queueMessage.topicContext || currentTopicContext,
					(queueItems) => queueItems.filter((item) => item.id !== queueMessage.id),
				)
				queueRef.current = queueRef.current.filter((item) => item.id !== queueMessage.id)
				setQueue(queueRef.current)
				queueVersionRef.current += 1

				if (options?.refreshAfterSuccess !== false) await fetchQueueList()
				if (!options?.silent) magicToast.success(t("messageQueue.addSuccess"))

				return true
			} catch (error) {
				console.error("Failed to sync local queue message:", error)
				if (operationScope !== currentScopeRef.current) return false
				setQueue((prevQueue) =>
					prevQueue.map((item) =>
						item.id === queueMessage.id ? { ...item, isSendingLoading: false } : item,
					),
				)
				await updateTopicClientQueue(
					queueMessage.topicContext || currentTopicContext,
					(queueItems) =>
						queueItems.map((item) =>
							item.id === queueMessage.id
								? { ...item, isSendingLoading: false }
								: item,
						),
				)
				return false
			} finally {
				releaseLock(queueMessage.id)
			}
		},
	)

	// 添加消息到队列
	const addToQueue = useCallback(
		async (params: {
			content: JSONContent
			mentionItems: MentionListItem[]
			selectedModel?: ModelItem | null
			selectedImageModel?: ModelItem | null
			selectedVideoModel?: ModelItem | null
			topicMode?: TopicMode
			agentCode?: string | null
			dynamicParams?: Record<string, unknown>
		}) => {
			if (!projectId || !topicId) {
				magicToast.error(t("messageQueue.missingInfo"))
				return
			}

			const selectedAgentCode =
				params.agentCode === undefined ? agentCode : params.agentCode || undefined

			if (getNetworkMonitor().isNetworkOffline()) {
				// Cannot call server queue API while offline during a running task; append to local queue first, then re-submit in original order after reconnect.
				const localQueueId = buildLocalQueueId()
				const localQueueMessage: QueuedMessage = {
					id: localQueueId,
					content: params.content,
					mentionItems: params.mentionItems,
					selectedModel: params.selectedModel
						? modelCache.snapshotLanguageModel(params.selectedModel)
						: undefined,
					selectedImageModel: params.selectedImageModel ?? undefined,
					selectedVideoModel: params.selectedVideoModel ?? undefined,
					topicMode: params.topicMode,
					agentCode: selectedAgentCode,
					dynamicParams: params.dynamicParams,
					clientSyncId: localQueueId,
					timestamp: getNextLocalQueueTimestamp(currentTopicContext),
					status: "pending",
					isDeletingLoading: false,
					isSendingLoading: false,
					isEditingLoading: false,
					topicContext: currentTopicContext,
					syncState: "local",
				}

				await updateTopicClientQueue(currentTopicContext, (queueItems) =>
					mergeQueueItems(queueItems, [localQueueMessage]),
				)
				setQueue((prevQueue) => mergeQueueItems(prevQueue, [localQueueMessage]))
				return localQueueId
			}

			try {
				// 将完整的消息信息序列化为新的API格式
				const messageContentData = serializeMessageContent(
					params.content,
					params.mentionItems,
					params.selectedModel,
					params.selectedImageModel,
					params.selectedVideoModel,
					params.topicMode,
					selectedAgentCode,
					"plan", // 默认input_mode
					undefined,
					params.dynamicParams,
				)

				// 调用后端API添加到队列
				const response = await SuperMagicApi.addMessageToQueue({
					project_id: projectId,
					topic_id: topicId,
					message_type: "rich_text",
					message_content: messageContentData,
				})

				if (!response?.queue_id) throw new Error("queue_submission_unconfirmed")
				// Invalidate initialization or older polling responses before refreshing the authoritative queue.
				queueVersionRef.current += 1

				// 成功后刷新队列列表
				await fetchQueueList()
				magicToast.success(t("messageQueue.addSuccess"))

				return response?.queue_id
			} catch (error) {
				console.error("Failed to add message to queue:", error)
				// message.error(t("messageQueue.addFailed"))
			}
		},
		[
			agentCode,
			buildLocalQueueId,
			currentTopicContext,
			fetchQueueList,
			getNextLocalQueueTimestamp,
			mergeQueueItems,
			projectId,
			t,
			topicId,
		],
	)

	const removeForDraft = useMemoizedFn(async (item: QueuedMessage): Promise<void> => {
		queueVersionRef.current += 1
		const operationScope = currentScopeRef.current
		if (item.syncState === "local" || item.syncState === "detached") {
			await updateTopicClientQueue(
				currentTopicContext,
				(items) => {
					const current = items.find((message) => message.id === item.id)
					if (
						!current ||
						(current.syncState !== "local" && current.syncState !== "detached")
					)
						throw new Error("queue_source_changed")
					// 先退出待同步集合；草稿确认落盘后再删除这一条短暂的确认记录。
					return items.map((message) =>
						message.id === item.id ? { ...message, syncState: "detached" } : message,
					)
				},
				true,
			)
		} else {
			if (item.syncState === "submitted") throw new Error("queue_source_submitting")
			const result = await SuperMagicApi.deleteQueueMessage({
				messageId: item.id,
				expectedSyncId: item.clientSyncId ?? "",
			})
			if (!result.removed) throw new Error("queue_source_not_removed")
		}
		if (operationScope !== currentScopeRef.current) return
		queueVersionRef.current += 1
		queueRef.current = queueRef.current.filter((message) => message.id !== item.id)
		setQueue(queueRef.current)
	})

	const findLocalQueueItem = useMemoizedFn((id: string) =>
		getTopicClientQueue(currentTopicContext).find((item) => item.id === id),
	)
	const finalizeLocalRemoval = useMemoizedFn(async (id: string) => {
		await updateTopicClientQueue(currentTopicContext, (items) =>
			items.filter((item) => item.id !== id || item.syncState !== "detached"),
		)
	})

	const removeFromQueue = useMemoizedFn(async (messageId: string) => {
		const item = queueRef.current.find((message) => message.id === messageId)
		if (!item || item.status !== "pending" || item.syncState === "submitted") return
		if (deleteConfirmationRef.current) return
		const operationScope = currentScopeRef.current
		let pending = false
		let closed = false
		const close = () => {
			if (closed) return
			closed = true
			modal.destroy()
			if (deleteConfirmationRef.current?.destroy === close)
				deleteConfirmationRef.current = null
		}
		const content = (error?: string) =>
			createElement(
				"div",
				{ className: "space-y-3" },
				createElement(
					"p",
					{
						className:
							"line-clamp-3 break-words rounded-md bg-muted p-2 text-sm text-foreground",
					},
					normalizeQueuePreviewText(item.content) ||
						t("messageQueue.mobile.emptyContent"),
				),
				createElement("p", null, t("messageQueue.deleteDescription")),
				error &&
					createElement("p", { role: "alert", className: "text-destructive" }, error),
			)
		const update = (error?: string) => {
			if (closed) return
			modal.update({
				content: content(error),
				cancelButtonProps: { disabled: pending, onClick: close },
				okButtonProps: { disabled: pending, onClick: () => void confirm() },
			})
		}
		const confirm = async () => {
			if (pending || closed) return
			if (operationScope !== currentScopeRef.current) return close()
			// 确认不暂停队列；弹窗里的旧快照只供阅读，删除前重新检查当前身份与状态。
			const current = queueRef.current.find((message) => message.id === messageId)
			if (
				!current ||
				current.clientSyncId !== item.clientSyncId ||
				current.status !== "pending" ||
				current.syncState === "submitted"
			) {
				close()
				magicToast.warning(t("messageQueue.deleteTargetChanged"))
				void fetchQueueList()
				return
			}
			if (!acquireLock(messageId)) {
				update(t("messageQueue.operationInProgress"))
				return
			}
			pending = true
			update()
			try {
				await removeForDraft(current)
				if (operationScope !== currentScopeRef.current) return
				if (current.syncState) await finalizeLocalRemoval(current.id)
				if (operationScope !== currentScopeRef.current) return
				close()
				magicToast.success(t("messageQueue.deleteSuccess"))
			} catch {
				pending = false
				if (operationScope === currentScopeRef.current)
					update(t("messageQueue.deleteFailed"))
			} finally {
				releaseLock(messageId)
				if (operationScope === currentScopeRef.current) await fetchQueueList()
			}
		}
		// 复用完整按钮区的间距与圆角；确认点击由业务控制，删除失败时保留弹窗供重试。
		const modal = MagicModal.confirm({
			title: t("messageQueue.deleteTitle"),
			content: content(),
			variant: "destructive",
			closable: false,
			maskClosable: false,
			onCancel: () => {
				closed = true
				deleteConfirmationRef.current = null
			},
			okText: t("messageQueue.deleteConfirm"),
			cancelText: t("messageQueue.switchDraftCancel"),
		})
		deleteConfirmationRef.current = { destroy: close }
		update()
	})

	const queueDraftState = useQueueDraft({
		projectId,
		topicId,
		editorRef,
		queueRef,
		acquireLock,
		releaseLock,
		removeForDraft,
		findLocalQueueItem,
		finalizeLocalRemoval,
		resumeLocalQueue: () => {
			void flushLocalQueueToServer()
		},
		fetchQueueList,
		serialize: (input: QueueMessageInput, syncId: string) =>
			serializeMessageContent(
				input.content,
				input.mentionItems,
				input.selectedModel,
				input.selectedImageModel,
				input.selectedVideoModel,
				input.topicMode,
				input.agentCode ?? undefined,
				"plan",
				syncId,
				input.dynamicParams,
			),
	})

	const moveQueueItem = useMemoizedFn(
		async (messageId: string, beforeId: string | null, afterId: string | null) => {
			if (
				operationLocksRef.current.size > 0 ||
				queueDraftState.isQueueOperationPending ||
				!acquireLock(messageId)
			)
				return
			queueVersionRef.current += 1
			try {
				await SuperMagicApi.moveQueueMessage({
					messageId,
					before_id: beforeId,
					after_id: afterId,
				})
			} catch {
				magicToast.error(t("messageQueue.moveFailed"))
			} finally {
				queueVersionRef.current += 1
				releaseLock(messageId)
				await fetchQueueList()
			}
		},
	)

	// 直接发送队列中的消息
	const sendQueuedMessage = useCallback(
		async (messageId: string, isUserInitiated = false, queueData?: QueuedMessage[]) => {
			// 使用传入的队列数据或当前状态中的队列数据
			const currentQueue = queueData || queue
			const queueMessage = currentQueue.find((msg) => msg.id === messageId)
			if (!queueMessage) return

			if (queueMessage.syncState === "local") {
				await syncLocalQueueMessageToServer(queueMessage, {
					silent: !isUserInitiated,
				})
				return
			}
			if (queueMessage.syncState === "submitted") {
				// "submitted" is still a local re-submission transitional state; must wait for server to return the real queue_id before participating in consumption.
				return
			}

			// 新增：验证消息是否属于当前话题
			const currentTopicContext = `${projectId}-${topicId}`
			if (queueMessage.topicContext !== currentTopicContext) {
				console.warn(`消息 ${messageId} 不属于当前话题 (${currentTopicContext})，取消发送`)
				return
			}

			// 尝试获取操作锁
			if (!acquireLock(messageId)) {
				if (isUserInitiated) {
					magicToast.warning(t("messageQueue.operationInProgress"))
				}
				return
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
				const result = await SuperMagicApi.consumeQueueMessage({
					messageId,
					force: isUserInitiated,
				})
				if (isUserInitiated && !result.success)
					throw new Error(result.error_message ?? "queue_send_failed")

				// 发送成功后刷新队列列表
				await fetchQueueList()
				if (isUserInitiated) magicToast.success(t("messageQueue.sendSuccess"))
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
		[
			queue,
			fetchQueueList,
			t,
			acquireLock,
			releaseLock,
			projectId,
			topicId,
			syncLocalQueueMessageToServer,
		],
	)

	const consumeNextPendingQueueMessage = useMemoizedFn(
		async (
			queueData: QueuedMessage[],
			options?: {
				ignoreSyncLock?: boolean
			},
		) => {
			// Scenario: while consuming task 1, user sends 2/3/4 offline; server completes task 1 during disconnect;
			// after reconnect, 2/3/4 are re-submitted to server queue, but frontend missed the task-end event — need to proactively consume the first pending item.
			if (!projectId || !topicId || !currentTopicContext) return
			if (isWaitingForUser) return
			if (syncLocalQueueLockRef.current && !options?.ignoreSyncLock) return
			if (getNetworkMonitor().isNetworkOffline()) return
			if (isTaskRunningRef.current) return
			if (
				queueData.some(
					(item) =>
						item.topicContext === currentTopicContext && item.status === "processing",
				)
			) {
				return
			}

			const nextPendingMessage = queueData.find(
				(item) =>
					item.topicContext === currentTopicContext &&
					item.status === "pending" &&
					!item.syncState,
			)
			if (!nextPendingMessage) return

			await sendQueuedMessage(nextPendingMessage.id, false, queueData)
		},
	)

	const flushLocalQueueToServer = useMemoizedFn(async () => {
		// 串行确认离线提交：上一项受理后才提交下一项，包含请求超时后需要确认的 submitted 项。
		if (!currentTopicContext) return
		if (syncLocalQueueLockRef.current) return
		const isNetworkOffline = getNetworkMonitor().isNetworkOffline()
		if (isNetworkOffline && !chatWebSocket.isConnected) return

		const initialServerPendingHeadId = queueRef.current.find(
			(item) =>
				item.topicContext === currentTopicContext &&
				item.status === "pending" &&
				!item.syncState,
		)?.id
		const localQueueItems = [...getCurrentTopicClientQueue(currentTopicContext)]
			.filter((item) => item.syncState === "local" || item.syncState === "submitted")
			.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
		if (localQueueItems.length === 0) {
			const latestQueue = await fetchQueueList({ updateState: false })
			const hasInitialServerPendingHead =
				!initialServerPendingHeadId ||
				latestQueue.some((item) => item.id === initialServerPendingHeadId)
			if (!hasInitialServerPendingHead) return
			await consumeNextPendingQueueMessage(latestQueue)
			return
		}

		syncLocalQueueLockRef.current = true
		let hasSubmittedQueueMessage = false
		try {
			for (const localQueueItem of localQueueItems) {
				const syncResult = await syncLocalQueueMessageToServer(localQueueItem, {
					silent: true,
					refreshAfterSuccess: false,
				})
				if (!syncResult) break

				await fetchQueueList({ updateState: false })

				hasSubmittedQueueMessage = true
			}
			if (hasSubmittedQueueMessage) {
				await fetchQueueList()
			}
		} finally {
			syncLocalQueueLockRef.current = false
		}
	})

	useEffect(() => {
		const flushLocalQueue = () => {
			void flushLocalQueueToServer()
		}

		window.addEventListener("online", flushLocalQueue)
		chatWebSocket.on("open", flushLocalQueue)
		if (getCurrentTopicClientQueue(currentTopicContext).length) flushLocalQueue()

		return () => {
			window.removeEventListener("online", flushLocalQueue)
			chatWebSocket.off("open", flushLocalQueue)
		}
	}, [currentTopicContext, flushLocalQueueToServer, getCurrentTopicClientQueue])

	// 清空队列
	const clearQueue = useCallback(() => {
		setQueue([])
	}, [])

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

		// 1. 清除当前话题的操作锁；队列外草稿由编辑器按话题恢复。
		operationLocksRef.current.clear()
		setIsMutating(false)
		// userOperationIntentRef.current.clear() // 清除所有用户操作意图

		// 2. 队列与消息历史独立，话题有效时立即从服务端恢复队列。
		// 不等待消息历史初始化，避免已有队列在刷新后因 loading 状态已结束而不再加载。
		if (projectId && topicId) {
			// Restore local offline queue first, then fetch server queue, to prevent offline-appended messages from briefly disappearing after refresh.
			setQueue(getCurrentTopicClientQueue(currentTopicContext))
			fetchQueueList().then(() => {
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
	}, [topicId, projectId, currentTopicContext, getCurrentTopicClientQueue, fetchQueueList])

	useEffect(() => {
		const handler = (message?: SuperMagicMessageQueueMessage) => {
			if (!message || message.project_id !== projectId || message.topic_id !== topicId) return
			// External enqueue/consume updates supersede any list request already in flight.
			queueVersionRef.current += 1
			void fetchQueueList()
		}
		pubsub.subscribe(PubSubEvents.SuperMagicMessageQueueConsumed, handler)
		return () => pubsub.unsubscribe(PubSubEvents.SuperMagicMessageQueueConsumed, handler)
	}, [projectId, topicId, fetchQueueList])

	// 任务完成时（isTaskRunning 从 true → false），检查队列并兜底消费。
	useUpdateEffect(() => {
		if (!isWaitingForUser && !isTaskRunning && projectId && topicId) {
			const timer = setTimeout(async () => {
				const latestQueue = await fetchQueueList()
				if (Array.isArray(latestQueue) && latestQueue.length > 0) {
					await consumeNextPendingQueueMessage(latestQueue, { ignoreSyncLock: true })
				}
			}, 500)
			return () => clearTimeout(timer)
		}
	}, [isTaskRunning, isWaitingForUser])

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
		...queueDraftState,
		isQueueOperationPending: isMutating || queueDraftState.isQueueOperationPending,
		editorRef,
		moveQueueItem,
		isLoading,
		addToQueue,
		removeFromQueue,
		sendQueuedMessage: sendQueuedMessageByUser, // 返回的是用户主动发送版本
		clearQueue,
		// processNextMessage,
		fetchQueueList,
	}
}

export default useMessageQueue
