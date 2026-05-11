import { makeAutoObservable } from "mobx"
import type { SuggestionsMeta } from "./suggestion-types"

/**
 * 话题建议提问缓存条目（按 topic 归档，用于话题粒度的失效/清理）
 */
interface TopicSuggestionArchiveEntry {
	/** 任务 id */
	taskId: string
	/** 建议提问元数据 */
	suggestionsMeta: SuggestionsMeta
}

/**
 * Suggestion Store
 *
 * 独立承载"建议提问"相关的所有客户端状态，与核心消息流（SuperMagicStore）解耦：
 * - 渲染数据源：`suggestionByMessage`，按 `messageId` 粒度缓存，单条 assistant
 *   消息对应一份建议元数据。
 * - 话题归档：`topicSuggestionArchive`，按 `topicId` 聚合最近一次 taskId 对应的
 *   建议，主要用于按话题维度的失效/反查（保持历史行为）。
 * - 点击状态：`topicClickedCache`，按 `topicId + taskId` 记录已点击索引集合，
 *   避免重复点击的交互去重。
 */
export class SuggestionStore {
	/** 建议提问数据源（< messageId, SuggestionsMeta >） */
	suggestionByMessage: Map<string, SuggestionsMeta> = new Map()
	/** 话题建议归档（< topicId, { taskId, suggestionsMeta } >） */
	topicSuggestionArchive: Map<string, TopicSuggestionArchiveEntry> = new Map()

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * 获取指定消息的建议提问数据（消息维度唯一数据源）
	 */
	getByMessage(messageId: string) {
		if (!messageId) return undefined
		return this.suggestionByMessage.get(messageId)
	}

	/**
	 * 获取指定话题下指定任务的建议提问归档
	 * @deprecated 推荐使用 {@link getByMessage}；仅用于按 topic 维度反查
	 */
	getByTopicTask(topicId: string, taskId: string) {
		const entry = this.topicSuggestionArchive.get(topicId)
		if (!entry) return undefined
		if (entry.taskId !== taskId) return undefined
		return entry.suggestionsMeta
	}

	/**
	 * 写入建议提问数据。`messageId` 是主数据源，`topicId`+`taskId` 构成话题归档。
	 */
	set(topicId: string, taskId: string, messageId: string, suggestion: SuggestionsMeta) {
		if (messageId) this.suggestionByMessage.set(messageId, suggestion)
		if (topicId) {
			this.topicSuggestionArchive.set(topicId, {
				taskId,
				suggestionsMeta: suggestion,
			})
		}
	}
}

export const suggestionStore = new SuggestionStore()
