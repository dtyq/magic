import { useEffect } from "react"
import { useLocation } from "react-router"
import { interfaceStore } from "@/stores/interface"
import { RouteName } from "@/routes/constants"
import { routesPathMatch } from "../routes/history/helpers"

// 需要自定义安全边距背景色的路由配置
const SAFE_AREA_STYLE_ROUTES: Record<
	string,
	{ top?: { backgroundColor: string }; bottom?: { backgroundColor: string } }
> = {
	[RouteName.UserMy]: {
		top: { backgroundColor: "rgba(249,249,249, 1)" },
		bottom: { backgroundColor: "rgba(249,249,249, 1)" },
	},
	[RouteName.MagicApprovalSetting]: {
		top: { backgroundColor: "rgba(249,249,249, 1)" },
		bottom: { backgroundColor: "rgba(249,249,249, 1)" },
	},
	[RouteName.SuperWorkspaceProjectTopicState]: {
		bottom: { backgroundColor: "rgba(252,252,252, 1)" },
	},
	[RouteName.MagicApprovalList]: {
		bottom: { backgroundColor: "rgba(249,249,249, 1)" },
	},
	[RouteName.MagicApprovalRecord]: {
		top: { backgroundColor: "rgba(249,249,249, 1)" },
		bottom: { backgroundColor: "rgba(249,249,249, 1)" },
	},
	// 可以继续添加其他路由...
}

/**
 * 根据当前路由自动设置全局安全边距样式
 * 解决路由缓存导致的样式无法重置问题
 */
export function useGlobalSafeArea() {
	const location = useLocation()

	// console.log("interfaceStore.enableGlobalSafeArea", interfaceStore.enableGlobalSafeArea)

	useEffect(() => {
		// 检查当前路由是否需要自定义样式
		const matchedRoute = Object.keys(SAFE_AREA_STYLE_ROUTES).find((route) =>
			routesPathMatch(route as RouteName, location.pathname),
		)
		if (matchedRoute) {
			const style = SAFE_AREA_STYLE_ROUTES[matchedRoute]
			interfaceStore.setGlobalSafeAreaStyle("top", style.top || {})
			interfaceStore.setGlobalSafeAreaStyle("bottom", style.bottom || {})
		} else {
			// 重置为默认样式
			interfaceStore.resetGlobalSafeAreaStyle()
		}
	}, [location.pathname])
}
