import type { PageParams } from "./common"

export namespace AppMenu {
	/** 图标类型：1-图标标识，2-图片 URL */
	export const IconTypeMap = {
		icon: 1,
		image: 2,
	} as const
	export type IconType = (typeof IconTypeMap)[keyof typeof IconTypeMap]

	/** 打开方式：1-当前窗口，2-新窗口 */
	export const OpenMethodMap = {
		self: 1,
		blank: 2,
	} as const
	export type OpenMethod = (typeof OpenMethodMap)[keyof typeof OpenMethodMap]

	/** 可见范围：0-仅企业/团队，1-仅个人，2-所有可见 */
	export const DisplayScopeMap = {
		org: 0,
		personal: 1,
		all: 2,
	} as const
	export type DisplayScope = (typeof DisplayScopeMap)[keyof typeof DisplayScopeMap]

	/** 状态：1-正常/开启，2-禁用 */
	export const StatusMap = {
		enabled: 1,
		disabled: 2,
	} as const
	export type Status = (typeof StatusMap)[keyof typeof StatusMap]

	/** 应用菜单条目 */
	export interface MenuItem {
		id: string
		name_i18n?: Record<string, string>
		icon?: string
		icon_url?: string
		icon_type: IconType
		path: string
		open_method: OpenMethod
		sort_order: number
		display_scope: DisplayScope
		status: Status
		creator_id?: string
		creator_name?: string
	}

	/** 查询列表参数 */
	export interface GetListParams extends PageParams {
		name?: string
		display_scope?: DisplayScope | null
	}

	/** 保存（新增/编辑）参数 */
	export interface SaveParams {
		id?: string
		name_i18n?: Record<string, string>
		icon?: string
		icon_url?: string
		icon_type: IconType
		path: string
		open_method: OpenMethod
		sort_order?: number
		display_scope: DisplayScope
		/** 不传时后端默认 1（正常） */
		status?: Status
	}

	/** 更新状态参数 */
	export interface UpdateStatusParams {
		id: string
		status: Status
	}

	/** 删除参数 */
	export interface DeleteParams {
		id: string
	}
}
