import { ShareType, ResourceType } from "../../Share/types"
import type { FileShareItem, ProjectShareItem, TopicShareItem } from "../types"
import type { ShareItem } from "../hooks/useShareItemActions"
import publicIcon from "../../Share/svg/public.svg"
import protectedIcon from "../../Share/svg/protected.svg"
import teamIcon from "../../Share/svg/team.svg"

interface ShareTypeIconSize {
	public?: number
	protected?: number
	team?: number
}

/**
 * 获取分享类型图标
 * @param shareType 分享类型
 * @param size 图标大小配置，默认为 { public: 16, protected: 16, team: 16 }
 */
export function getShareTypeIcon(shareType: ShareType, size?: ShareTypeIconSize) {
	const defaultSize = { public: 16, protected: 16, team: 16 }
	const iconSize = { ...defaultSize, ...size }

	switch (shareType) {
		case ShareType.Public:
			return (
				<img
					src={publicIcon}
					alt=""
					style={{ width: iconSize.public, height: iconSize.public }}
				/>
			)
		case ShareType.PasswordProtected:
			return (
				<img
					src={protectedIcon}
					alt=""
					style={{ width: iconSize.protected, height: iconSize.protected }}
				/>
			)
		case ShareType.Organization:
			return (
				<img
					src={teamIcon}
					alt=""
					style={{ width: iconSize.team, height: iconSize.team }}
				/>
			)
		default:
			return null
	}
}

/**
 * 获取分享类型图标样式类名
 * @param shareType 分享类型
 * @param styles 样式对象
 */
export function getShareTypeIconClassName(
	shareType: ShareType,
	styles: {
		shareTypeIconPublic?: string
		shareTypeIconProtected?: string
		shareTypeIconTeam?: string
		// 兼容旧的样式类名
		shareTypeIconOrganization?: string
	},
) {
	switch (shareType) {
		case ShareType.Public:
			return styles.shareTypeIconPublic || ""
		case ShareType.PasswordProtected:
			return styles.shareTypeIconProtected || ""
		case ShareType.Organization:
			return styles.shareTypeIconTeam || ""
		default:
			return ""
	}
}

/**
 * 获取分享类型Badge的样式类名
 * @param shareType 分享类型
 * @returns 包含背景色和文字颜色的样式类名对象
 */
export function getShareTypeBadgeStyles(shareType: ShareType): {
	bgClassName: string
	textClassName: string
} {
	switch (shareType) {
		case ShareType.Public:
			return {
				bgClassName: "bg-sky-50",
				textClassName: "text-sky-400",
			}
		case ShareType.PasswordProtected:
			return {
				bgClassName: "bg-orange-50",
				textClassName: "text-orange-400",
			}
		case ShareType.Organization:
			return {
				bgClassName: "bg-indigo-50",
				textClassName: "text-indigo-400",
			}
		default:
			return {
				bgClassName: "bg-neutral-100",
				textClassName: "text-neutral-600",
			}
	}
}

/**
 * 获取分享类型的文本
 * @param shareType 分享类型
 * @param t 翻译函数
 * @returns 分享类型的文本
 */
export function getShareTypeText(shareType: ShareType, t: (key: string) => string): string {
	switch (shareType) {
		case ShareType.Public:
			return t("share.publicAccess")
		case ShareType.PasswordProtected:
			return t("share.passwordProtected")
		case ShareType.Organization:
			return t("share.teamShare")
		default:
			return ""
	}
}

/**
 * 生成分享链接
 * @param resourceId 分享资源ID
 * @param password 分享密码（可选）
 * @param shareType 分享类型，默认为 'files'，可选 'topic'
 * @returns 完整的分享链接
 */
export function generateShareUrl(
	resourceId: string,
	password?: string,
	shareType: "files" | "topic" = "files",
): string {
	const baseUrl = `${window.location.origin}/share/${shareType}/${resourceId}`
	if (password) {
		return `${baseUrl}?password=${password}`
	}
	return baseUrl
}

/**
 * 计算剩余天数（基于 expire_at）
 * @param expireAt 过期时间，格式：xxxx/xx/xx 或 xxxx/xx/xx xx:xx:xx
 * @returns 剩余天数（向上取整），如果已过期或解析失败则返回 null
 */
export function getRemainingDays(expireAt?: string): number | null {
	if (!expireAt) return null
	try {
		// expire_at 格式：xxxx/xx/xx 或 xxxx/xx/xx xx:xx:xx，转换为 Date 对象
		const expireDate = new Date(expireAt.replace(/\//g, "-"))
		const now = new Date()
		const diffTime = expireDate.getTime() - now.getTime()
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
		// 小于0时返回0
		return diffDays < 0 ? 0 : diffDays
	} catch {
		return null
	}
}

/**
 * 格式化过期时间，将 xxxx/xx/xx xx:xx:xx 截断为 xxxx/xx/xx xx:xx
 * @param expireAt 过期时间，格式：xxxx/xx/xx 或 xxxx/xx/xx xx:xx:xx
 * @returns 格式化后的时间字符串，如果输入为空则返回原值
 */
export function formatExpireAt(expireAt?: string): string {
	if (!expireAt) return expireAt || ""
	// 如果包含时间部分（有空格），则截断秒数
	if (expireAt.includes(" ")) {
		// 匹配格式：xxxx/xx/xx xx:xx:xx，截断为 xxxx/xx/xx xx:xx
		return expireAt.replace(/:(\d{2})$/, "")
	}
	// 如果没有时间部分，直接返回
	return expireAt
}

/**
 * 将 FileShareItem 转换为 ShareItem 格式
 * @param item FileShareItem
 * @param getUntitledText 获取 "未命名" 文本的函数
 * @returns ShareItem
 */
export function convertFileShareItemToShareItem(
	item: FileShareItem,
	getUntitledText: () => string,
): ShareItem {
	return {
		resource_id: item.resource_id,
		resource_name: item.title || getUntitledText(),
		share_url: generateShareUrl(item.resource_id, item.password, "files"),
		password: item.password,
		expire_at: item.expire_at,
		share_type: item.share_type,
		main_file_name: item.main_file_name,
		file_ids: item.file_ids, // 添加 file_ids 字段，用于查找 metadata
		extend: {
			file_count: item.extend?.file_count || 1,
		},
		share_project: item.share_project || false,
		project_name: item.project_name,
	}
}

/**
 * 将 ProjectShareItem 转换为 ShareItem 格式
 * @param item ProjectShareItem
 * @param getUntitledText 获取 "未命名" 文本的函数
 * @returns ShareItem
 */
export function convertProjectShareItemToShareItem(
	item: ProjectShareItem,
	getUntitledText: () => string,
): ShareItem {
	return {
		resource_id: item.resource_id,
		resource_name: item.title || getUntitledText(),
		share_url: generateShareUrl(item.resource_id, item.password, "files"),
		password: item.password,
		expire_at: item.expire_at,
		share_type: item.share_type,
		main_file_name: item.main_file_name,
		extend: {
			file_count: item.extend?.file_count || 1,
		},
		share_project: true,
		project_name: item.project_name,
	}
}

/**
 * 将 TopicShareItem 转换为 ShareItem 格式
 * @param item TopicShareItem
 * @param getUntitledText 获取 "未命名" 文本的函数
 * @returns ShareItem
 */
export function convertTopicShareItemToShareItem(
	item: TopicShareItem,
	getUntitledText: () => string,
): ShareItem {
	return {
		resource_id: item.resource_id,
		resource_name: item.title || getUntitledText(),
		share_url: generateShareUrl(item.resource_id, item.password, "topic"),
		password: item.password,
		expire_at: item.expire_at,
		share_type: item.share_type,
		main_file_name: item.title || getUntitledText(),
		share_project: false,
		project_name: item.project_name,
	}
}

/**
 * 通用的转换函数，根据资源类型自动选择转换方法
 * @param item 任意类型的分享项
 * @param getUntitledText 获取 "未命名" 文本的函数
 * @returns ShareItem
 */
export function convertToShareItem(
	item: FileShareItem | ProjectShareItem | TopicShareItem,
	getUntitledText: () => string,
): ShareItem {
	if (item.resource_type === ResourceType.Topic) {
		return convertTopicShareItemToShareItem(item as TopicShareItem, getUntitledText)
	}

	if (item.resource_type === ResourceType.Project) {
		return convertProjectShareItemToShareItem(item as ProjectShareItem, getUntitledText)
	}

	// FileShareItem or SingleFile
	return convertFileShareItemToShareItem(item as FileShareItem, getUntitledText)
}
