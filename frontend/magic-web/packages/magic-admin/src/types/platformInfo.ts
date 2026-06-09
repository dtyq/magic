export const enum SupportLocales {
	auto = "auto",
	zhCN = "zh_CN",
	enUS = "en_US",
}

/** 平台信息 */
export namespace PlatformInfo {
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
		name_i18n: Record<SupportLocales, string>
		logo: Record<SupportLocales, string>
		minimal_logo: string | null
		favicon: string | null
		default_language: string
		custom_service_provider_whitelist?: string[]
		title_i18n: Record<SupportLocales, string>
		keywords_i18n: Record<SupportLocales, string>
		description_i18n: Record<SupportLocales, string>
		agent_role_name_i18n?: Record<SupportLocales, string>
		agent_role_description_i18n?: Record<SupportLocales, string>
		footer?: Footer
	}
	/** 修改平台信息 */
	export interface UpdateParams {
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
		agent_role_name_i18n?: Record<SupportLocales, string>
		agent_role_description_i18n?: Record<SupportLocales, string>
		footer?: Footer
	}
}
