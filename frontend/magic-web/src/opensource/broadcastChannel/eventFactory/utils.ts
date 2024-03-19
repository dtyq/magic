import { history } from "@/opensource/routes/history"
import { routesMatch, convertSearchParams } from "@/opensource/routes/history/helpers"
import { has } from "lodash-es"
import { defaultClusterCode } from "@/opensource/routes/helpers"
import { User } from "@/opensource/types/user"

/**
 * 处理路由重定向
 * 当且仅当路由存在名称且存在集群编码的路由参数时需要重定向替换路由参数(集群不一致时则需要执行)
 */
export function handleRouteRedirect(account: User.UserAccount | null): void {
	if (!account) {
		return
	}

	const matchesRoute = routesMatch(window.location.pathname)

	if (
		matchesRoute?.route?.name &&
		has(matchesRoute?.params || {}, "clusterCode") &&
		account.deployCode !== matchesRoute?.params?.clusterCode
	) {
		const url = new URL(window.location.href)
		history.replace({
			name: matchesRoute?.route?.name,
			params: {
				...(matchesRoute?.params || {}),
				clusterCode: account?.deployCode || defaultClusterCode,
			},
			query: convertSearchParams(url.searchParams),
		})
	}
}

/**
 * 生成事件ID（用于去重）
 * 注意：不使用时间戳，确保相同操作生成相同ID以实现去重
 */
export function generateEventId(
	type: "organization" | "account",
	magicId: string,
	organizationCode?: string,
): string {
	return `${type}_${magicId}_${organizationCode || ""}`
}
