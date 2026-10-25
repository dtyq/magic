import { positionAnchoredMessages } from "@/pages/superMagic/stores/message-transforms"
import { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"
import { MessageStatus } from "@/pages/superMagic/pages/Workspace/types"
import { toJS } from "mobx"
import {
	aggregateAskUserMessages,
	type AskUserCardData,
	getAskUserCorrelationId,
	isAskUserMessage,
	ASK_USER_RECOVERY_FAILED_EVENT,
} from "./utils/askUser"

interface ProjectionCacheEntry {
	signature: ReadonlyArray<unknown>
	value: Record<string, any>
}

interface ProjectionRelations {
	messageIds: Set<unknown>
	correlationIds: Set<unknown>
	parentCorrelationIds: Set<unknown>
}

interface ProjectionState {
	sources: Array<any>
	result: Array<SuperMagicMessageItem>
	relations: ProjectionRelations
	version?: string | number
}

/**
 * Reuses the expensive observable-to-plain snapshot for unchanged message objects.
 * The cache is intentionally bounded because a Topic can page through far more history
 * than the visible projection should retain in memory.
 */
export class MessageProjectionCache {
	private readonly entries = new Map<object, ProjectionCacheEntry>()
	private state?: ProjectionState

	constructor(private readonly maxEntries = 8192) {}

	clear() {
		this.entries.clear()
		this.state = undefined
	}

	private getSignature(item: Record<string, any>) {
		return [
			item.app_message_id,
			item.super_message_id,
			item.seq_id,
			item.is_stream_placeholder,
			item.display_after_message_id,
			item.correlation_id,
			item.parent_correlation_id,
			item.role,
			item.type,
			item.event,
			item.status,
			item.imStatus,
			item.superStatus,
			item.debug,
			item.content,
			item.reasoning_content,
			item.tool_calls,
			// Tool row visibility is decided by attachments alone, so an attachment array that
			// arrives after the message must invalidate the cached snapshot and reproject.
			item.attachments,
		]
	}

	private isSameSignature(left: ReadonlyArray<unknown>, right: ReadonlyArray<unknown>) {
		return left.length === right.length && left.every((value, index) => value === right[index])
	}

	getSnapshot(item: Record<string, any>) {
		const signature = this.getSignature(item)
		const cached = this.entries.get(item)
		if (cached && this.isSameSignature(cached.signature, signature)) return cached.value

		const value = { ...toJS(item) } as Record<string, any>
		this.entries.delete(item)
		this.entries.set(item, { signature, value })
		while (this.entries.size > this.maxEntries) {
			const oldest = this.entries.keys().next().value
			if (!oldest) break
			this.entries.delete(oldest)
		}
		return value
	}

	private collectRelations(list: Array<any>): ProjectionRelations {
		const relations: ProjectionRelations = {
			messageIds: new Set(),
			correlationIds: new Set(),
			parentCorrelationIds: new Set(),
		}
		list.forEach((item) => {
			relations.messageIds.add(item?.app_message_id)
			if (item?.correlation_id) relations.correlationIds.add(item.correlation_id)
			if (item?.parent_correlation_id) {
				relations.parentCorrelationIds.add(item.parent_correlation_id)
			}
		})
		return relations
	}

	private canMergeIncrementally(delta: Array<any>, previous: ProjectionRelations) {
		const deltaRelations = this.collectRelations(delta)
		const hasIntersection = (left: Set<unknown>, right: Set<unknown>) => {
			for (const value of left) {
				if (right.has(value)) return true
			}
			return false
		}

		return {
			canMerge:
				!hasIntersection(deltaRelations.messageIds, previous.messageIds) &&
				!hasIntersection(deltaRelations.correlationIds, previous.correlationIds) &&
				!hasIntersection(deltaRelations.parentCorrelationIds, previous.correlationIds) &&
				!hasIntersection(deltaRelations.correlationIds, previous.parentCorrelationIds),
			deltaRelations,
		}
	}

	private mergeRelations(left: ProjectionRelations, right: ProjectionRelations) {
		return {
			messageIds: new Set([...left.messageIds, ...right.messageIds]),
			correlationIds: new Set([...left.correlationIds, ...right.correlationIds]),
			parentCorrelationIds: new Set([
				...left.parentCorrelationIds,
				...right.parentCorrelationIds,
			]),
		}
	}

	/**
	 * Reuses a complete projection for the same membership revision. For append/prepend,
	 * only the new page is converted when it cannot affect existing dedupe/child ownership.
	 */
	convert(
		list: Array<any>,
		isRevoked: boolean,
		version?: string | number,
	): Array<SuperMagicMessageItem> {
		const previous = this.state
		if (
			previous &&
			version !== undefined &&
			previous.version === version &&
			previous.sources === list
		) {
			return previous.result
		}

		if (previous && list.length >= previous.sources.length) {
			const deltaLength = list.length - previous.sources.length
			if (deltaLength > 0) {
				const isAppend = previous.sources.every((item, index) => list[index] === item)
				const isPrepend = previous.sources.every(
					(item, index) => list[index + deltaLength] === item,
				)
				if (isAppend || isPrepend) {
					const delta = isAppend ? list.slice(-deltaLength) : list.slice(0, deltaLength)
					const { canMerge, deltaRelations } = this.canMergeIncrementally(
						delta,
						previous.relations,
					)
					if (canMerge) {
						const deltaResult = convertMessages(delta, isRevoked, this)
						const result = positionAnchoredMessages(
							isAppend
								? [...previous.result, ...deltaResult]
								: [...deltaResult, ...previous.result],
						)
						this.state = {
							sources: list,
							result,
							relations: this.mergeRelations(previous.relations, deltaRelations),
							version,
						}
						return result
					}
				}
			}
		}

		const result = convertMessages(list, isRevoked, this)
		this.state = {
			sources: list,
			result,
			relations: this.collectRelations(list),
			version,
		}
		return result
	}
}

function convertMessages(
	list: Array<any>,
	isRevoked: boolean,
	projectionCache?: MessageProjectionCache,
): Array<SuperMagicMessageItem> {
	const map = new Map<string, any>()
	const correlationMap = new Map<string, string>()
	const correlationToMessageMap = new Map<string, Array<any>>()
	const askUserGroups = new Map<string, { firstIndex: number; items: Array<any> }>()

	// 反向遍历，自动保留最新的 correlation 消息
	for (let i = list.length - 1; i >= 0; i--) {
		const item = list[i]

		// 快速跳过：已撤回消息 或 before_llm_request 事件
		if (
			(isRevoked && (item.imStatus ?? item.status) === MessageStatus.REVOKED) ||
			item.event === "before_llm_request" ||
			item.event === ASK_USER_RECOVERY_FAILED_EVENT
		) {
			continue
		}

		const messageId = item.app_message_id
		const correlationId = item.correlation_id

		// 有 correlation_id 的消息去重处理
		if (correlationId) {
			// 如果已经记录过这个 correlation，跳过当前消息（保留后面的）
			if (correlationMap.has(correlationId)) {
				// 但当协议为V2时，需注意后面消息的类型是否为工具调用，如果是则只保留工具部分内容，其余全部使用前面消息的 assistant 内容
				const isV2Message = item?.type === "super_magic_message"
				const isSuperMagicMessage = item?.role === "tool"
				// 兼容分享场景下的数据结构（raw_content.type、raw_content.super_magic_message）
				const isSuperMagicShareMessage =
					item?.raw_content?.[item?.raw_content?.type]?.role === "tool"
				if (
					!isV2Message ||
					(isV2Message && (isSuperMagicMessage || isSuperMagicShareMessage))
				) {
					continue
				}
			}
			correlationMap.set(correlationId, messageId)
		}

		if (item?.parent_correlation_id) {
			const array = correlationToMessageMap.get(item?.parent_correlation_id) || []
			array.push({
				...(projectionCache ? projectionCache.getSnapshot(item) : toJS(item)),
				__sourceIndex: i,
			})
			correlationToMessageMap.set(item?.parent_correlation_id, array)
			continue
		}

		// 只在最终确定保留时才添加
		if (!map.has(messageId)) {
			map.set(messageId, {
				...(projectionCache ? projectionCache.getSnapshot(item) : toJS(item)),
				__sourceIndex: i,
			})
		}
	}

	correlationToMessageMap.forEach((array, correlationId) => {
		array.reverse()
		const messageId = correlationMap.get(correlationId)
		if (messageId) {
			const msg = map.get(messageId)
			msg.childMessages = array
			map.set(messageId, projectionCache ? msg : toJS(msg))
		}
	})

	// 反向遍历导致顺序颠倒，需要恢复原始顺序
	const items = Array.from(map.values()).reverse()
	const askUserItems = Array.from(askUserGroups.values()).map((group) => ({
		...aggregateAskUserMessages(group.items),
		__sourceIndex: group.firstIndex,
	}))

	return positionAnchoredMessages(
		[...items, ...askUserItems]
			.slice()
			.sort((prev, next) => prev.__sourceIndex - next.__sourceIndex)
			.map((item) => {
				const { __sourceIndex, ...restItem } = item
				void __sourceIndex
				return restItem
			}),
	)
}

export function messagesConverter(
	list: Array<any>,
	isRevoked: boolean = true,
	projectionCache?: MessageProjectionCache,
	version?: string | number,
): Array<SuperMagicMessageItem> {
	return projectionCache
		? projectionCache.convert(list, isRevoked, version)
		: convertMessages(list, isRevoked)
}

export function getMessageNodeKey(node: any): string {
	if (node?.askUser)
		return `ask-user-${node?.super_message_id || getAskUserCorrelationId(node) || ""}`
	if (node?.type === "tool_call") {
		return node?.tool?.correlation_id || node?.tool?.id || ""
	}
	if (isAskUserMessage(node)) {
		return node?.super_message_id || getAskUserCorrelationId(node) || ""
	}
	// Store/UI 的消息身份统一由 SuperMessage ID 承载；历史数据已在 Store 入口回退补齐。
	return node?.super_message_id || node?.app_message_id || node?.seq_id || ""
}

/**
 * 创建一个检查消息是否为最后一条的函数
 * @param messages 消息列表
 * @returns 检查函数，接收 messageId 返回是否为最后一条消息
 */
export function createCheckIsLastMessage(messages: Array<SuperMagicMessageItem>) {
	return (messageId: string) => {
		const lastMessage = messages[messages.length - 1]
		return lastMessage?.app_message_id === messageId || lastMessage?.message_id === messageId
	}
}

export function findPendingAskUserCard(
	list: Array<Record<string, unknown>>,
): AskUserCardData | undefined {
	const messages = messagesConverter(list)
	const pendingAskUserMessage = messages.find((message) => {
		return (message?.askUser as AskUserCardData | undefined)?.status === "pending"
	})

	return pendingAskUserMessage?.askUser as AskUserCardData | undefined
}
