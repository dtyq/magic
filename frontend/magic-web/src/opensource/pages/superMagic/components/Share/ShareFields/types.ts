import type { ShareType, ShareMode } from "../types"

/**
 * 分享名称 Field 组件的 props
 */
export interface ShareNameFieldProps {
	value: string // resource_name
	onChange: (value: string) => void
	placeholder?: string
	// 用于计算默认值的参数
	defaultOpenFileId?: string
	selectedFiles?: any[]
	attachments?: any[] // 用于查找文件名称
	shareProject?: boolean // 是否分享整个项目
	projectName?: string // 项目名称
}

/**
 * 分享方式 Field 组件的 props
 */
export interface ShareTypeFieldProps {
	value: ShareType
	onChange: (type: ShareType) => void
	availableTypes: ShareType[]
}

/**
 * 访问密码 Field 组件的 props
 */
export interface SharePasswordFieldProps {
	password: string
	onCopy: () => void
	onReset?: () => void // 可选：如果不提供则不显示重置按钮
	showLabel?: boolean // 可选：是否显示标签，默认 true
}

/**
 * 分享有效期 Field 组件的 props
 */
export interface ShareExpiryFieldProps {
	value: number | null // expire_days: 天数或 null (永久有效)
	onChange: (value: number | null) => void
}

/**
 * 高级选项配置数据
 */
export interface ShareAdvancedSettingsData {
	allowCopy?: boolean // 允许复制项目文件
	showFileList?: boolean // 显示文件列表（文件分享模式）
	showOriginalInfo?: boolean // 显示原创信息
	hideCreatorInfo?: boolean // 隐藏创建者信息
	view_file_list?: boolean // 可查看文件列表（话题分享模式）
	allowDownloadProjectFile?: boolean // 允许下载及导出（后端字段: allow_download_project_file）
}

/**
 * 高级选项 Field 组件的 props
 */
export interface ShareAdvancedSettingsProps {
	settings: ShareAdvancedSettingsData
	onChange: (settings: ShareAdvancedSettingsData) => void
	mode: ShareMode // file or topic
}

/**
 * 有效期选项数据结构
 */
export interface ExpiryOption {
	label: string // i18n key
	value: number | null // 天数或 null (永久有效)
}

/**
 * 有效期选项常量
 */
export const EXPIRY_OPTIONS: readonly ExpiryOption[] = [
	{ label: "share.expiryPermanent", value: null },
	{ label: "share.expiry180Days", value: 180 },
	{ label: "share.expiry90Days", value: 90 },
	{ label: "share.expiry60Days", value: 60 },
	{ label: "share.expiry30Days", value: 30 },
	{ label: "share.expiry15Days", value: 15 },
	{ label: "share.expiry7Days", value: 7 },
	{ label: "share.expiry3Days", value: 3 },
	{ label: "share.expiry1Day", value: 1 },
] as const

/**
 * 分享范围类型
 */
export type ShareRange = "all" | "designated"

/**
 * 目标类型（用户或部门）
 */
export interface ShareTarget {
	target_type: "User" | "Department"
	target_id: string
	name?: string // 用户名或部门名
	avatar_url?: string // 用户头像 URL（仅用户有）
}

/**
 * 分享范围 Field 组件的 props
 */
export interface ShareRangeFieldProps {
	value: ShareRange // 分享范围: all | designated
	onChange: (value: ShareRange) => void
	targets: ShareTarget[] // 已选择的目标成员/部门
	onTargetsChange: (targets: ShareTarget[]) => void
	resourceId?: string // 资源ID，用于获取成员信息回显
}
