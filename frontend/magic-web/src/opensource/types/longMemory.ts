/** 长期记忆模块 */
export namespace LongMemory {
	export interface Memory {
		id: string
		content: string
		origin_text: string
		pending_content: string
		memory_type: MemoryType
		status: MemoryStatus
		enabled: boolean
		status_description: string
		project_id: string | null
		project_name: string | null
		confidence: number
		importance: number
		access_count: number
		reinforcement_count: number
		tags: string[]
		last_accessed_at: string
		created_at: string
		effective_score: number
	}

	export enum MemoryStatus {
		ACTIVE = "active",
		Pending = "pending",
		PENDING_REVISION = "pending_revision",
	}

	export enum MemoryType {
		ManualInput = "manual_input",
	}

	export interface GetMemoriesListParams {
		status: LongMemory.MemoryStatus[]
		page_token?: string
		page_size?: number
	}

	export interface GetMemoriesListResponse {
		success: boolean
		data: Memory[]
		total: number
		has_more: boolean
		next_page_token: string
	}
}
