import type { AiManage } from "@/types/aiManage"

export const defaultLang = {
	zh_CN: "",
	en_US: "",
}
export const LangConfig = {
	name: defaultLang,
	description: defaultLang,
}

// 计价字段配置
const PRICING_FIELDS = [
	"input_pricing",
	"output_pricing",
	"cache_write_pricing",
	"cache_hit_pricing",
	"input_cost",
	"output_cost",
	"cache_write_cost",
	"cache_hit_cost",
] as const

type Config = AiManage.ModelInfo["config"]

// 计价字段工具函数
export const pricingUtils = {
	// 根据现有数据判断计价开关状态
	buildEnabledStates: (config: Config) => {
		return PRICING_FIELDS.reduce((acc, field) => {
			acc[`${field}_enabled`] = config[field] !== null && config[field] !== undefined
			return acc
		}, {} as Record<string, boolean>)
	},

	// 处理计价字段，根据开关状态设置 null 或数值
	processFields: (config: any) => {
		return PRICING_FIELDS.reduce((acc, field) => {
			const enabledField = `${field}_enabled` as const
			acc[field] = config[enabledField] ? config[field] : null
			return acc
		}, {} as Record<string, any>)
	},

	// 移除开关字段
	removeEnabledFields: () => {
		return PRICING_FIELDS.reduce((acc, field) => {
			acc[`${field}_enabled`] = undefined
			return acc
		}, {} as Record<string, undefined>)
	},
}
