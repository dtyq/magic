import { env } from "@/utils/env"

export const DEFAULT_LOCALE = env("MAGIC_DEFAULT_LANGUAGE") || "en_US"

export const enum SupportLocales {
	/** Fallback when no specific locale is matched; maps to "default" key in i18n objects */
	fallback = "default",
	zhCN = "zh_CN",
	enUS = "en_US",
}

export const SUPPORT_LOCALES = [SupportLocales.enUS, SupportLocales.zhCN]
