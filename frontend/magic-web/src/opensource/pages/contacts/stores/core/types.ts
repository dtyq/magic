import type { Friend } from "@/opensource/types/contact"
import type { GroupConversationDetail } from "@/opensource/types/chat/conversation"

/**
 * 部门路径节点
 */
export interface PathNode {
	/** 部门ID */
	id: string
	/** 部门名称 */
	name: string
	/** 部门完整路径 */
	departmentPath: string
	/** 路径节点数组 */
	pathNodes: Array<{ id: string; name: string }>
	/** 部门路径显示名称 */
	departmentPathName: string
}

/**
 * 分页响应接口
 */
export interface PaginationData<T> {
	items: T[]
	hasMore: boolean
	pageToken?: string
}

/**
 * MyGroups Store 导出类型
 */
export type MyGroupsData = PaginationData<GroupConversationDetail>

/**
 * AiAssistant Store 导出类型
 */
export type AiAssistantData = PaginationData<Friend>
