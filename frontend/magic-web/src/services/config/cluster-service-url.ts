import { env } from "@/utils/env"

export interface ClusterServiceUrls {
	keewood: string
	teamshare: string
}

/**
 * 解析指定 cluster 的 Keewood API base URL。
 * 依赖 `configStore.cluster.clusterConfig[clusterCode]` 已写入（可由 cluster-config-loader 保证）。
 */
export function getKeewoodServiceUrl(clusterCode?: string | null) {
	return env("MAGIC_SERVICE_KEEWOOD_BASE_URL", false, clusterCode ?? undefined)
}

/**
 * 解析指定 cluster 的 Teamshare API base URL。
 * 依赖 `configStore.cluster.clusterConfig[clusterCode]` 已写入（可由 cluster-config-loader 保证）。
 */
export function getTeamshareServiceUrl(clusterCode?: string | null) {
	return env("MAGIC_SERVICE_TEAMSHARE_BASE_URL", false, clusterCode ?? undefined)
}

/** 一次性解析 Keewood / Teamshare 两个 API base URL，供 setBaseURL 等场景使用。 */
export function getClusterServiceUrls(clusterCode?: string | null): ClusterServiceUrls {
	return {
		keewood: getKeewoodServiceUrl(clusterCode),
		teamshare: getTeamshareServiceUrl(clusterCode),
	}
}
