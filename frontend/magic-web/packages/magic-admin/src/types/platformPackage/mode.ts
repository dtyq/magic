import type { AiModel } from "@admin/const/aiModel"
import type { PageParams } from "@admin/types/common"
import type { NameI18N } from "./common"

/** 模式列表筛选参数 */
export interface ModeListParams extends Required<PageParams> {
	/** 状态 */
	status?: 1 | 0
	/** 模式名称关键词 */
	keyword?: string
	/** 模式标识 */
	identifier?: string
}

/** 模式分配方式 */
export enum DistributionType {
	/** 独立 */
	Independent = 1,
	/** 跟随 */
	Follow = 2,
}

/** 图标类型 */
export enum IconType {
	/** 图标 */
	Icon = 1,
	/** 图片 */
	Image = 2,
}

/** 模式 */
export interface Mode {
	color: string
	created_at: string
	description: string
	/** 分配方式 */
	distribution_type: DistributionType
	/** 跟随模式ID */
	follow_mode_id: string
	/** 图标类型 1:图标 2:图片 */
	icon_type: IconType
	/** 图标 */
	icon: string
	/** 图标url */
	icon_url: string
	id: string
	identifier: string
	/** 是否默认 */
	is_default: 1 | 0
	/** 名称 */
	name_i18n: NameI18N
	/** 占位文本 */
	placeholder_i18n: NameI18N
	organization_code: string
	status: boolean
	updated_at: string
	sort: number | string
	organization_whitelist: string
}

/** 添加模式 */
export type AddModeParams = Pick<
	Mode,
	| "name_i18n"
	| "description"
	| "icon"
	| "color"
	| "identifier"
	| "organization_code"
	| "icon_type"
	| "icon_url"
>

/** 模式分组 */
export interface ModeGroup {
	created_at: string
	description: string
	icon: string
	id: string
	mode_id: string
	models: string[]
	name_i18n: NameI18N
	sort: number
	status: boolean
}

/** 添加模式分组 */
export type AddModeGroupParams = Pick<ModeGroup, "icon" | "name_i18n" | "mode_id"> & {
	id?: string
}

/** 模式分组模型状态 */
export enum ModeGroupModelStatus {
	/** 正常 */
	Normal = "normal",
	/** 删除 */
	Deleted = "deleted",
	/** 禁用 */
	Disabled = "disabled",
}

/** 模式分组中的基础模型 */
export interface BaseModel {
	id: string
	/** 模式组ID */
	group_id: string
	/** 服务商模型ID */
	provider_model_id: string
	/** 模型图标 */
	model_icon: string
	/** 模型ID */
	model_id: string
	/** 模型名称 */
	model_name: string
	/** 排序 */
	sort: number
	/** 模型状态 */
	model_status: ModeGroupModelStatus
	/** 模型分类 */
	model_category: AiModel.ServiceProviderCategory
}

/** 模型类型 */
export enum ModelType {
	Dynamic = "dynamic",
}

/** 策略类型 */
export enum StrategyType {
	/** 权限降级策略 */
	PermissionFallback = "permission_fallback",
}

/** 子模型调用顺序方向 */
export enum OrderDirection {
	Asc = "asc",
	Desc = "desc",
}

/** 动态模型 */
export interface DynamicModel extends Omit<BaseModel, "model_status"> {
	/** 模型描述 */
	model_description?: string
	/** 模型类型, dynamic: 动态模型 */
	model_type: ModelType.Dynamic
	/** 聚合配置 */
	aggregate_config: {
		/** 子模型列表 */
		models: BaseModel[]
		/** 策略类型, 默认 permission_fallback 权限降级策略 */
		strategy?: StrategyType
		/** 策略配置 */
		strategy_config?: {
			/** 子模型调用顺序方向 */
			order?: OrderDirection
		}
	}
	/** 模型多语言 */
	model_translate: {
		name?: NameI18N
		description?: NameI18N
	}
}

export type ModelItem = BaseModel | DynamicModel

/** 模式详情 */
export interface ModeDetail {
	mode: Mode
	groups: {
		group: ModeGroup
		models: ModelItem[]
	}[]
}

/** 获取所有模型列表 */
/** 获取所有模型列表 */
export interface GetAllModelListParams {
	/** 服务商分类 */
	category?: AiModel.ServiceProviderCategory
	/** 是否过滤多个模型ID,为true只会返回不重复的模型ID */
	is_model_id_filter?: boolean
	/** 状态可用, 0: 不可用, 1: 可用 */
	status?: 0 | 1
}
