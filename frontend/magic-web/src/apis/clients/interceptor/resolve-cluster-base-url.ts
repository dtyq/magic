import { configStore } from "@/models/config"
import { env } from "@/utils/env"

interface ResolveClusterScopedBaseURLParams {
	baseURL?: string
	envKey: "MAGIC_SERVICE_KEEWOOD_BASE_URL" | "MAGIC_SERVICE_TEAMSHARE_BASE_URL"
}

export function resolveClusterScopedBaseURL(params: ResolveClusterScopedBaseURLParams) {
	const { baseURL, envKey } = params
	// `configStore.cluster.clusterCode` 是登录完成后请求真正使用的全局 active cluster /
	// `configStore.cluster.clusterCode` is the global active cluster used by
	// requests after login completes.
	const activeClusterCode = configStore.cluster.clusterCode
	// 登录过程中，企业登录页可能已经先把 client 切到了私有化 baseURL，
	// 但全局 active cluster 还没准备好。此时继续保留这个登录态 baseURL，
	// 直到登录完成后由全局 cluster 接管 /
	// During login, the enterprise login page may already have switched the client
	// to a private baseURL before the global active cluster is ready. Keep that
	// login-scoped baseURL until the global cluster takes over after login.
	const resolvedBaseURL = !activeClusterCode
		? baseURL || env(envKey)
		: env(envKey, false, activeClusterCode)

	return resolvedBaseURL
}
