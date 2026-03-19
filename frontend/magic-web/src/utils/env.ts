import { AppEnv } from "@/types/env"
import { clusterStore } from "@/models/config/stores/cluster.store"
import type { Common } from "@/types/common"

/** 是否开发环境 */
export const isDev = process.env.NODE_ENV === "development"

console.log("magic sha: ", window?.CONFIG?.MAGIC_APP_SHA)
console.log("magic version: ", window?.CONFIG?.MAGIC_APP_VERSION)

/**
 * @description 获取环境变量 (因多环境问题，需要基于全局 PrivateDeployment 配置转为当前环境配置)
 * @param {keyof ImportMetaEnv} key
 * @param {boolean} isCurrentEnv 是否返回当前部署环境的环境变量而非账号环境
 * @param {string} deployCode 自定义私有化部署专属码
 */
export const env = (
	key: keyof ImportMetaEnv,
	isCurrentEnv?: boolean,
	deployCode?: string | null,
): string => {
	const { clusterConfig } = clusterStore

	const defaultCDN =
		import.meta.env?.MAGIC_CDNHOST || window?.CONFIG?.MAGIC_CDNHOST || "/packages"

	if (deployCode && clusterConfig?.[deployCode]?.services && !isCurrentEnv) {
		const dingTalkConfig = clusterConfig?.[deployCode]?.magic_app?.keyconfig?.find(
			(item) => item.type === "dingtalk",
		)

		return (
			{
				...import.meta.env,
				...(window?.CONFIG ?? {}),
				MAGIC_CDNHOST: defaultCDN,
				MAGIC_SERVICE_KEEWOOD_BASE_URL:
					clusterConfig?.[deployCode]?.services?.keewoodAPI?.url ||
					window?.CONFIG?.MAGIC_SERVICE_KEEWOOD_BASE_URL,
				MAGIC_SERVICE_TEAMSHARE_BASE_URL:
					clusterConfig?.[deployCode]?.services?.teamshareAPI?.url ||
					window?.CONFIG?.MAGIC_SERVICE_TEAMSHARE_BASE_URL,
				MAGIC_TEAMSHARE_WEB_URL:
					clusterConfig?.[deployCode]?.services?.teamshareWeb?.url ||
					window?.CONFIG?.MAGIC_TEAMSHARE_WEB_URL,
				MAGIC_KEEWOOD_WEB_URL:
					clusterConfig?.[deployCode]?.services?.keewoodWeb?.url ||
					window?.CONFIG?.MAGIC_KEEWOOD_WEB_URL,
				MAGIC_DINGTALK_APP_KEY: dingTalkConfig?.appkey || "",
				MAGIC_DINGTALK_REDIRECT_URI: dingTalkConfig?.callback || "",
			} as ImportMetaEnv
		)[key]
	}

	return (
		{
			...import.meta.env,
			...(window?.CONFIG ?? {}),
			MAGIC_CDNHOST: defaultCDN,
		} as ImportMetaEnv
	)[key]
}

/**
 * @description 是否私有化部署
 * @returns {boolean} 是否私有化部署
 */
export const isPrivateDeployment = (): boolean => env("MAGIC_IS_PRIVATE_DEPLOY") === "true"

/**
 * @description 是否国际环境
 * @returns {boolean} 是否国际环境
 */
export const isInternationalEnv = (): boolean =>
	[AppEnv.InternationalProduction, AppEnv.InternationalPre].includes(
		env("MAGIC_APP_ENV") as AppEnv,
	)

/**
 * @description 是否生产环境（包括国内和国际）
 * @returns {boolean} 是否生产环境
 */
export const isProductionEnv = (): boolean =>
	[AppEnv.Production, AppEnv.InternationalProduction].includes(env("MAGIC_APP_ENV") as AppEnv)

/**
 * @description 是否测试环境
 * @returns {boolean} 是否测试环境
 */
export const isTestEnv = (): boolean => env("MAGIC_APP_ENV") === AppEnv.Test

/** 商业化版本 */
export const isCommercial = () => env("MAGIC_EDITION") === "ENTERPRISE"

/**
 * @description 私有化部署配置
 * @returns {boolean} 是否私有化部署
 */
export const getPrivateDeploymentConfig = (): Common.PrivateDeploymentConfig | null => {
	try {
		const config = env("MAGIC_PRIVATE_DEPLOYMENT_CONFIG")
		return typeof config === "string" ? JSON.parse(config) : null
	} catch (error) {
		return null
	}
}
