import type { ModelBillingMultiplierSettings as SharedModelBillingMultiplierSettings } from "../../../model-billing-reference"

export const enum SupportLocales {
	auto = "auto",
	zhCN = "zh_CN",
	enUS = "en_US",
}

/** 组织水印中可展示的用户信息字段。 */
export type PlatformWatermarkField =
	"real_name" | "employee_no" | "visit_time" | "department" | "phone" | "email"

/** 组织水印的深浅档位。 */
export type PlatformWatermarkIntensity = "light" | "standard" | "strong"

/** 平台信息 */
export namespace PlatformInfo {
	/** 配置仅用于价格比较，最终参考金额由后端提供。 */
	export type ModelBillingMultiplierSettings = SharedModelBillingMultiplierSettings

	/** 组织水印配置 */
	export interface WatermarkConfig {
		id: string
		enabled: boolean
		fields: PlatformWatermarkField[]
		depth: PlatformWatermarkIntensity
	}

	/** 更新组织水印配置的请求体 */
	export type WatermarkUpdateParams = Omit<WatermarkConfig, "id">

	/** 页脚备案信息 */
	export interface FooterFiling {
		enabled: boolean
		number: string
		link: string
	}

	/** 页脚配置 */
	export interface Footer {
		copyright_i18n: Record<string, string>
		filing: FooterFiling
	}

	/** 平台信息详情 */
	export interface Details {
		model_billing_multiplier?: ModelBillingMultiplierSettings
		name_i18n: Record<SupportLocales, string>
		logo: Record<SupportLocales, string>
		minimal_logo: string | null
		favicon: string | null
		default_language: string
		custom_service_provider_whitelist?: string[]
		title_i18n: Record<SupportLocales, string>
		keywords_i18n: Record<SupportLocales, string>
		description_i18n: Record<SupportLocales, string>
		watermark?: WatermarkConfig
		agent_role_name_i18n?: Record<SupportLocales, string>
		agent_role_description_i18n?: Record<SupportLocales, string>
		global_system_prompt: string
		footer?: Footer
	}
	/** 修改平台信息 */
	export interface UpdateParams {
		model_billing_multiplier?: ModelBillingMultiplierSettings
		name_i18n: Record<SupportLocales, string>
		logo_zh_url: string
		logo_en_url: string
		minimal_logo_url: string
		favicon_url: string
		default_language: string
		custom_service_provider_whitelist?: string[]
		title_i18n: Record<SupportLocales, string>
		keywords_i18n: Record<SupportLocales, string>
		description_i18n: Record<SupportLocales, string>
		watermark?: WatermarkUpdateParams
		agent_role_name_i18n?: Record<SupportLocales, string>
		agent_role_description_i18n?: Record<SupportLocales, string>
		global_system_prompt?: string
		footer?: Footer
	}
}
