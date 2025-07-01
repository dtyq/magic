import { AppEnv } from "@/types/env"
import { configStore } from "@/opensource/models/config"

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
) => {
	const { clusterConfig } = configStore.cluster

	if (deployCode && clusterConfig?.[deployCode]?.services && !isCurrentEnv) {
		return {
			...import.meta.env,
			...(window?.CONFIG ?? {}),
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
		}[key]
	}

	return {
		...import.meta.env,
		...(window?.CONFIG ?? {}),
	}[key]
}

/**
 * @description 是否生产环境
 * @returns {boolean} 是否生产环境
 */
export const isProductionEnv = (): boolean => env("MAGIC_APP_ENV") === AppEnv.Production

/** 商业化版本 */
export const isCommercial = () => env("MAGIC_EDITION") === "ENTERPRISE"
