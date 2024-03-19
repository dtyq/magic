/**
 * 文件内容对比组件类型定义
 */

import { ChangeRecommendation } from "./utils/diff"

export const enum ConflictResolution {
	CURRENT = "current",
	SERVER = "server",
	CUSTOM = "custom",
}

export type ConflictResolutionWithoutCustom = Exclude<ConflictResolution, "custom">

/** 选择的内容类型 */
export type SelectedContentType = "current" | "server" | "merge"

/** AI 解决方案请求类型 */
export interface AIResolutionRequest {
	/** 冲突列表 */
	conflicts: Array<{
		id: string
		currentLines: string[]
		serverLines: string[]
	}>
	/** 变更列表 */
	changes: Array<{
		id: string
		type: "addition" | "deletion"
		lines: string[]
	}>
	/** 上下文信息 */
	context?: {
		fileType?: string
		language?: string
	}
}

/** AI 解决方案响应类型 */
export interface AIResolutionResponse {
	/** 冲突解决方案列表 */
	conflictResolutions: Array<{
		id: string
		resolution: ConflictResolution
		customContent?: string
		reason?: string
	}>
	/** 变更解决方案列表 */
	changeResolutions: Array<{
		id: string
		resolution: ChangeRecommendation
		reason?: string
	}>
}

/** 组件属性 */
export interface FileContentCompareProps {
	/** 当前内容 */
	currentContent: string
	/** 服务器内容 */
	serverContent: string
	/** 当前选中的类型 */
	selectedType: SelectedContentType | null
	/** 当前内容标签 */
	currentLabel?: string
	/** 服务器内容标签 */
	serverLabel?: string
	/** 合并预览标签 */
	mergeLabel?: string
	/** 合并内容变化回调（预览用） */
	onMergeChange?: (mergedContent: string) => void
	/** 已解决的合并内容变化回调（实际使用） */
	onResolvedMergeChange?: (resolvedContent: string) => void
	/** 是否显示合并预览 */
	showMergePreview?: boolean
	/** 选择变化回调 */
	onSelectionChange?: (selectedType: SelectedContentType) => void
	/** 是否显示底部操作区 */
	showFooter?: boolean
	/** 使用当前内容回调 */
	onUseCurrent?: () => void
	/** 使用服务器内容回调 */
	onUseServer?: () => void
	/** 使用合并内容回调 */
	onUseMerge?: (content: string) => void
	/** 加载状态 */
	loading?: boolean
}
