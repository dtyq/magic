import { useMemoizedFn } from "ahooks"
import { isEmpty } from "lodash-es"
import { useEffect, useRef, useState } from "react"
import { SuperMagicApi } from "@/apis"
import {
	acknowledgeTopicSync,
	getTopicRecoveryStatus,
	registerStreamRecoveryOwner,
	requestTopicRecovery,
	resumeTopicRecovery,
} from "@/pages/superMagic/services/streamRecoveryCoordinator"
import { syncTopicStatusAfterForegroundMessageReconciliation } from "@/pages/superMagic/services/topicStatusSyncService"
import { superMagicStore, type CanonicalCommitTrigger } from "@/pages/superMagic/stores"
import type { TopicStore } from "@/pages/superMagic/stores/core/topic"
import defaultTopicStore from "@/pages/superMagic/stores/core/topic"
import { getRawMessageNode } from "@/pages/superMagic/stores/message-transforms"
import { optimisticMessageStore } from "@/pages/superMagic/stores/optimisticMessageStore"
import {
	IntermediateMessageType,
	type SuperMagicCheckpointRollbackMessage,
} from "@/types/chat/intermediate_message"
import type { SeqResponse } from "@/types/request"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { MessageStatus, TaskStatus, Topic } from "../pages/Workspace/types"
import { topicHistoryPageCache } from "./topic-history-page-cache"

// 完全同步时单次拉取的消息数量
const FULL_TOPIC_SYNC_MESSAGE_COUNT = 100

// 实时增量同步时每次拉取的消息数量
const LIVE_INCREMENTAL_SYNC_MESSAGE_COUNT = 10

// 常驻轮询只补最近增量；完整分页仅保留给显式 recovery。
const POLLING_SYNC_MESSAGE_COUNT = 20

// 实时/轮询权威尾部同步最多向前寻找三页公共锚点；超过预算交给后续轮询或完整 recovery。
const AUTHORITATIVE_TAIL_MAX_PAGE_COUNT = 3

// 带 durable anchor 的前台恢复只保留原先的两段有限窗口，避免切回前台扫描整段历史。
const FOREGROUND_RECOVERY_PAGE_LIMITS = [200, 400] as const

// 无 durable anchor 时只补最近有限窗口；此分支不能把一次前台恢复升级为全历史扫描。
const FOREGROUND_RECOVERY_PAGE_SIZE = 100

// 没有 durable anchor 时只补最近有限窗口；此分支不能把一次前台恢复升级为全历史扫描。
const FOREGROUND_RECOVERY_ANCHORLESS_PAGE_COUNT = 3

// 前台恢复必须有硬预算，防止服务端持续返回新 token 时无限请求和聚合。
const FOREGROUND_RECOVERY_MAX_MESSAGE_COUNT = 600

// 完整 recovery 同样需要预算；正常历史可以远大于前台恢复，但不能无限等待服务端。
const FULL_RECOVERY_MAX_PAGE_COUNT = 500
const FULL_RECOVERY_MAX_MESSAGE_COUNT = 50_000

// 前台恢复防抖时间（毫秒），避免重复触发同步
const FOREGROUND_SYNC_DEDUPE_MS = 1000

type MessagePageRequestParams = {
	conversation_id: string
	chat_topic_id: string
	page_token: string
	order: "asc" | "desc"
	limit: number
}

interface InFlightMessagePageRequest {
	promise: Promise<any>
	owners: Set<symbol>
}

/**
 * API 层的精确请求 single-flight。
 *
 * 前台恢复、初始加载和 watchdog 可能在同一个 Topic 同时请求同一页；只共享
 * HTTP 响应 Promise，调用方各自继续执行状态过滤和 Store 对账，避免改变 Final
 * / progress_snapshot 的业务语义。
 */
const inFlightMessagePageRequests = new Map<string, InFlightMessagePageRequest>()

function getMessagePageRequestKey(params: MessagePageRequestParams) {
	return [
		params.conversation_id,
		params.chat_topic_id,
		params.order,
		params.limit,
		params.page_token,
	].join("\u0000")
}

function requestMessagePage(params: MessagePageRequestParams, ownerToken: symbol): Promise<any> {
	const key = getMessagePageRequestKey(params)
	const existing = inFlightMessagePageRequests.get(key)
	if (existing) {
		existing.owners.add(ownerToken)
		return existing.promise
	}

	const entry = {} as InFlightMessagePageRequest
	entry.owners = new Set([ownerToken])
	entry.promise = Promise.resolve(SuperMagicApi.getMessagesByConversationId(params)).finally(
		() => {
			if (inFlightMessagePageRequests.get(key) === entry) {
				inFlightMessagePageRequests.delete(key)
			}
		},
	)
	inFlightMessagePageRequests.set(key, entry)
	return entry.promise
}

function releaseMessagePageRequests(ownerToken: symbol) {
	inFlightMessagePageRequests.forEach((entry, key) => {
		entry.owners.delete(ownerToken)
		if (entry.owners.size === 0) inFlightMessagePageRequests.delete(key)
	})
}

interface UseTopicMessagesParams {
	selectedTopic: Topic | null
	checkNowDebounced?: () => void
	topicStore?: TopicStore
}

interface PullMessageParams {
	conversation_id: string
	chat_topic_id: string
	page_token: string
	order: "asc" | "desc"
	limit?: number
	updatePageToken?: boolean
	writeIntent: "replace" | "merge" | "incremental" | "authoritative_tail"
	canonicalCommitTrigger?: CanonicalCommitTrigger
	syncGeneration?: number
	requiredSeqId?: string
	recoveryAnchorAppMessageId?: string
	allowRemoteRevokedAnchorCleanup?: boolean
	useHistoryPageCache?: boolean
	callback?: () => void
}

interface PullMessageResult {
	didPullSucceed: boolean
	pulledItems: any[]
	/** 成功 HTTP 查询实际返回的全部 envelope；失败时为空，禁止部分提交。 */
	statusItems?: any[]
	response?: any
}

interface AuthoritativeTailPullResult extends PullMessageResult {
	statusItems: any[]
	writeOptions?:
		| { mode: "replace"; preserveStreamSuperMessageIds: string[] }
		| { mode: "merge" }
		| {
				mode: "replace_tail"
				anchorSuperMessageId: string
				preserveStreamSuperMessageIds: string[]
		  }
}

interface ForegroundRecoveryAnchor {
	appMessageId: string
	role?: "user" | "assistant" | "tool"
	superMessageId?: string
	/** 仅保留为恢复水位元数据，不参与逻辑消息身份的严格相等判断。 */
	seqId?: string
}

interface ForegroundRecoveryAnchorState {
	baseAnchor?: ForegroundRecoveryAnchor
	latestCommittedAnchor?: ForegroundRecoveryAnchor
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

function getFetchedMessageSuperMessageId(item: any) {
	const message = item?.seq?.message
	const appMessageId = String(message?.app_message_id || "")
	if (!appMessageId) return ""
	const node = getRawMessageNode(message)
	return node?.role === "user" ? appMessageId : String(node?.super_message_id || appMessageId)
}

function getStoredMessageSuperMessageId(message: any) {
	return String(message?.super_message_id || message?.app_message_id || "")
}

function dedupePulledItemsBySuperMessageId(items: any[]) {
	const seenSuperMessageIds = new Set<string>()
	return items.filter((item) => {
		const superMessageId = getFetchedMessageSuperMessageId(item)
		if (!superMessageId || seenSuperMessageIds.has(superMessageId)) return false
		seenSuperMessageIds.add(superMessageId)
		return true
	})
}

function compareMessageSeqId(left: string, right: string) {
	if (left === right) return 0
	const normalizedLeft = String(left || "").replace(/^0+(?=\d)/, "")
	const normalizedRight = String(right || "").replace(/^0+(?=\d)/, "")
	if (/^\d+$/.test(normalizedLeft) && /^\d+$/.test(normalizedRight)) {
		if (normalizedLeft.length !== normalizedRight.length) {
			return normalizedLeft.length - normalizedRight.length
		}
	}
	return normalizedLeft.localeCompare(normalizedRight)
}

function getRecoveryAnchorRole(role: unknown): ForegroundRecoveryAnchor["role"] {
	return role === "user" || role === "assistant" || role === "tool" ? role : undefined
}

/**
 * 判断前台恢复是否命中离开前的 durable anchor。
 * User 的协议身份由 app_message_id 唯一确定；Assistant/Tool 的 Final revision
 * 可能更换 app_message_id，因此优先使用稳定的 super_message_id。seq_id 只描述
 * 持久化顺序，发送阶段本地临时值不能成为继续扫描历史的硬条件。
 */
function getFetchedRecoveryAnchor(item: any): ForegroundRecoveryAnchor | undefined {
	const message = item?.seq?.message
	const appMessageId = String(message?.app_message_id || "")
	if (!appMessageId) return undefined
	const node = getRawMessageNode(message)
	const role = getRecoveryAnchorRole(node?.role)
	const superMessageId = role === "user" ? "" : String(node?.super_message_id || appMessageId)
	const seqId = String(item?.seq?.seq_id || "")
	return {
		appMessageId,
		...(role ? { role } : {}),
		...(superMessageId ? { superMessageId } : {}),
		...(seqId ? { seqId } : {}),
	}
}

function matchesForegroundRecoveryAnchor(item: any, anchor?: ForegroundRecoveryAnchor): boolean {
	if (!anchor?.appMessageId) return false
	const fetchedAnchor = getFetchedRecoveryAnchor(item)
	if (!fetchedAnchor) return false
	if (anchor.role === "user") {
		return fetchedAnchor.role === "user" && fetchedAnchor.appMessageId === anchor.appMessageId
	}
	if (anchor.role && fetchedAnchor.role && fetchedAnchor.role !== anchor.role) return false
	if (anchor.superMessageId && fetchedAnchor.superMessageId) {
		return fetchedAnchor.superMessageId === anchor.superMessageId
	}
	return fetchedAnchor.appMessageId === anchor.appMessageId
}

/**
 * 管理当前话题的消息拉取、增量同步、前台恢复和分页加载。
 */
export function useTopicMessages({
	selectedTopic,
	checkNowDebounced,
	topicStore = defaultTopicStore,
}: UseTopicMessagesParams) {
	// topic_id和page_token的映射
	const topicPageTokenMap = useRef<Record<string, string>>({})
	const topicNotHaveMoreMessageMap = useRef<Record<string, boolean>>({})
	// Track which topics have completed their initial load
	const initialLoadedTopicsRef = useRef<Set<string>>(new Set())
	const selectedTopicRef = useRef(selectedTopic)
	const recoveryOwnerTokenRef = useRef(Symbol("useTopicMessages"))
	const activationTopicSyncRef = useRef<{ topicId: string; generation: number } | null>(null)
	const foregroundTopicSyncRef = useRef<{ topicId: string; generation: number } | null>(null)
	const lastForegroundSyncAtRef = useRef(0)
	const foregroundRecoveryAnchorRef = useRef<Record<string, ForegroundRecoveryAnchorState>>({})
	const historyPullInFlightTopicsRef = useRef<Set<string>>(new Set())
	const lastHistoryPageTokenMapRef = useRef<Record<string, string>>({})
	selectedTopicRef.current = selectedTopic

	const [isMessagesInitialLoading, setIsMessagesInitialLoading] = useState(() =>
		Boolean(selectedTopic?.chat_topic_id),
	)
	/** 当前选中话题本轮拉取已结束（写入 store 或请求结束），用于避免切换话题时读到空消息列表 */
	const [isSelectedTopicMessagesReady, setIsSelectedTopicMessagesReady] = useState(
		() => !selectedTopic?.id,
	)

	/**
	 * 读取当前 topic 最新的 durable committed message 作为恢复下界。
	 * Store canonical 列表按 seq_id 升序排列，不能再用数组首项代表最新消息；
	 * 活动 StreamState 也必须单独排除，避免把未持久化的临时卡当分页停止锚点。
	 */
	const getTopicLatestMessageAnchor = useMemoizedFn(
		(topicId?: string): ForegroundRecoveryAnchor | undefined => {
			if (!topicId) return undefined
			const currentMessages = superMagicStore.messages.get(topicId) || []
			const activeStreamIds = new Set(
				Array.from(superMagicStore.topicMeta.get(topicId)?.content?.keys() || []),
			)
			const durableMessages = currentMessages.filter((message: any) => {
				const superMessageId = getStoredMessageSuperMessageId(message)
				return Boolean(
					message?.app_message_id &&
					!activeStreamIds.has(superMessageId) &&
					!optimisticMessageStore.getStatus(topicId, message.app_message_id),
				)
			})
			const latestMessage = durableMessages.reduce<any>((latest, message: any) => {
				if (!latest) return message
				const latestSeqId = String(latest.seq_id || "")
				const messageSeqId = String(message.seq_id || "")
				return compareMessageSeqId(messageSeqId, latestSeqId) > 0 ? message : latest
			}, undefined)
			if (!latestMessage?.app_message_id) return undefined
			const role = getRecoveryAnchorRole(latestMessage.role || latestMessage.debug?.role)
			return {
				appMessageId: String(latestMessage.app_message_id),
				...(role ? { role } : {}),
				...(role !== "user"
					? {
							superMessageId:
								getStoredMessageSuperMessageId(latestMessage) || undefined,
						}
					: {}),
				seqId: String(latestMessage.seq_id || "") || undefined,
			}
		},
	)

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
	 * 本地撤回锚点只在本 Tab 发起 undo 时创建。后续非本地撤回刷新入口若从 HTTP
	 * 明确读到同一 User 已恢复，说明其他浏览器已经取消撤回，需要清理本 Tab sidecar。
	 */
	const reconcileActiveRevokedAnchorFromHttp = useMemoizedFn(
		(
			topicId: string,
			pulledItems: any[],
			writeOptions?: AuthoritativeTailPullResult["writeOptions"],
		) => {
			const activeAnchor = optimisticMessageStore.getActiveRevokedAnchor(topicId)
			if (!activeAnchor?.seq_id) return

			const authoritativeAnchor = pulledItems.find((item) => {
				const sequence = item?.seq
				const message = sequence?.message
				return [sequence?.seq_id, sequence?.message_id, message?.app_message_id].some(
					(identity) => String(identity || "") === activeAnchor.seq_id,
				)
			})
			const authoritativeStatus = String(authoritativeAnchor?.seq?.message?.status || "")
			if (authoritativeStatus === MessageStatus.REVOKED) return
			if (authoritativeStatus) {
				optimisticMessageStore.clearActiveRevokedAnchor(topicId)
				optimisticMessageStore.clearHiddenRevokedOptimisticMessageIds(topicId)
				return
			}

			// 未返回锚点只有在 HTTP 已证明覆盖该 seq 区间时才具备删除语义。
			// replace 覆盖完整查询范围；replace_tail 仅覆盖公共锚点之后的后缀。
			if (!writeOptions) return
			if (writeOptions.mode === "merge") return
			if (writeOptions.mode === "replace_tail") {
				const commonAnchor = pulledItems.find(
					(item) =>
						getFetchedMessageSuperMessageId(item) === writeOptions.anchorSuperMessageId,
				)
				const commonAnchorSeqId = String(commonAnchor?.seq?.seq_id || "")
				if (
					!commonAnchorSeqId ||
					compareMessageSeqId(activeAnchor.seq_id, commonAnchorSeqId) <= 0
				)
					return
			}

			optimisticMessageStore.clearActiveRevokedAnchor(topicId)
			optimisticMessageStore.clearHiddenRevokedOptimisticMessageIds(topicId)
		},
	)

	/**
	 * 只请求一页消息，不直接写入 store。
	 * 前台恢复会复用这层能力，逐页聚合结果后再一次性提交列表。
	 */
	const fetchMessagesPage = useMemoizedFn(
		async ({
			conversation_id,
			chat_topic_id,
			page_token,
			order,
			limit = 20,
			updatePageToken = true,
			useHistoryPageCache = false,
			callback,
		}: Omit<
			PullMessageParams,
			"writeIntent" | "syncGeneration"
		>): Promise<PullMessageResult> => {
			try {
				const cachedPage = useHistoryPageCache
					? topicHistoryPageCache.get(chat_topic_id, page_token, order, limit)
					: undefined
				if (cachedPage) {
					if (updatePageToken) {
						if (cachedPage.response?.has_more === false) {
							topicNotHaveMoreMessageMap.current[chat_topic_id] = true
							delete topicPageTokenMap.current[chat_topic_id]
						} else if (cachedPage.response?.page_token) {
							topicNotHaveMoreMessageMap.current[chat_topic_id] = false
							topicPageTokenMap.current[chat_topic_id] =
								cachedPage.response.page_token
						}
					}
					callback?.()
					return {
						didPullSucceed: true,
						pulledItems: cachedPage.pulledItems,
						statusItems: cachedPage.statusItems,
						response: cachedPage.response,
					}
				}
				const response = await requestMessagePage(
					{
						conversation_id,
						chat_topic_id,
						page_token,
						limit,
						order,
					},
					recoveryOwnerTokenRef.current,
				)
				if (!response || !Array.isArray(response.items)) {
					throw new Error("[useTopicMessages] invalid messages page response")
				}
				const pulledItems = response?.items || []
				const renderableMessages = pulledItems
					.filter(shouldIncludeFetchedMessage)
					?.map((item: any) => {
						const data = getRawMessageNode(item?.seq?.message)
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
				if (useHistoryPageCache) {
					topicHistoryPageCache.set(chat_topic_id, page_token, order, limit, {
						pulledItems,
						statusItems: pulledItems,
						response,
					})
				}
				if (updatePageToken) {
					// 历史分页必须同时记录 token 和终页状态；仅保留旧 token 会让布局滚动
					// 在 has_more=false 后继续重复请求最后一页。
					if (response?.has_more === false) {
						topicNotHaveMoreMessageMap.current[chat_topic_id] = true
						delete topicPageTokenMap.current[chat_topic_id]
					} else {
						topicNotHaveMoreMessageMap.current[chat_topic_id] = false
						if (response?.page_token) {
							topicPageTokenMap.current[chat_topic_id] = response.page_token
						}
					}
				}

				callback?.()
				return {
					didPullSucceed: true,
					pulledItems,
					statusItems: pulledItems,
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
					statusItems: [],
				}
			}
		},
	)

	/**
	 * `messages/queries` 对最新消息到公共锚点之间的 membership 具有权威语义。
	 * 所有分页结果先在本地聚合；只有找到稳定公共锚点或确认 has_more=false 后才允许写 Store。
	 */
	const fetchAuthoritativeTail = useMemoizedFn(
		async ({
			conversation_id,
			chat_topic_id,
			page_token,
			order,
			limit = POLLING_SYNC_MESSAGE_COUNT,
			requiredSeqId,
			recoveryAnchorAppMessageId,
			callback,
		}: Pick<
			PullMessageParams,
			| "conversation_id"
			| "chat_topic_id"
			| "page_token"
			| "order"
			| "limit"
			| "requiredSeqId"
			| "recoveryAnchorAppMessageId"
			| "callback"
		>): Promise<AuthoritativeTailPullResult> => {
			// 终态轮询也需要覆盖旧临时卡；不能只让 watchdog 请求携带较早锚点。
			recoveryAnchorAppMessageId = superMagicStore.resolveStreamRecoveryRequest({
				topicId: chat_topic_id,
				correlationId: "",
				anchorAppMessageId: recoveryAnchorAppMessageId,
			})?.anchorAppMessageId
			const activeStreamIdsAtRequestStart = new Set<string>()
			const topicContent = superMagicStore.topicMeta.get(chat_topic_id)?.content
			topicContent?.forEach((_state, superMessageId) =>
				activeStreamIdsAtRequestStart.add(superMessageId),
			)
			const localStableIdentities = new Set(
				(superMagicStore.messages.get(chat_topic_id) || []).flatMap((message: any) => {
					const superMessageId = getStoredMessageSuperMessageId(message)
					if (
						!superMessageId ||
						message.is_stream_placeholder ||
						activeStreamIdsAtRequestStart.has(superMessageId)
					)
						return []
					if (optimisticMessageStore.getStatus(chat_topic_id, message?.app_message_id))
						return []
					if (
						requiredSeqId &&
						message?.seq_id &&
						compareMessageSeqId(String(message.seq_id), requiredSeqId) >= 0
					)
						return []
					return [superMessageId]
				}),
			)
			const visitedPageTokens = new Set<string>()
			let nextPageToken = page_token
			let aggregatedPulledItems: any[] = []
			let aggregatedStatusItems: any[] = []
			let lastResponse: any
			const getConcurrentStreamSuperMessageIds = () => {
				const currentContent = superMagicStore.topicMeta.get(chat_topic_id)?.content
				if (!currentContent) return []
				return Array.from(currentContent.keys()).filter(
					(superMessageId) => !activeStreamIdsAtRequestStart.has(superMessageId),
				)
			}

			for (let pageIndex = 0; pageIndex < AUTHORITATIVE_TAIL_MAX_PAGE_COUNT; pageIndex += 1) {
				if (visitedPageTokens.has(nextPageToken)) {
					return { didPullSucceed: false, pulledItems: [], statusItems: [] }
				}
				visitedPageTokens.add(nextPageToken)

				const pageResult = await fetchMessagesPage({
					conversation_id,
					chat_topic_id,
					page_token: nextPageToken,
					order,
					limit,
					updatePageToken: false,
					callback,
				})
				if (!pageResult.didPullSucceed) {
					return { didPullSucceed: false, pulledItems: [], statusItems: [] }
				}
				lastResponse = pageResult.response
				aggregatedStatusItems = dedupePulledItemsByAppMessageId([
					...aggregatedStatusItems,
					...(pageResult.statusItems || pageResult.pulledItems),
				])
				aggregatedPulledItems = dedupePulledItemsBySuperMessageId([
					...aggregatedPulledItems,
					...pageResult.pulledItems.filter(shouldIncludeFetchedMessage),
				])

				if (pageIndex === 0 && requiredSeqId) {
					const latestHttpSeqId = aggregatedStatusItems.reduce((latestSeqId, item) => {
						const seqId = String(item?.seq?.seq_id || "")
						if (
							!seqId ||
							(latestSeqId && compareMessageSeqId(seqId, latestSeqId) <= 0)
						) {
							return latestSeqId
						}
						return seqId
					}, "")
					// WS 已确认更高 seq 持久化，但 HTTP 最新页尚未追上时不能执行缺席删除。
					if (
						!latestHttpSeqId ||
						compareMessageSeqId(latestHttpSeqId, requiredSeqId) < 0
					) {
						return { didPullSucceed: false, pulledItems: [], statusItems: [] }
					}
				}

				const requestedAnchorIndex = recoveryAnchorAppMessageId
					? aggregatedPulledItems.findIndex(
							(item) =>
								String(item?.seq?.message?.app_message_id || "") ===
								recoveryAnchorAppMessageId,
						)
					: -1
				const anchorIndex = recoveryAnchorAppMessageId
					? requestedAnchorIndex
					: aggregatedPulledItems.findIndex((item) =>
							localStableIdentities.has(getFetchedMessageSuperMessageId(item)),
						)
				if (anchorIndex >= 0) {
					const anchorSuperMessageId = getFetchedMessageSuperMessageId(
						aggregatedPulledItems[anchorIndex],
					)
					return {
						didPullSucceed: true,
						pulledItems: aggregatedPulledItems.slice(0, anchorIndex + 1),
						statusItems: aggregatedStatusItems,
						response: lastResponse,
						writeOptions: {
							mode: "replace_tail",
							anchorSuperMessageId,
							preserveStreamSuperMessageIds: getConcurrentStreamSuperMessageIds(),
						},
					}
				}

				if (!lastResponse?.has_more) {
					return {
						didPullSucceed: true,
						pulledItems: aggregatedPulledItems,
						statusItems: aggregatedStatusItems,
						response: lastResponse,
						writeOptions: {
							// has_more 只描述分页结束，无法证明服务端返回了完整 Topic membership。
							// 没有公共锚点时只能合并已持久化的 Final，禁止删除本地历史前缀。
							mode: "merge",
						},
					}
				}

				const responsePageToken = String(lastResponse?.page_token || "")
				if (!responsePageToken || visitedPageTokens.has(responsePageToken)) {
					return { didPullSucceed: false, pulledItems: [], statusItems: [] }
				}
				nextPageToken = responsePageToken
			}

			return {
				didPullSucceed: false,
				pulledItems: [],
				statusItems: [],
				response: lastResponse,
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
			writeIntent,
			canonicalCommitTrigger,
			syncGeneration,
			requiredSeqId,
			recoveryAnchorAppMessageId,
			allowRemoteRevokedAnchorCleanup = true,
			callback,
		}: PullMessageParams): Promise<PullMessageResult> => {
			if (
				topicNotHaveMoreMessageMap.current[chat_topic_id] &&
				page_token &&
				updatePageToken
			) {
				if (selectedTopicRef.current?.chat_topic_id === chat_topic_id)
					setIsSelectedTopicMessagesReady(true)
				return { didPullSucceed: true, pulledItems: [], statusItems: [] }
			}
			const pullResult =
				writeIntent === "authoritative_tail"
					? await fetchAuthoritativeTail({
							conversation_id,
							chat_topic_id,
							page_token,
							order,
							limit,
							requiredSeqId,
							recoveryAnchorAppMessageId,
							callback,
						})
					: await fetchMessagesPage({
							conversation_id,
							chat_topic_id,
							page_token,
							order,
							limit,
							updatePageToken,
							callback,
						})
			if (!pullResult.didPullSucceed) return pullResult
			if (writeIntent === "authoritative_tail") {
				const authoritativeTailResult = pullResult as AuthoritativeTailPullResult
				const commitTrigger = canonicalCommitTrigger || "polling"
				if (!authoritativeTailResult.writeOptions) {
					return { ...pullResult, didPullSucceed: false }
				}
				superMagicStore.reconcileAuthoritativeMessages(chat_topic_id, {
					statusItems: authoritativeTailResult.statusItems,
					membershipItems: authoritativeTailResult.pulledItems,
					writeOptions: {
						...authoritativeTailResult.writeOptions,
						...(syncGeneration !== undefined ? { syncGeneration } : {}),
						// WS persistent-message 通知已经确认该 Assistant 可进入消息级 Final；
						// 普通前台恢复与轮询只能作为非终态进度快照对账。
						assistantSnapshotPolicy:
							commitTrigger === "websocket" ? "canonical_final" : "progress_snapshot",
						canonicalCommitContext: {
							source: "http",
							lifecycleEventPolicy: commitTrigger === "websocket" ? "live" : "silent",
							trigger: commitTrigger,
						},
						eventPolicy: "live_arrival",
						// 最近尾部对账可能包含仍在运行的当前任务，不能仅因来自 HTTP
						// 就把 embedded waiting/running 提前投影成历史弱终态。
						toolProjectionPolicy: "preserve_live",
					},
				})
			} else if (writeIntent === "incremental") {
				// 增量模式保留现有 messages/buffer 状态，只把最新节点逐条灌进 store，
				// 同时先合并响应中已有身份的外层状态；有限窗口的缺席不具备删除语义。
				const orderedItems = pullResult.pulledItems.slice().reverse()
				superMagicStore.reconcileAuthoritativeMessages(chat_topic_id, {
					statusItems: pullResult.statusItems || pullResult.pulledItems,
					membershipItems: orderedItems,
					writeOptions: { mode: "incremental" },
				})
			} else {
				superMagicStore.reconcileAuthoritativeMessages(chat_topic_id, {
					statusItems: pullResult.statusItems || pullResult.pulledItems,
					membershipItems: pullResult.pulledItems,
					writeOptions: {
						mode: writeIntent,
						assistantSnapshotPolicy: "canonical_final",
						syncGeneration,
						// 初次快照、恢复和历史分页都是已持久化历史；普通 Tool
						// 不允许继续以 waiting/running 形式进入 UI。
						toolProjectionPolicy: "historical_terminal",
					},
				})
			}
			if (allowRemoteRevokedAnchorCleanup) {
				const cleanupWriteOptions =
					writeIntent === "authoritative_tail"
						? (pullResult as AuthoritativeTailPullResult).writeOptions
						: writeIntent === "replace" && pullResult.response?.has_more === false
							? ({
									mode: "replace",
									preserveStreamSuperMessageIds: [],
								} satisfies NonNullable<
									AuthoritativeTailPullResult["writeOptions"]
								>)
							: undefined
				reconcileActiveRevokedAnchorFromHttp(
					chat_topic_id,
					writeIntent === "authoritative_tail"
						? (pullResult as AuthoritativeTailPullResult).statusItems
						: pullResult.statusItems || pullResult.pulledItems,
					cleanupWriteOptions,
				)
			}
			updateForegroundRecoveryCommittedAnchor(chat_topic_id)
			if (!initialLoadedTopicsRef.current.has(chat_topic_id)) {
				initialLoadedTopicsRef.current.add(chat_topic_id)
				setIsMessagesInitialLoading(false)
			}
			if (selectedTopicRef.current?.chat_topic_id === chat_topic_id) {
				setIsSelectedTopicMessagesReady(true)
			}
			return pullResult
		},
	)

	/**
	 * 只有 checkpoint 等显式完整恢复才能聚合完整 authoritative snapshot 并一次性 replace。
	 * 任一分页失败或服务端声明 has_more 却不给下一页 token 时，都返回失败且不提交 partial。
	 */
	const recoverTopicMessages = useMemoizedFn(
		async ({
			conversationId,
			topicId,
			syncGeneration,
			limit = FULL_TOPIC_SYNC_MESSAGE_COUNT,
			checkpointRollback,
		}: {
			conversationId: string
			topicId: string
			syncGeneration: number
			limit?: number
			checkpointRollback?: {
				eventId: string
				action: "start" | "undo" | "commit" | "rollback"
			}
		}): Promise<PullMessageResult> => {
			const pulledItems: any[] = []
			const statusItems: any[] = []
			const visitedPageTokens = new Set<string>()
			let pageToken = ""
			let latestResponse: any
			let pageCount = 0

			// eslint-disable-next-line no-constant-condition
			while (true) {
				if (
					pageCount >= FULL_RECOVERY_MAX_PAGE_COUNT ||
					pulledItems.length >= FULL_RECOVERY_MAX_MESSAGE_COUNT ||
					!superMagicStore.isTopicSyncCurrent(topicId, syncGeneration)
				) {
					return { didPullSucceed: false, pulledItems: [], statusItems: [] }
				}
				const pageResult = await fetchMessagesPage({
					conversation_id: conversationId,
					chat_topic_id: topicId,
					page_token: pageToken,
					order: "desc",
					limit,
					updatePageToken: false,
				})
				if (!pageResult.didPullSucceed) return pageResult
				pageCount += 1

				pulledItems.push(...pageResult.pulledItems)
				statusItems.push(...(pageResult.statusItems || pageResult.pulledItems))
				if (pulledItems.length > FULL_RECOVERY_MAX_MESSAGE_COUNT) {
					return { didPullSucceed: false, pulledItems: [], statusItems: [] }
				}
				latestResponse = pageResult.response
				if (!latestResponse?.has_more) break

				const nextPageToken = String(latestResponse?.page_token || "")
				if (!nextPageToken || visitedPageTokens.has(nextPageToken)) {
					return { didPullSucceed: false, pulledItems: [], statusItems: [] }
				}
				visitedPageTokens.add(nextPageToken)
				pageToken = nextPageToken
			}

			// has_more=false 只表示 Topic mapping 已到末页；只有后端确认所有 mapping
			// 都成功物化时，当前聚合结果才具备完整快照的缺席删除语义。
			if (latestResponse?.snapshot_complete !== true) {
				return { didPullSucceed: false, pulledItems: [], statusItems: [] }
			}
			// 任意完整恢复都只有当前 generation 能提交；请求在最后一页期间也可能被抢占。
			if (!superMagicStore.isTopicSyncCurrent(topicId, syncGeneration)) {
				return { didPullSucceed: false, pulledItems: [], statusItems: [] }
			}

			// undo 是唯一允许 HTTP 把 canonical imStatus 从 revoked 恢复为 read 的远端动作。
			// 授权必须紧邻完整快照提交，避免不完整或失败请求提前放开状态单调性保护。
			if (checkpointRollback?.action === "undo" && statusItems.length > 0) {
				superMagicStore.authorizeImStatusRestore(topicId)
			}
			superMagicStore.reconcileAuthoritativeMessages(topicId, {
				statusItems: dedupePulledItemsByAppMessageId(statusItems),
				membershipItems: pulledItems,
				writeOptions: {
					mode: "replace",
					assistantSnapshotPolicy: "canonical_final",
					syncGeneration,
					toolProjectionPolicy: "historical_terminal",
				},
			})
			reconcileActiveRevokedAnchorFromHttp(topicId, statusItems, {
				mode: "replace",
				preserveStreamSuperMessageIds: [],
			})
			return {
				didPullSucceed: true,
				pulledItems,
				statusItems,
				response: latestResponse,
			}
		},
	)

	/**
	 * 获取前台恢复的目标锚点。
	 * 若 hidden 后页面还持续渲染过新内容，则优先对齐“隐藏期最新已落地锚点”；
	 * 否则退回 hidden 瞬间的基准锚点，最后再兜底使用当前列表顶部消息。
	 */
	const getCurrentTopicRecoveryAnchor = useMemoizedFn((topicId?: string) => {
		if (!topicId) return undefined
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

	const cancelForegroundTopicSync = useMemoizedFn((topicId?: string) => {
		const inFlightSync = foregroundTopicSyncRef.current
		if (!inFlightSync || (topicId && inFlightSync.topicId !== topicId)) return
		foregroundTopicSyncRef.current = null
		superMagicStore.cancelTopicSync(inFlightSync.topicId, inFlightSync.generation)
	})

	const cancelActivationTopicSync = useMemoizedFn((topicId?: string) => {
		const inFlightSync = activationTopicSyncRef.current
		if (!inFlightSync || (topicId && inFlightSync.topicId !== topicId)) return
		activationTopicSyncRef.current = null
		superMagicStore.cancelTopicSync(inFlightSync.topicId, inFlightSync.generation)
	})

	/**
	 * Topic 首次/切换激活也必须走 generation-scoped 权威同步。屏障要先于
	 * setActiveTopicId 建立，否则该调用会同步恢复后台 StreamState，并在 User
	 * 历史尚未写入时创建错误排序的 Assistant 占位卡。
	 */
	const syncSelectedTopicOnActivation = useMemoizedFn((topic: Topic) => {
		const topicId = topic.chat_topic_id
		const syncGeneration = superMagicStore.beginTopicSync(topicId)
		const inFlightSync = { topicId, generation: syncGeneration }
		activationTopicSyncRef.current = inFlightSync
		superMagicStore.setActiveTopicId(topicId)

		void pullMessage({
			conversation_id: topic.chat_conversation_id,
			chat_topic_id: topicId,
			page_token: "",
			order: "desc",
			limit: FULL_TOPIC_SYNC_MESSAGE_COUNT,
			updatePageToken: true,
			writeIntent: "replace",
			syncGeneration,
		})
			.then((pullResult) => {
				if (activationTopicSyncRef.current !== inFlightSync) return
				if (!superMagicStore.isTopicSyncCurrent(topicId, syncGeneration)) return
				const currentTopic = selectedTopicRef.current
				if (currentTopic?.chat_topic_id !== topicId) return

				superMagicStore.completeTopicSync(topicId, syncGeneration, {
					succeeded: pullResult.didPullSucceed,
					taskStatus: currentTopic.task_status || currentTopic.status,
					latestSeqId: pullResult.didPullSucceed
						? superMagicStore.getLatestMessageSeqId(topicId)
						: undefined,
				})
				if (!pullResult.didPullSucceed) setIsMessagesInitialLoading(false)
			})
			.catch(() => {
				if (activationTopicSyncRef.current !== inFlightSync) return
				if (superMagicStore.isTopicSyncCurrent(topicId, syncGeneration)) {
					superMagicStore.completeTopicSync(topicId, syncGeneration, {
						succeeded: false,
						taskStatus: selectedTopicRef.current?.task_status,
					})
				}
				setIsMessagesInitialLoading(false)
			})
			.finally(() => {
				if (activationTopicSyncRef.current !== inFlightSync) return
				activationTopicSyncRef.current = null
				if (getTopicRecoveryStatus(topicId).hasScheduled) resumeTopicRecovery(topicId)
			})
	})

	/**
	 * 拉取当前选中话题的消息。
	 * 除前台恢复外，其余场景继续使用既有的一次请求模型。
	 */
	const updateTopicMessages = useMemoizedFn(
		({
			writeIntent = "replace",
			messageCount = FULL_TOPIC_SYNC_MESSAGE_COUNT,
			allowRemoteRevokedAnchorCleanup = true,
		}: {
			writeIntent?: PullMessageParams["writeIntent"]
			messageCount?: number
			allowRemoteRevokedAnchorCleanup?: boolean
		} = {}) => {
			// if (selectedTopic?.id && selectedWorkspace) {
			if (selectedTopic?.id) {
				pullMessage({
					conversation_id: selectedTopic.chat_conversation_id,
					chat_topic_id: selectedTopic.chat_topic_id,
					page_token: "",
					order: "desc",
					limit: messageCount,
					updatePageToken: true,
					writeIntent,
					allowRemoteRevokedAnchorCleanup,
				})
			}
		},
	)

	const reconcileTopicStatusAfterForegroundSync = useMemoizedFn(async () => {
		const currentTopic = selectedTopicRef.current
		if (!currentTopic?.id || !currentTopic.chat_topic_id) return
		try {
			await syncTopicStatusAfterForegroundMessageReconciliation({
				topicStore,
				topicId: currentTopic.id,
				chatTopicId: currentTopic.chat_topic_id,
				localTaskStatus: currentTopic.task_status || currentTopic.status,
			})
		} catch (error) {
			console.warn("[useTopicMessages] 前台对账后同步话题状态失败:", error)
		}
	})

	/**
	 * 当前处于前台时按 durable anchor 恢复当前 Topic。
	 * 带 anchor 的恢复只允许两段有限窗口；命中公共 anchor 后只替换权威尾部，
	 * 只有服务端明确给出完整快照证明时才允许 destructive full replace。
	 */
	const syncSelectedTopicOnForeground = useMemoizedFn(async () => {
		const currentSelectedTopic = selectedTopicRef.current
		if (!currentSelectedTopic?.id || document.visibilityState !== "visible") return
		if (foregroundTopicSyncRef.current) return
		// StreamRecoveryCoordinator 可能已经在同一 Topic 建立 authoritative sync；
		// visible 只复用该代次，不能再次从 page_token="" 开启第二条分页链路。
		const topicMeta = superMagicStore.topicMeta.get(currentSelectedTopic.chat_topic_id)
		if (topicMeta?.syncState === "syncing") return
		const now = Date.now()
		// 某些浏览器在切回前台时会连续触发 visibilitychange，所有前台 HTTP 对账共享去重窗口。
		if (now - lastForegroundSyncAtRef.current < FOREGROUND_SYNC_DEDUPE_MS) return
		lastForegroundSyncAtRef.current = now

		let didAttemptForegroundReconciliation = false
		let inFlightSync: { topicId: string; generation: number } | null = null
		try {
			if (!shouldRunForegroundRecovery(currentSelectedTopic)) {
				didAttemptForegroundReconciliation = true
				// 稳定会话无需完整快照恢复，但仍做一次最近窗口状态对账，覆盖 WS 通知丢失。
				delete foregroundRecoveryAnchorRef.current[currentSelectedTopic.chat_topic_id]
				await pullMessage({
					conversation_id: currentSelectedTopic.chat_conversation_id,
					chat_topic_id: currentSelectedTopic.chat_topic_id,
					page_token: "",
					order: "desc",
					limit: POLLING_SYNC_MESSAGE_COUNT,
					updatePageToken: false,
					writeIntent: "authoritative_tail",
					canonicalCommitTrigger: "recovery",
				})
				acknowledgeTopicSync(
					currentSelectedTopic.chat_topic_id,
					superMagicStore.getLatestMessageSeqId(currentSelectedTopic.chat_topic_id),
				)
				return
			}
			didAttemptForegroundReconciliation = true
			const topicId = currentSelectedTopic.chat_topic_id
			const syncGeneration = superMagicStore.beginTopicSync(topicId)
			inFlightSync = { topicId, generation: syncGeneration }
			foregroundTopicSyncRef.current = inFlightSync
			const isCurrentForegroundOwner = () =>
				foregroundTopicSyncRef.current === inFlightSync &&
				selectedTopicRef.current?.chat_topic_id === topicId
			const completeFailedSync = () => {
				if (!isCurrentForegroundOwner()) return
				if (!superMagicStore.isTopicSyncCurrent(topicId, syncGeneration)) return
				const currentTopic = selectedTopicRef.current
				superMagicStore.completeTopicSync(topicId, syncGeneration, {
					succeeded: false,
					taskStatus: currentTopic?.task_status || currentTopic?.status,
					renderStrategy: "foreground-instant",
				})
			}
			const recoveryAnchor = getCurrentTopicRecoveryAnchor(topicId)
			const activeStreamIdsAtRequestStart = Array.from(
				superMagicStore.topicMeta.get(topicId)?.content?.keys() || [],
			)
			let aggregatedPulledItems: any[] = []
			let aggregatedStatusItems: any[] = []
			let latestResponse: any
			let pageToken = ""
			let pageCount = 0
			let reachedAnchorIndex = -1
			let isAuthoritativeQueryComplete = false
			let writeMode: "replace" | "replace_tail" | "merge" = "merge"
			let anchorSuperMessageId = ""
			let didResolveRecovery = false
			const visitedPageTokens = new Set<string>()
			const pageLimits = recoveryAnchor
				? FOREGROUND_RECOVERY_PAGE_LIMITS
				: Array.from(
						{ length: FOREGROUND_RECOVERY_ANCHORLESS_PAGE_COUNT },
						() => FOREGROUND_RECOVERY_PAGE_SIZE,
					)
			const maxForegroundPageCount = pageLimits.length

			while (
				pageCount < maxForegroundPageCount &&
				aggregatedPulledItems.length < FOREGROUND_RECOVERY_MAX_MESSAGE_COUNT
			) {
				if (!isCurrentForegroundOwner()) return
				if (visitedPageTokens.has(pageToken)) {
					completeFailedSync()
					return
				}
				visitedPageTokens.add(pageToken)
				const pageResult = await fetchMessagesPage({
					conversation_id: currentSelectedTopic.chat_conversation_id,
					chat_topic_id: topicId,
					page_token: pageToken,
					order: "desc",
					limit: pageLimits[pageCount] || FOREGROUND_RECOVERY_PAGE_SIZE,
					updatePageToken: false,
				})
				if (!pageResult.didPullSucceed) {
					completeFailedSync()
					return
				}
				pageCount += 1
				latestResponse = pageResult.response
				aggregatedStatusItems = dedupePulledItemsByAppMessageId([
					...aggregatedStatusItems,
					...(pageResult.statusItems || pageResult.pulledItems),
				])
				aggregatedPulledItems = dedupePulledItemsByAppMessageId([
					...aggregatedPulledItems,
					...pageResult.pulledItems.filter(shouldIncludeFetchedMessage),
				])
				if (aggregatedPulledItems.length > FOREGROUND_RECOVERY_MAX_MESSAGE_COUNT) {
					completeFailedSync()
					return
				}

				reachedAnchorIndex = recoveryAnchor
					? aggregatedPulledItems.findIndex((item) =>
							matchesForegroundRecoveryAnchor(item, recoveryAnchor),
						)
					: -1
				if (reachedAnchorIndex >= 0) {
					writeMode = "replace_tail"
					anchorSuperMessageId = getFetchedMessageSuperMessageId(
						aggregatedPulledItems[reachedAnchorIndex],
					)
					didResolveRecovery = true
					break
				}
				if (!recoveryAnchor && pageCount >= maxForegroundPageCount) {
					// 没有 durable anchor 时只能把最近窗口作为非破坏性 tail 对账；
					// 禁止为了寻找不存在的 anchor 扫完整 Topic 历史。
					writeMode = "merge"
					didResolveRecovery = true
					break
				}

				if (!latestResponse?.has_more) {
					isAuthoritativeQueryComplete = Boolean(
						recoveryAnchor && latestResponse?.snapshot_complete === true,
					)
					// 普通 visible 在没有 durable anchor 时永远不具备缺席删除语义；
					// 即使服务端末页声明完整，也只允许有限 tail merge。
					writeMode = isAuthoritativeQueryComplete ? "replace" : "merge"
					didResolveRecovery = true
					break
				}

				const nextPageToken = String(latestResponse?.page_token || "")
				if (!nextPageToken || visitedPageTokens.has(nextPageToken)) {
					completeFailedSync()
					return
				}
				pageToken = nextPageToken
			}
			if (!didResolveRecovery) {
				// A bounded tail without the local anchor is still safe to merge. Do not
				// turn an incomplete foreground recovery into an unbounded history scan.
				if (recoveryAnchor && aggregatedPulledItems.length > 0) {
					writeMode = "merge"
					didResolveRecovery = true
				} else {
					completeFailedSync()
					return
				}
			}

			const membershipItems =
				writeMode === "replace_tail" && reachedAnchorIndex >= 0
					? aggregatedPulledItems.slice(0, reachedAnchorIndex + 1)
					: aggregatedPulledItems
			const preserveStreamSuperMessageIds = activeStreamIdsAtRequestStart
			// Only the selected write mode is allowed to decide membership. Message revision
			// arbitration and stream overlay preservation remain Store responsibilities.
			superMagicStore.reconcileAuthoritativeMessages(topicId, {
				statusItems: aggregatedStatusItems,
				membershipItems,
				writeOptions: {
					mode: writeMode,
					assistantSnapshotPolicy: "progress_snapshot",
					...(writeMode === "replace_tail" ? { anchorSuperMessageId } : {}),
					...(writeMode !== "merge" ? { preserveStreamSuperMessageIds } : {}),
					syncGeneration,
					// replace/replace_tail 只决定列表覆盖范围，不能证明工具已执行结束。
					toolProjectionPolicy: "preserve_live",
				},
			})
			reconcileActiveRevokedAnchorFromHttp(
				topicId,
				aggregatedStatusItems,
				writeMode === "replace_tail"
					? { mode: "replace_tail", anchorSuperMessageId, preserveStreamSuperMessageIds }
					: writeMode === "replace"
						? { mode: "replace", preserveStreamSuperMessageIds }
						: undefined,
			)
			if (!isCurrentForegroundOwner()) return
			if (!superMagicStore.isTopicSyncCurrent(topicId, syncGeneration)) return
			const latestSelectedTopic = selectedTopicRef.current
			const latestSeqId = superMagicStore.getLatestMessageSeqId(topicId)
			superMagicStore.completeTopicSync(topicId, syncGeneration, {
				succeeded: true,
				taskStatus: latestSelectedTopic?.task_status || latestSelectedTopic?.status,
				latestSeqId,
				renderStrategy: "foreground-instant",
			})
			acknowledgeTopicSync(topicId, latestSeqId)

			if (!initialLoadedTopicsRef.current.has(topicId)) {
				initialLoadedTopicsRef.current.add(topicId)
				setIsMessagesInitialLoading(false)
			}
			setIsSelectedTopicMessagesReady(true)
			delete foregroundRecoveryAnchorRef.current[topicId]
		} catch {
			if (inFlightSync && foregroundTopicSyncRef.current === inFlightSync) {
				cancelForegroundTopicSync(inFlightSync.topicId)
			}
		} finally {
			if (inFlightSync && foregroundTopicSyncRef.current === inFlightSync) {
				foregroundTopicSyncRef.current = null
			}
			if (didAttemptForegroundReconciliation) {
				await reconcileTopicStatusAfterForegroundSync()
			}
		}
	})

	/**
	 * 手动加载更早的历史消息，继续复用服务端返回的 page_token。
	 */
	const handlePullMoreMessage = useMemoizedFn(
		async (topicInfo: Topic | null, callback?: () => void) => {
			// if (selectedWorkspace && topicInfo) {
			if (topicInfo) {
				const topicId = topicInfo.chat_topic_id
				const pageToken = topicPageTokenMap.current[topicId] || ""
				if (
					topicNotHaveMoreMessageMap.current[topicId] ||
					historyPullInFlightTopicsRef.current.has(topicId) ||
					lastHistoryPageTokenMapRef.current[topicId] === pageToken
				) {
					return
				}

				historyPullInFlightTopicsRef.current.add(topicId)
				lastHistoryPageTokenMapRef.current[topicId] = pageToken
				// Capture the viewport before awaiting HTTP so the subsequent merge can restore it.
				callback?.()
				try {
					const pullResult = await pullMessage({
						conversation_id: topicInfo.chat_conversation_id,
						chat_topic_id: topicId,
						page_token: pageToken,
						order: "desc",
						limit: 100,
						updatePageToken: true,
						writeIntent: "merge",
						useHistoryPageCache: true,
					})
					if (!pullResult.didPullSucceed) {
						delete lastHistoryPageTokenMapRef.current[topicId]
					}
				} finally {
					historyPullInFlightTopicsRef.current.delete(topicId)
				}
			}
		},
	)

	// Initialize messages when topic changes
	useEffect(() => {
		const currentTopic = selectedTopicRef.current
		const topicId = currentTopic?.chat_topic_id
		setIsSelectedTopicMessagesReady(false)
		if (topicId && !initialLoadedTopicsRef.current.has(topicId)) {
			setIsMessagesInitialLoading(true)
		} else {
			setIsMessagesInitialLoading(false)
		}
		if (currentTopic?.id && topicId) {
			syncSelectedTopicOnActivation(currentTopic)
		} else {
			superMagicStore.setActiveTopicId(null)
		}
		const requestOwnerToken = recoveryOwnerTokenRef.current
		return () => {
			releaseMessagePageRequests(requestOwnerToken)
			cancelActivationTopicSync(topicId)
			cancelForegroundTopicSync(topicId)
		}
	}, [
		cancelActivationTopicSync,
		cancelForegroundTopicSync,
		selectedTopic?.chat_conversation_id,
		selectedTopic?.chat_topic_id,
		selectedTopic?.id,
		syncSelectedTopicOnActivation,
	])

	useEffect(() => {
		const topicId = selectedTopic?.chat_topic_id
		const conversationId = selectedTopic?.chat_conversation_id
		if (!topicId || !conversationId) return

		return registerStreamRecoveryOwner({
			ownerToken: recoveryOwnerTokenRef.current,
			topicId,
			conversationId,
			canRecover: () =>
				document.visibilityState === "visible" &&
				!activationTopicSyncRef.current &&
				!foregroundTopicSyncRef.current &&
				superMagicStore.topicMeta.get(topicId)?.syncState !== "syncing",
			getTaskStatus: () => {
				const currentTopic = selectedTopicRef.current
				if (currentTopic?.chat_topic_id !== topicId) return undefined
				return currentTopic.task_status || currentTopic.status
			},
			recover: ({
				syncGeneration,
				reason,
				requiredSeqId,
				anchorAppMessageId,
				checkpointRollback,
			}) => {
				if (reason === "checkpoint_rollback") {
					return recoverTopicMessages({
						conversationId,
						topicId,
						syncGeneration,
						checkpointRollback,
					})
				}
				return pullMessage({
					conversation_id: conversationId,
					chat_topic_id: topicId,
					page_token: "",
					order: "desc",
					limit:
						reason === "tool_response" || reason === "persistent_message"
							? LIVE_INCREMENTAL_SYNC_MESSAGE_COUNT
							: POLLING_SYNC_MESSAGE_COUNT,
					updatePageToken: false,
					writeIntent: "authoritative_tail",
					canonicalCommitTrigger:
						reason === "persistent_message" ? "websocket" : "recovery",
					syncGeneration,
					requiredSeqId,
					recoveryAnchorAppMessageId: anchorAppMessageId,
				})
			},
		})
	}, [
		pullMessage,
		recoverTopicMessages,
		selectedTopic?.chat_conversation_id,
		selectedTopic?.chat_topic_id,
		selectedTopic?.id,
	])

	// Subscribe to checkpoint rollback events. The event is only an invalidation signal;
	// canonical message membership and IM status always come from the complete HTTP snapshot.
	useEffect(() => {
		const handleCheckpointRollback = (
			data: SeqResponse<SuperMagicCheckpointRollbackMessage>,
		) => {
			const currentTopic = selectedTopicRef.current
			const event = data?.message
			const eventId = String(data?.seq_id || "")
			if (!currentTopic?.chat_conversation_id || !event || !eventId) return
			if (data.conversation_id !== currentTopic.chat_conversation_id) return
			if (event.chat_topic_id !== currentTopic.chat_topic_id) return
			if (event.topic_id !== currentTopic.id) return
			if (
				event.type !== IntermediateMessageType.SuperMagicCheckpointRollback ||
				event.refresh_required !== true
			)
				return

			requestTopicRecovery({
				topicId: event.chat_topic_id,
				correlationId: `checkpoint:${eventId}`,
				reason: "checkpoint_rollback",
				checkpointRollback: {
					eventId,
					action: event.action,
				},
			})
		}

		pubsub.subscribe(PubSubEvents.Super_Magic_Checkpoint_Rollback, handleCheckpointRollback)
		return () => {
			pubsub.unsubscribe(
				PubSubEvents.Super_Magic_Checkpoint_Rollback,
				handleCheckpointRollback,
			)
		}
	}, [selectedTopic?.chat_conversation_id, selectedTopic?.chat_topic_id, selectedTopic?.id])

	// Subscribe to WebSocket new message events
	useEffect(() => {
		/**
		 * 处理 WS 新消息事件。
		 * WS 只提供路由和 requiredSeqId，所有 debounce、single-flight 与重试
		 * 统一交给 TopicRecoveryCoordinator，避免与 Tool recovery 形成两套请求状态机。
		 */
		const handleNewMessage = (data: any) => {
			const { topic_id: chat_topic_id = "" } = data.message || {}
			const currentTopic = selectedTopicRef.current
			if (!currentTopic?.chat_conversation_id || chat_topic_id !== currentTopic.chat_topic_id)
				return
			if (data.conversation_id && data.conversation_id !== currentTopic.chat_conversation_id)
				return
			const incomingSeqId = String(data.seq_id || data.message?.seq_id || "")
			requestTopicRecovery({
				topicId: chat_topic_id,
				correlationId: `ws:${incomingSeqId || Date.now()}`,
				reason: "persistent_message",
				...(incomingSeqId ? { requiredSeqId: incomingSeqId } : {}),
			})
		}
		pubsub.subscribe(PubSubEvents.Super_Magic_New_Message_V2, handleNewMessage)
		return () => {
			pubsub?.unsubscribe(PubSubEvents.Super_Magic_New_Message_V2, handleNewMessage)
		}
	}, [selectedTopic?.chat_conversation_id, selectedTopic?.chat_topic_id])

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
			const topicId = selectedTopicRef.current?.chat_topic_id
			if (!topicId) return
			const recoveryStatus = getTopicRecoveryStatus(topicId)
			if (recoveryStatus.hasInFlight) return
			if (recoveryStatus.hasScheduled && recoveryStatus.reason === "checkpoint_rollback") {
				// checkpoint 具有完整快照和撤回状态恢复语义，不能被普通前台 tail 降级。
				resumeTopicRecovery(topicId)
				return
			}
			void syncSelectedTopicOnForeground().finally(() => {
				// 前台 anchor 对账结束后重新解析 hidden 期间积累的恢复要求；已经被本轮
				// HTTP 覆盖的请求会由 Store resolver 消除，仍有缺口才继续 tail recovery。
				if (getTopicRecoveryStatus(topicId).hasScheduled) resumeTopicRecovery(topicId)
			})
		}

		document.addEventListener("visibilitychange", handleVisibilityChange)
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange)
		}
	}, [setForegroundRecoveryBaseAnchor, syncSelectedTopicOnForeground])

	// Timer: poll messages every 20 seconds
	useEffect(() => {
		let disposed = false
		let inFlightPollingSync: { topicId: string; generation: number } | null = null

		const cancelInFlightPollingSync = () => {
			if (!inFlightPollingSync) return
			const { topicId, generation } = inFlightPollingSync
			inFlightPollingSync = null
			superMagicStore.cancelTopicSync(topicId, generation)
		}

		const hasActiveTopicSync = () =>
			Array.from(superMagicStore.topicMeta.entries()).some(
				([topicId, topicMeta]) =>
					topicMeta.syncState === "syncing" &&
					superMagicStore.isTopicSyncCurrent(topicId, topicMeta.syncGeneration),
			)

		const timer = setInterval(() => {
			const currentTopic = selectedTopicRef.current
			if (
				currentTopic?.id &&
				currentTopic.chat_conversation_id &&
				currentTopic.chat_topic_id
			) {
				const topicId = currentTopic.chat_topic_id
				const taskStatus = currentTopic.task_status || currentTopic.status
				const pollingParams = {
					conversation_id: currentTopic.chat_conversation_id,
					chat_topic_id: topicId,
					page_token: "",
					order: "desc" as const,
					// 轮询兜底保持中等窗口，兼顾稳定性和请求成本。
					limit: POLLING_SYNC_MESSAGE_COUNT,
					updatePageToken: false,
					writeIntent: "authoritative_tail" as const,
					canonicalCommitTrigger: "polling" as const,
				}

				if (taskStatus !== TaskStatus.FINISHED) {
					// Active chunks are the primary realtime source. The Store watchdog owns stalled
					// stream recovery, so resident polling would only duplicate healthy traffic.
					if (
						superMagicStore.isTopicStreaming(topicId) ||
						foregroundTopicSyncRef.current ||
						getTopicRecoveryStatus(topicId).hasInFlight
					)
						return
					void pullMessage(pollingParams)
					return
				}
				// A newly sent execution may still inherit the previous Topic `finished` value
				// until its first chunk/Final arrives. Never let terminal polling seize the render
				// barrier while that local execution or an active StreamState is present.
				if (
					superMagicStore.hasPendingTopicExecution?.(topicId) ||
					superMagicStore.isTopicStreaming(topicId) ||
					foregroundTopicSyncRef.current ||
					getTopicRecoveryStatus(topicId).hasInFlight
				)
					return
				if (typeof superMagicStore.beginTopicSync !== "function") {
					void pullMessage(pollingParams)
					return
				}
				// finished polling 只确认最近增量和任务完成屏障，不能复用完整历史 recovery。
				// generation 必须单飞且不能抢占已有权威同步，避免慢请求持续作废彼此。
				if (inFlightPollingSync || hasActiveTopicSync()) return
				const syncGeneration = superMagicStore.beginTopicSync(topicId)
				inFlightPollingSync = { topicId, generation: syncGeneration }

				void pullMessage(pollingParams)
					.then((pullResult) => {
						if (disposed || inFlightPollingSync?.generation !== syncGeneration) return
						if (!superMagicStore.isTopicSyncCurrent(topicId, syncGeneration)) return
						const currentTopic = selectedTopicRef.current
						const currentTaskStatus = currentTopic?.task_status || currentTopic?.status
						if (
							currentTopic?.chat_topic_id !== topicId ||
							currentTaskStatus !== TaskStatus.FINISHED
						) {
							superMagicStore.cancelTopicSync(topicId, syncGeneration)
							return
						}
						superMagicStore.completeTopicSync(topicId, syncGeneration, {
							succeeded: pullResult.didPullSucceed,
							taskStatus: currentTaskStatus,
							latestSeqId: pullResult.didPullSucceed
								? superMagicStore.getLatestMessageSeqId(topicId)
								: undefined,
						})
					})
					.catch(() => {
						// HTTP 后处理或 Store 写入异常时释放 generation；失败同步不能成为完成屏障。
						if (disposed || inFlightPollingSync?.generation !== syncGeneration) return
						superMagicStore.cancelTopicSync(topicId, syncGeneration)
					})
					.finally(() => {
						if (inFlightPollingSync?.generation === syncGeneration) {
							inFlightPollingSync = null
						}
					})
			}
		}, 20 * 1000)

		// Cleanup timer
		return () => {
			disposed = true
			clearInterval(timer)
			cancelInFlightPollingSync()
		}
	}, [pullMessage, selectedTopic])

	// Handle refresh topic messages after revoke
	useEffect(() => {
		const handleRefreshTopicMessages = () => {
			if (selectedTopic?.chat_topic_id) {
				topicHistoryPageCache.clearTopic(selectedTopic.chat_topic_id)
			}
			updateTopicMessages({
				// Revoke refresh is an authoritative snapshot: replace preserves the server's
				// complete canonical membership, while visible-branch filtering stays in UI projection.
				writeIntent: "replace",
				messageCount: 500,
				// 本地 undo 成功后会先设置锚点；紧随其后的刷新不能把尚未收敛的 read 当作远端恢复。
				allowRemoteRevokedAnchorCleanup: false,
			})
		}

		pubsub.subscribe(PubSubEvents.Refresh_Topic_Messages, handleRefreshTopicMessages)

		return () => {
			pubsub?.unsubscribe(PubSubEvents.Refresh_Topic_Messages, handleRefreshTopicMessages)
		}
	}, [selectedTopic?.chat_topic_id, updateTopicMessages])

	// Cleanup on component unmount
	useEffect(() => {
		const historyPullInFlightTopics = historyPullInFlightTopicsRef.current
		return () => {
			// Cleanup topic_id and page_token mapping
			topicPageTokenMap.current = {}
			topicNotHaveMoreMessageMap.current = {}
			historyPullInFlightTopics.clear()
			lastHistoryPageTokenMapRef.current = {}
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
