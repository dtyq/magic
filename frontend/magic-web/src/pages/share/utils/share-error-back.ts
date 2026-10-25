import { RouteName } from "@/routes/constants"

/**
 * 分享页「无查看权限」时，返回按钮的落点。
 *
 * - 桌面回 Super 首页（`/super`）、移动端回 `/mobile-home`，都会带上当前集群编码；
 *   不再落到站点根路由 `/`，否则根路由还要再重定向一次。
 * - `replace` 是为了不把这张无权限错误页留在历史栈里，避免用户回退时又落回来。
 * - 这是一次「重置回首页」而非前进，所以关掉移动端默认的推进转场动画。
 */
export const resolveShareErrorBackNavigation = (isMobile: boolean) => ({
	name: isMobile ? RouteName.MobileHome : RouteName.Super,
	replace: true,
	viewTransition: false,
})
