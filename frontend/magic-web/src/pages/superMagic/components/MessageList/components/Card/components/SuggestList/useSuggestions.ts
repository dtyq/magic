import { useEffect } from "react"
import { SuperMagicApi } from "@/apis"
import { suggestionStore } from "@/pages/superMagic/stores"
import {
	SUGGESTION_RELATION_TYPE,
	SUGGESTION_STATUS,
	type SuggestionsMeta,
} from "@/pages/superMagic/stores/suggestion-types"
import { SUGGESTION_MAX_RETRY_COUNT, SUGGESTION_RETRY_DELAY_MS } from "./constants"

interface UseSuggestionsParams {
	/** 消息 id（app_message_id），作为缓存粒度的唯一键 */
	messageId: string
	/** 任务 id，用作后端请求的 relation_id */
	taskId: string
	/** 话题 id */
	topicId?: string
}

interface UseSuggestionsResult {
	/** 建议提问元数据；undefined 表示尚未请求或请求被中止 */
	meta: SuggestionsMeta | undefined
}

/**
 * 按消息拉取建议提问。
 *
 * 设计取舍：
 * - 缓存粒度：每条 assistant 消息（`messageId`）一份。同一 task 内多轮对话各自
 *   独立请求建议，避免首轮结果把后续锁死。
 * - 数据源唯一：渲染只读 `suggestionStore.getByMessage(messageId)`，消费方需用
 *   `observer` 包裹以订阅 store 变化。
 * - 副作用职责：hook 仅负责请求 + 写入 store，不维护本地展示 state。
 * - 取消策略：不向底层请求传 `signal`，以免在 React 严格模式双调用或组件卸载时
 *   触发 `AbortError` 被全局 `HttpClient` catch 打成 `Request failed` 噪音；
 *   改用 `cancelled` 标志丢弃结果即可，请求本身短且 store 自带缓存去重。
 */
export function useSuggestions({
	messageId,
	taskId,
	topicId,
}: UseSuggestionsParams): UseSuggestionsResult {
	const renderMeta = suggestionStore.getByMessage(messageId)

	useEffect(() => {
		if (!messageId || !taskId) return
		if (suggestionStore.getByMessage(messageId)) return

		let cancelled = false
		let retryTimerId: ReturnType<typeof setTimeout> | undefined

		const fetchWithRetry = async () => {
			const requestData = {
				type: SUGGESTION_RELATION_TYPE.TASK,
				relation_id: taskId,
			}

			for (let retryCount = 0; retryCount <= SUGGESTION_MAX_RETRY_COUNT; retryCount += 1) {
				let res: SuggestionsMeta
				try {
					res = await SuperMagicApi.getTopicSuggestions(requestData)
				} catch (error) {
					if (cancelled) return
					console.error("[useSuggestions] fetch failed", error)
					return
				}

				if (cancelled) return

				if (res.status === SUGGESTION_STATUS.PENDING) {
					if (retryCount >= SUGGESTION_MAX_RETRY_COUNT) return
					await new Promise<void>((resolve) => {
						retryTimerId = setTimeout(resolve, SUGGESTION_RETRY_DELAY_MS)
					})
					if (cancelled) return
					continue
				}

				suggestionStore.set(topicId ?? "", taskId, messageId, res)
				return
			}
		}

		void fetchWithRetry()

		return () => {
			cancelled = true
			if (retryTimerId !== undefined) clearTimeout(retryTimerId)
		}
	}, [messageId, taskId, topicId])

	return { meta: renderMeta }
}
