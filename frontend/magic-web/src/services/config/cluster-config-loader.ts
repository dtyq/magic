import { configStore } from "@/models/config"
import { service } from "@/services"
import type { LoginService } from "@/services/user/LoginService"
import type { Common } from "@/types/common"

const clusterConfigLoadingCache = new Map<string, Promise<Common.PrivateConfig>>()

export function getClusterConfigFromStore(clusterCode?: string) {
	if (clusterCode == null) return null

	return configStore.cluster.clusterConfig?.[clusterCode] || null
}

export function hasClusterConfigReady(clusterCode?: string) {
	return Boolean(getClusterConfigFromStore(clusterCode)?.services?.teamshareWeb?.url)
}

function requestClusterConfig(clusterCode: string) {
	const cachedConfig = getClusterConfigFromStore(clusterCode)
	if (cachedConfig?.services?.teamshareWeb?.url) return Promise.resolve(cachedConfig)

	const existingPromise = clusterConfigLoadingCache.get(clusterCode)
	if (existingPromise) return existingPromise

	const loadingPromise = service
		.get<LoginService>("loginService")
		.getClusterConfig(clusterCode)
		.then((config) => {
			if (config?.services?.teamshareWeb?.url) return config

			const latestConfig = getClusterConfigFromStore(clusterCode)
			if (latestConfig?.services?.teamshareWeb?.url) return latestConfig

			throw new Error(`Cluster config is incomplete: ${clusterCode}`)
		})
		.finally(() => {
			clusterConfigLoadingCache.delete(clusterCode)
		})

	clusterConfigLoadingCache.set(clusterCode, loadingPromise)
	return loadingPromise
}

export function ensureClusterConfigReady(clusterCode?: string) {
	if (clusterCode == null) return Promise.reject(new Error("Missing cluster code"))

	if (hasClusterConfigReady(clusterCode)) {
		const clusterConfig = getClusterConfigFromStore(clusterCode)
		if (clusterConfig) return Promise.resolve(clusterConfig)
	}

	const existingPromise = clusterConfigLoadingCache.get(clusterCode)
	if (existingPromise) return existingPromise

	return requestClusterConfig(clusterCode)
}
