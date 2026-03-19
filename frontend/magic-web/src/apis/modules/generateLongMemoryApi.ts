import type { LongMemory } from "@/types/longMemory"
import { genRequestUrl } from "@/utils/http"

import type { HttpClient } from "../core/HttpClient"

export const generateLongMemoryApi = (fetch: HttpClient) => ({
	/** 验证一段话是否需要被记忆 */
	evaluateMemory() {
		return fetch.post(genRequestUrl("/api/v1/memories/evaluate"))
	},
	/** 获取记忆列表 */
	getMemories(data: {
		status: LongMemory.MemoryStatus[]
		page_token?: string
		page_size?: number
	}) {
		return fetch.post<LongMemory.GetMemoriesListResponse>("/api/v1/memories/queries", data)
	},
	/**
	 * 创建记忆
	 * @param data 创建记忆的参数，content 为记忆内容，project_id 为记忆所属项目id，不传则创建全局记忆
	 * @returns 创建记忆的结果
	 */
	createMemory(data: { content: string; project_id?: string }) {
		return fetch.post(genRequestUrl("/api/v1/memory"), data)
	},
	/** 获取记忆详情 */
	getMemoryDetails(memoryId: string) {
		return fetch.get<{
			success: boolean
			data: LongMemory.Memory
		}>(
			genRequestUrl("/api/v1/memory/${memoryId}", {
				memoryId,
			}),
		)
	},
	/** 更新记忆 */
	setMemory(memoryId: string, data: { content?: string; pending_content?: string }) {
		return fetch.put<{
			success: boolean
			message: string
		}>(
			genRequestUrl("/api/v1/memory/${memoryId}", {
				memoryId,
			}),
			{
				...data,
			},
		)
	},
	/** 删除记忆 */
	deleteMemory(memoryId: string) {
		return fetch.delete(
			genRequestUrl("/api/v1/memory/${memoryId}", {
				memoryId,
			}),
		)
	},
	/** 批量接受/拒绝记忆 */
	batchAcceptMemories(memoryIds: string[], action: "accept" | "reject") {
		return fetch.put<{
			success: boolean
			action: "accept" | "reject"
			message: string
			processed_count: number
		}>("/api/v1/memories/status", { memory_ids: memoryIds, action })
	},
	/** 批量启用/禁用记忆 */
	batchEnableMemories(memoryIds: string[], enabled: boolean) {
		return fetch.put<{
			success: boolean
			data: {
				requested_count: number
				updated_count: number
			}
		}>("/api/v1/memories/enabled", { memory_ids: memoryIds, enabled })
	},
	/** 搜索记忆 */
	searchMemory() {
		return fetch.get(genRequestUrl("/api/v1/memories/search"))
	},
	/** 强化记忆 */
	reinforceMemory(memoryId: string) {
		return fetch.get(
			genRequestUrl("/api/v1/memories/${memoryId}/reinforce", {
				memoryId,
			}),
		)
	},
	/** 批量强化记忆 */
	reinforceMemories() {
		return fetch.get(genRequestUrl("/api/v1/memories/reinforce"))
	},
	/** 维护记忆 */
	maintainMemory() {
		return fetch.get(genRequestUrl("/api/v1/memories/maintain"))
	},
	/** 获取记忆统计信息 */
	getMemoryStats() {
		return fetch.get(genRequestUrl("/api/v1/memories/stats"))
	},
	/** 获取系统提示词 */
	getMemoryPrompt() {
		return fetch.get(genRequestUrl("/api/v1/memories/prompt"))
	},
})
