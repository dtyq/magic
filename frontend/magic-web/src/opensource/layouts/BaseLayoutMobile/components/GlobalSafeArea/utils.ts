import { routesPathMatch } from "@/opensource/routes/history/helpers"
import { RouteName } from "@/opensource/routes/constants"
import { MobileTabParam } from "@/opensource/pages/mobileTabs/constants"

/**
 * 不使用全局安全边距的路由名称列表
 */
export const NO_GLOBAL_SAFE_AREA_ROUTES_NAMES: string[] = [
	RouteName.Chat,
	RouteName.Explore,
	RouteName.ChatConversation,
	RouteName.Profile,
	RouteName.Super,
	RouteName.SuperWorkspaceState,
	RouteName.SuperWorkspaceProjectState,
	RouteName.MobileTabs,
	RouteName.ProfileSettingsTimezone,
]

/**
 * 判断当前路由是否不使用全局安全边距
 * @param pathname 当前路径
 * @param search 查询参数字符串（可选）
 * @returns 如果返回 true，表示不使用全局安全边距
 */
export function shouldDisableGlobalSafeArea(pathname: string, search?: string): boolean {
	// 检查是否是常规的不使用安全边距的路由
	const isNoGlobalSafeAreaRoute = NO_GLOBAL_SAFE_AREA_ROUTES_NAMES.some((route) =>
		routesPathMatch(route as RouteName, pathname),
	)

	// 检查是否在 MobileTabs 路由下且当前 tab 是 Chat
	let isMobileTabsChat = false
	if (pathname.includes("/mobile-tabs")) {
		if (search) {
			// 从查询参数判断
			const searchParams = new URLSearchParams(search)
			isMobileTabsChat = [MobileTabParam.Chat, MobileTabParam.Profile].includes(
				searchParams.get("tab") || "",
			)
		} else {
			// 兼容旧逻辑：检查路径是否包含 /chat
			isMobileTabsChat = pathname.includes("/chat")
		}
	}

	return isNoGlobalSafeAreaRoute || isMobileTabsChat
}
