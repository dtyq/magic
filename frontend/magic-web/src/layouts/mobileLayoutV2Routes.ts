import { RouteName } from "@/routes/constants"
import { routesPathMatch } from "@/routes/history/helpers"

/**
 * 使用 `BaseLayoutMobileV2` 的命名路由集合。
 * 渐进扩容：新重构页面加入此数组并在 `routes.tsx` 注册对应路由即可。
 */
export const MOBILE_LAYOUT_V2_ROUTE_NAMES = [RouteName.SuperShellDemo] as const

export function shouldUseMobileLayoutV2(pathname: string): boolean {
	return MOBILE_LAYOUT_V2_ROUTE_NAMES.some((name) => routesPathMatch(name, pathname))
}
