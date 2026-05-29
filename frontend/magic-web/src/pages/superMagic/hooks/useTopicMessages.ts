import { useMemoizedFn } from "ahooks"
import { isEmpty } from "lodash-es"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { SuperMagicApi } from "@/apis"
import { superMagicStore } from "@/pages/superMagic/stores"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { TaskStatus, Topic } from "../pages/Workspace/types"

// 完全同步时单次拉取的消息数量
const FULL_TOPIC_SYNC_MESSAGE_COUNT = 100

// 实时增量同步时每次拉取的消息数量
const LIVE_INCREMENTAL_SYNC_MESSAGE_COUNT = 10

// 轮询同步时每次拉取的消息数量
const POLLING_SYNC_MESSAGE_COUNT = 30

// 前台恢复时第一段回拉窗口：先用中等窗口补最近消息，尽量一次命中大多数休眠场景。
const FOREGROUND_RECOVERY_FIRST_PAGE_MESSAGE_COUNT = 200

// 前台恢复时第二段回拉窗口：若第一段仍未追平到休眠前锚点，再放大一次窗口兜底。
const FOREGROUND_RECOVERY_SECOND_PAGE_MESSAGE_COUNT = 400

// 前台恢复防抖时间（毫秒），避免重复触发同步
const FOREGROUND_SYNC_DEDUPE_MS = 1000

interface UseTopicMessagesParams {
	selectedTopic: Topic | null
	checkNowDebounced?: () => void
}

interface PullMessageParams {
	conversation_id: string
	chat_topic_id: string
	page_token: string
	order: "asc" | "desc"
	limit?: number
	updatePageToken?: boolean
	refreshMessages?: boolean
	callback?: () => void
}

interface PullMessageResult {
	didPullSucceed: boolean
	pulledItems: any[]
	response?: any
}

interface ForegroundRecoveryAnchorState {
	baseAnchor?: string
	latestCommittedAnchor?: string
}

/**
 * 过滤前台恢复场景下的消息项，避免彻底无效的空节点进入恢复聚合结果。
 * 该过滤只用于恢复补拉，不影响 WS、轮询、切话题和加载更多的原始写入链路。
 */
function shouldIncludeFetchedMessage(item: any) {
	const message = item?.seq?.message
	if (!message?.app_message_id) return false
	// 休眠恢复时服务端常会先返回“半成品”节点，这里只过滤彻底无效的数据，
	// 同时保留 v1 / v2 历史消息格式的兼容判断。
	const hasRenderablePayload =
		message?.type ||
		message?.general_agent_card ||
		message?.text?.content ||
		message?.rich_text?.content
	return Boolean(hasRenderablePayload)
}

/**
 * 对分页回拉结果按 app_message_id 去重，避免两段恢复窗口存在重叠时重复写入同一条消息。
 */
function dedupePulledItemsByAppMessageId(items: any[]) {
	const seenAppMessageIds = new Set<string>()
	return items.filter((item) => {
		const appMessageId = item?.seq?.message?.app_message_id
		if (!appMessageId || seenAppMessageIds.has(appMessageId)) return false
		seenAppMessageIds.add(appMessageId)
		return true
	})
}

/**
 * 判断前台恢复是否还需要继续向更早的分页扩展。
 * 只要当前聚合结果还没覆盖到恢复锚点，就继续拉第二段窗口。
 */
function shouldContinueForegroundRecovery(pulledItems: any[], recoveryAnchorAppMessageId?: string) {
	// 恢复补拉只关心“是否已经追平到离开前最后一条本地可见消息”：
	// 只要新回拉结果已经包含这个锚点，就说明锚点之后的缺口已被补齐，无需继续向更老分页扩散。
	if (!recoveryAnchorAppMessageId) return false
	return !pulledItems.some(
		(item) => item?.seq?.message?.app_message_id === recoveryAnchorAppMessageId,
	)
}

/**
 * 管理当前话题的消息拉取、增量同步、前台恢复和分页加载。
 */
export function useTopicMessages({ selectedTopic, checkNowDebounced }: UseTopicMessagesParams) {
	// topic_id和page_token的映射
	const topicPageTokenMap = useRef<Record<string, string>>({})
	const topicNotHaveMoreMessageMap = useRef<Record<string, boolean>>({})
	// Track which topics have completed their initial load
	const initialLoadedTopicsRef = useRef<Set<string>>(new Set())
	const selectedTopicRef = useRef(selectedTopic)
	const lastForegroundSyncAtRef = useRef(0)
	const foregroundRecoveryAnchorRef = useRef<Record<string, ForegroundRecoveryAnchorState>>({})
	selectedTopicRef.current = selectedTopic

	const [isMessagesInitialLoading, setIsMessagesInitialLoading] = useState(() =>
		Boolean(selectedTopic?.chat_topic_id),
	)
	/** 当前选中话题本轮拉取已结束（写入 store 或请求结束），用于避免切换话题时读到空消息列表 */
	const [isSelectedTopicMessagesReady, setIsSelectedTopicMessagesReady] = useState(
		() => !selectedTopic?.id,
	)

	/**
	 * 读取当前 topic 在 messages 列表中最靠前的一条消息 id。
	 * 该值代表当前已经真正落地到 UI 主列表中的最新消息边界。
	 */
	const getTopicLatestMessageAnchor = useMemoizedFn((topicId?: string) => {
		if (!topicId) return ""
		const currentMessages = superMagicStore.messages.get(topicId) || []
		// store 内消息按 desc 排序，数组首项就是当前已落地列表中的最新消息。
		return currentMessages[0]?.app_message_id || ""
	})

	/**
	 * 在页面进入 hidden 时记录一个“离开瞬间”的基准锚点。
	 * 它代表用户明确看到过的最后一条消息，是恢复补拉的正确性下界。
	 */
	const setForegroundRecoveryBaseAnchor = useMemoizedFn((topicId?: string) => {
		if (!topicId) return
		const baseAnchor = getTopicLatestMessageAnchor(topicId)
		if (!baseAnchor) return
		foregroundRecoveryAnchorRef.current[topicId] = {
			baseAnchor,
			// 初始时最新已落地锚点与基准锚点一致；后续若 hidden 期间继续落地新消息，再推进它。
			latestCommittedAnchor: baseAnchor,
		}
	})

	/**
	 * 当页面已经 hidden，但轮询/WS 仍成功把消息落到了 messages 时，推进隐藏期最新锚点。
	 * 这样既保留 hidden 瞬间的正确性边界，又避免长时间 hidden 后锚点过旧。
	 */
	const updateForegroundRecoveryCommittedAnchor = useMemoizedFn((topicId?: string) => {
		if (!topicId || document.visibilityState !== "hidden") return
		const latestCommittedAnchor = getTopicLatestMessageAnchor(topicId)
		if (!latestCommittedAnchor) return
		const previousAnchorState = foregroundRecoveryAnchorRef.current[topicId]
		foregroundRecoveryAnchorRef.current[topicId] = {
			baseAnchor: previousAnchorState?.baseAnchor || latestCommittedAnchor,
			latestCommittedAnchor,
		}
	})

	/**
	 * 只请求一页消息，不直接写入 store。
	 * 前台恢复会复用这层能力，先聚合两段分页结果，再一次性重建列表。
	 */
	const fetchMessagesPage = useMemoizedFn(
		async ({
			conversation_id,
			chat_topic_id,
			page_token,
			order,
			limit = 20,
			updatePageToken = true,
			callback,
		}: Omit<PullMessageParams, "refreshMessages">): Promise<PullMessageResult> => {
			try {
				const response = await SuperMagicApi.getMessagesByConversationId({
					conversation_id,
					chat_topic_id,
					page_token,
					limit,
					order,
				})
				const pulledItems = response?.items || []
				const renderableMessages = pulledItems
					.filter(shouldIncludeFetchedMessage)
					?.map((item: any) => {
						const data = item?.seq?.message?.general_agent_card
							? item?.seq?.message?.general_agent_card
							: item?.seq?.message
						return {
							...data,
							seq_id: item?.seq?.seq_id,
							messageStatus: item?.seq?.message?.status,
						}
					})
					.filter((item: any) => !isEmpty(item))
				const hasAttachments = renderableMessages.some(
					(item: any) =>
						item?.attachments?.length > 0 || item?.tool?.attachments?.length > 0,
				)
				if (hasAttachments) {
					checkNowDebounced?.()
				}
				if (updatePageToken && response?.page_token) {
					// 服务端返回的 page_token 既供“手动加载更多”继续向旧消息翻页，
					// 也供前台恢复场景继续拼接第二段补拉窗口。
					topicPageTokenMap.current[chat_topic_id] = response.page_token
				}

				callback?.()
				return {
					didPullSucceed: true,
					pulledItems,
					response,
				}
			} catch (error) {
				console.error("[useTopicMessages] pullMessage failed", {
					error,
					chat_topic_id,
					conversation_id,
					page_token,
					order,
					limit,
				})
				return {
					didPullSucceed: false,
					pulledItems: [],
				}
			}
		},
	)

	/**
	 * 发起一次消息拉取，并按原有语义把结果写回 store。
	 * 非恢复场景仍复用这条主路径，避免改动 WS、轮询、切话题等既有行为。
	 */
	const pullMessage = useMemoizedFn(
		async ({
			conversation_id,
			chat_topic_id,
			page_token,
			order,
			limit = 20,
			updatePageToken = true,
			refreshMessages = false,
			callback,
		}: PullMessageParams) => {
			if (
				topicNotHaveMoreMessageMap.current[chat_topic_id] &&
				page_token &&
				updatePageToken
			) {
				console.log("没有更多消息")
				if (selectedTopicRef.current?.chat_topic_id === chat_topic_id)
					setIsSelectedTopicMessagesReady(true)
				return
			}
			const { didPullSucceed, pulledItems } = await fetchMessagesPage({
				conversation_id,
				chat_topic_id,
				page_token,
				order,
				limit,
				updatePageToken,
				callback,
			})
			if (!didPullSucceed) return
			if (refreshMessages) {
				// 增量模式保留现有 messages/buffer 状态，只把最新节点逐条灌进 store，
				// 让现有的去重、流式和 buffer 逻辑继续生效。
				pulledItems.reverse().forEach((item: any) => {
					superMagicStore.enqueueMessage(chat_topic_id, item)
				})
			} else {
				// 全量模式用于切话题或前台恢复，直接用服务端权威结果重建当前 topic 的消息视图。
				superMagicStore.initializeMessages(chat_topic_id, pulledItems)
			}
			updateForegroundRecoveryCommittedAnchor(chat_topic_id)
			if (!initialLoadedTopicsRef.current.has(chat_topic_id)) {
				initialLoadedTopicsRef.current.add(chat_topic_id)
				setIsMessagesInitialLoading(false)
			}
			if (selectedTopicRef.current?.chat_topic_id === chat_topic_id) {
				setIsSelectedTopicMessagesReady(true)
			}
		},
	)

	/**
	 * 获取前台恢复的目标锚点。
	 * 若 hidden 后页面还持续渲染过新内容，则优先对齐“隐藏期最新已落地锚点”；
	 * 否则退回 hidden 瞬间的基准锚点，最后再兜底使用当前列表顶部消息。
	 */
	const getCurrentTopicRecoveryAnchor = useMemoizedFn((topicId?: string) => {
		if (!topicId) return ""
		const cachedAnchorState = foregroundRecoveryAnchorRef.current[topicId]
		if (cachedAnchorState?.latestCommittedAnchor) return cachedAnchorState.latestCommittedAnchor
		if (cachedAnchorState?.baseAnchor) return cachedAnchorState.baseAnchor
		return getTopicLatestMessageAnchor(topicId)
	})

	/**
	 * 只有当前话题仍处于“可能存在未追平增量”的状态时，才允许执行前台恢复。
	 * 对已经完成且 store 内无 buffer / 流式残留的会话，切回页面无需再额外打一轮恢复请求。
	 */
	const shouldRunForegroundRecovery = useMemoizedFn((topic?: Topic | null) => {
		if (!topic?.chat_topic_id) return false
		const topicId = topic.chat_topic_id
		const topicMeta = superMagicStore.topicMeta.get(topicId)
		// buffer 存的是队列对象，不是数组；恢复判断只需要知道是否还有未消费消息。
		const hasBufferedMessages = (superMagicStore.buffer.get(topicId)?.messages?.length ?? 0) > 0
		const legacyTopicStatus = (topic as Topic & { status?: TaskStatus }).status
		const topicTaskStatus = topic.task_status || legacyTopicStatus
		return (
			topicTaskStatus === TaskStatus.RUNNING ||
			hasBufferedMessages ||
			Boolean(topicMeta?.isStream) ||
			Boolean(topicMeta?.isStreamLoading)
		)
	})

	/**
	 * 拉取当前选中话题的消息。
	 * 除前台恢复外，其余场景继续使用既有的一次请求模型。
	 */
	const updateTopicMessages = useMemoizedFn(
		({
			refreshMessages = false,
			messageCount = FULL_TOPIC_SYNC_MESSAGE_COUNT,
		}: { refreshMessages?: boolean; messageCount?: number } = {}) => {
			// if (selectedTopic?.id && selectedWorkspace) {
			if (selectedTopic?.id) {
				pullMessage({
					conversation_id: selectedTopic.chat_conversation_id,
					chat_topic_id: selectedTopic.chat_topic_id,
					page_token: "",
					order: "desc",
					limit: messageCount,
					updatePageToken: true,
					refreshMessages,
				})
			}
		},
	)

	/**
	 * 当前处于前台时同步当前选中话题的消息列表。
	 *
	 * 这里不再按“离开时长”估算窗口，而是按固定两段回拉：
	 * 1. 先拉最近 200 条，覆盖绝大多数短时休眠/切页场景；
	 * 2. 若仍未追平隐藏期最新已落地锚点（没有则退回 hidden 基准锚点），
	 *    再用服务端返回的 page_token 补一段 400 条。
	 *
	 * 两段之后仍未追平时，保留已补回的最近消息；极端缺口可接受，避免刚进入页面时误提示用户。
	 */
	const syncSelectedTopicOnForeground = useMemoizedFn(async () => {
		const currentSelectedTopic = selectedTopicRef.current
		if (!currentSelectedTopic?.id || document.visibilityState !== "visible") return
		if (!shouldRunForegroundRecovery(currentSelectedTopic)) {
			// 当前会话已经稳定收尾时，hidden -> visible 不需要再触发恢复补拉；
			// 同时清理掉这次 hidden 周期留下的锚点，避免后续切页继续误判为待恢复。
			delete foregroundRecoveryAnchorRef.current[currentSelectedTopic.chat_topic_id]
			return
		}
		const now = Date.now()
		// 某些浏览器在切回前台时会连续触发 visibilitychange，
		// 这里做一个很轻的去重，避免同一轮恢复打出多次全量回拉。
		if (now - lastForegroundSyncAtRef.current < FOREGROUND_SYNC_DEDUPE_MS) return
		lastForegroundSyncAtRef.current = now
		const recoveryAnchorAppMessageId = getCurrentTopicRecoveryAnchor(
			currentSelectedTopic.chat_topic_id,
		)
		let aggregatedPulledItems: any[] = []
		const firstPageResult = await fetchMessagesPage({
			conversation_id: currentSelectedTopic.chat_conversation_id,
			chat_topic_id: currentSelectedTopic.chat_topic_id,
			page_token: "",
			order: "desc",
			limit: FOREGROUND_RECOVERY_FIRST_PAGE_MESSAGE_COUNT,
			updatePageToken: true,
		})
		if (!firstPageResult.didPullSucceed) return
		aggregatedPulledItems = dedupePulledItemsByAppMessageId(
			firstPageResult.pulledItems.filter(shouldIncludeFetchedMessage),
		)

		const shouldFetchSecondPage =
			shouldContinueForegroundRecovery(
				firstPageResult.pulledItems,
				recoveryAnchorAppMessageId,
			) && Boolean(firstPageResult.response?.page_token)
		if (shouldFetchSecondPage) {
			const secondPageResult = await fetchMessagesPage({
				conversation_id: currentSelectedTopic.chat_conversation_id,
				chat_topic_id: currentSelectedTopic.chat_topic_id,
				page_token: firstPageResult.response?.page_token || "",
				order: "desc",
				limit: FOREGROUND_RECOVERY_SECOND_PAGE_MESSAGE_COUNT,
				updatePageToken: true,
			})
			if (secondPageResult.didPullSucceed) {
				aggregatedPulledItems = dedupePulledItemsByAppMessageId([
					...aggregatedPulledItems,
					...secondPageResult.pulledItems.filter(shouldIncludeFetchedMessage),
				])
			}
		}

		// 前台恢复是“权威快照重建”场景，因此把两段分页结果先聚合后一次性写回，
		// 避免中间态列表先显示一半，再被第二次分页重排。
		superMagicStore.initializeMessages(
			currentSelectedTopic.chat_topic_id,
			aggregatedPulledItems,
		)
		if (!initialLoadedTopicsRef.current.has(currentSelectedTopic.chat_topic_id)) {
			initialLoadedTopicsRef.current.add(currentSelectedTopic.chat_topic_id)
			// 恢复请求是异步的，避免旧话题回包提前关闭新话题的初始 loading。
			if (selectedTopicRef.current?.chat_topic_id === currentSelectedTopic.chat_topic_id)
				setIsMessagesInitialLoading(false)
		}
		if (selectedTopicRef.current?.chat_topic_id === currentSelectedTopic.chat_topic_id) {
			setIsSelectedTopicMessagesReady(true)
		}
		delete foregroundRecoveryAnchorRef.current[currentSelectedTopic.chat_topic_id]
	})

	/**
	 * 手动加载更早的历史消息，继续复用服务端返回的 page_token。
	 */
	const handlePullMoreMessage = useMemoizedFn(
		(topicInfo: Topic | null, callback?: () => void) => {
			// if (selectedWorkspace && topicInfo) {
			if (topicInfo) {
				pullMessage({
					conversation_id: topicInfo.chat_conversation_id,
					chat_topic_id: topicInfo.chat_topic_id,
					page_token: topicPageTokenMap.current[topicInfo?.chat_topic_id] || "",
					order: "desc",
					limit: 100,
					updatePageToken: true,
					callback,
				})
			}
		},
	)

	// topic 恢复是 refreshState 分阶段推进的：如果继续用普通 effect，
	// "null -> topic" 这一帧会先泄露上一轮的 ready/loading，导致外层误判为空会话。
	// 这里在 layout effect 里同步重置，确保首屏拿到的是当前 topic 的真实初始化状态。
	useLayoutEffect(() => {
		superMagicStore.setActiveTopicId(selectedTopic?.chat_topic_id || null)
		setIsSelectedTopicMessagesReady(false)
		const topicId = selectedTopic?.chat_topic_id
		if (topicId && !initialLoadedTopicsRef.current.has(topicId)) {
			setIsMessagesInitialLoading(true)
		} else {
			setIsMessagesInitialLoading(false)
		}
		updateTopicMessages()
	}, [
		selectedTopic?.id,
		selectedTopic?.chat_topic_id,
		selectedTopic?.chat_conversation_id,
		updateTopicMessages,
	])

	// Subscribe to WebSocket new message events
	useEffect(() => {
		/**
		 * 处理 WS 新消息事件。
		 * 在线场景保持小窗口增量回拉，避免每次推送都触发大范围重建。
		 */
		const handleNewMessage = (data: any) => {
			console.log("我接受到的 ws 消息", data)
			const { topic_id: chat_topic_id = "" } = data.message || {}

			if (
				selectedTopic?.chat_conversation_id &&
				chat_topic_id /** selectedTopic?.chat_topic_id */
			) {
				pullMessage({
					conversation_id: selectedTopic?.chat_conversation_id,
					chat_topic_id: chat_topic_id,
					page_token: "",
					order: "desc",
					// 正常在线增量同步优先追求轻量，避免每个 WS 事件都触发大窗口回拉。
					limit: LIVE_INCREMENTAL_SYNC_MESSAGE_COUNT,
					updatePageToken: false,
					refreshMessages: true,
				})
			}
		}
		pubsub.subscribe(PubSubEvents.Super_Magic_New_Message_V2, handleNewMessage)
		return () => {
			pubsub?.unsubscribe(PubSubEvents.Super_Magic_New_Message_V2, handleNewMessage)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedTopic])

	useEffect(() => {
		/**
		 * 处理页面前后台切换。
		 * hidden 时记录恢复锚点，visible 时触发前台补拉。
		 */
		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				if (selectedTopicRef.current?.chat_topic_id) {
					// hidden 时先记录一个“离开瞬间”的基准锚点；
					// 若 hidden 期间轮询/WS 继续把新消息落到了主列表，再由 pullMessage 推进最新已落地锚点。
					setForegroundRecoveryBaseAnchor(selectedTopicRef.current.chat_topic_id)
				}
				return
			}
			if (document.visibilityState !== "visible") return
			syncSelectedTopicOnForeground()
		}

		document.addEventListener("visibilitychange", handleVisibilityChange)
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange)
		}
	}, [setForegroundRecoveryBaseAnchor, syncSelectedTopicOnForeground])

	// Timer: poll messages every 30 seconds
	useEffect(() => {
		const timer = setInterval(() => {
			if (
				selectedTopic?.id &&
				selectedTopic.chat_conversation_id &&
				selectedTopic.chat_topic_id
			) {
				pullMessage({
					conversation_id: selectedTopic?.chat_conversation_id,
					chat_topic_id: selectedTopic?.chat_topic_id,
					page_token: "",
					order: "desc",
					// 轮询兜底保持中等窗口，兼顾稳定性和请求成本。
					limit: POLLING_SYNC_MESSAGE_COUNT,
					updatePageToken: false,
					refreshMessages: true,
				})
			}
		}, 20 * 1000)

		// Cleanup timer
		return () => {
			clearInterval(timer)
		}
	}, [selectedTopic, pullMessage])

	// Handle refresh topic messages after revoke
	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Refresh_Topic_Messages, () =>
			updateTopicMessages({
				// Must use initializeMessages (refreshMessages: false) here.
				// Using enqueueMessage (refreshMessages: true) calls sortMessages after each
				// individual status update, which permanently filters out revoked messages that
				// appear before the last non-revoked message at the time of processing.
				// When multiple messages are revoked at once (e.g. undoMessage), only the
				// last revoked message survives in the revoked section — earlier ones are lost.
				// initializeMessages applies all status updates in one batch and calls
				// sortMessages only once at the end, preserving all revoked messages correctly.
				refreshMessages: false,
				messageCount: 500,
			}),
		)

		return () => {
			pubsub?.unsubscribe(PubSubEvents.Refresh_Topic_Messages)
		}
	}, [updateTopicMessages])

	// Cleanup on component unmount
	useEffect(() => {
		return () => {
			// Cleanup topic_id and page_token mapping
			topicPageTokenMap.current = {}
		}
	}, [])

	return {
		pullMessage,
		updateTopicMessages,
		handlePullMoreMessage,
		topicPageTokenMap,
		isMessagesInitialLoading,
		isSelectedTopicMessagesReady,
	}
}
