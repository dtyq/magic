import type { Lang } from "components"
import { PlatformPackage } from "@/types/platformPackage"

export type SubscriptGroupLangConfig = Record<
	PlatformPackage.SubscriptionType,
	{
		name_i18n: Lang
		description_i18n: Lang
	}
>

export type LangConfig = {
	name_i18n: Lang
	description_i18n: Lang
	subtitle_i18n: Lang
}

// 处理每个限制字段
export const LimitFields = [
	"workspace_limit",
	"topic_limit",
	"topic_share_limit",
	"website_generation_limit",
	"concurrent_task_limit",
	"high_priority_execution_times",
	"single_round_consumption_limit",
	"total_task_consumption_limit",
	"superMagic_project_copy_limit",
]

/* 不同的订阅套餐配置 */
export const SubscriptConfig = [
	"id",
	"price",
	"original_price",
	"currency",
	"payment",
	"enable",
	"point_settings",
	"is_stock_managed",
	"stock",
	"category",
	"name_i18n",
	"description_i18n",
	"is_recharge_points",
	"subscription_tier",
	"platform_products",
]

export const defaultLang = {
	zh_CN: "",
	en_US: "",
}

/* 默认订阅设置多语言 */
export const defaultSubscriptLangConfig = {
	[PlatformPackage.SubscriptionType.Monthly]: {
		name_i18n: defaultLang,
		description_i18n: defaultLang,
	},
	[PlatformPackage.SubscriptionType.Yearly]: {
		name_i18n: defaultLang,
		description_i18n: defaultLang,
	},
	[PlatformPackage.SubscriptionType.Permanent]: {
		name_i18n: defaultLang,
		description_i18n: defaultLang,
	},
}

/* 默认套餐信息多语言 */
export const defaultLangConfig = {
	name_i18n: defaultLang,
	description_i18n: defaultLang,
	subtitle_i18n: defaultLang,
}
