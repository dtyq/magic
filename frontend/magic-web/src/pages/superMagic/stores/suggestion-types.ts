/**
 * 建议提问（follow-up suggestions）相关的数据契约
 *
 * 独立出来避免 stores / apis / components 之间的反向依赖：
 * - components 依赖该文件
 * - apis 依赖该文件
 * - stores 依赖该文件
 * 三方均单向依赖该类型文件，不再出现 store → component 的反向 import
 */

/** 建议提问生成状态 */
export const SUGGESTION_STATUS = {
	/** 未生成（轮询中） */
	PENDING: 0,
	/** 已生成 */
	READY: 1,
	/** 生成失败 */
	FAILED: 2,
} as const

export type SuggestionStatus =
	| (typeof SUGGESTION_STATUS)[keyof typeof SUGGESTION_STATUS]
	/** null: 旧数据兼容，视为 READY 处理 */
	| null

/** 建议提问关系类型（后端 type 字段） */
export const SUGGESTION_RELATION_TYPE = {
	/** 按任务生成推荐提问 */
	TASK: 1,
} as const

export type SuggestionRelationType =
	(typeof SUGGESTION_RELATION_TYPE)[keyof typeof SUGGESTION_RELATION_TYPE]

/** 建议提问元数据（后端返回结构） */
export interface SuggestionsMeta {
	/** 生成状态 */
	status: SuggestionStatus
	/** 提示信息列表 */
	suggestions: string[]
}

/** `READY` 态的判定：包含旧数据（status == null）做兼容 */
export function isSuggestionReady(status: SuggestionStatus): boolean {
	return status === SUGGESTION_STATUS.READY || status == null
}
