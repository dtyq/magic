import { interfaceStore } from "@/stores/interface"
import { RouteName } from "@/routes/constants"
import { routesPathMatch } from "@/routes/history/helpers"

/** Routes that override default GlobalSafeArea top/bottom background colors. */
const SAFE_AREA_STYLE_ROUTES: Record<
	string,
	{ top?: { backgroundColor: string }; bottom?: { backgroundColor: string } }
> = {
	[RouteName.Profile]: {
		top: { backgroundColor: "rgba(249,249,249, 1)" },
		bottom: { backgroundColor: "rgba(249,249,249, 1)" },
	},
	[RouteName.MagicApprovalSetting]: {
		top: { backgroundColor: "rgba(249,249,249, 1)" },
		bottom: { backgroundColor: "rgba(249,249,249, 1)" },
	},
	[RouteName.MagicApprovalList]: {
		bottom: { backgroundColor: "rgba(249,249,249, 1)" },
	},
	[RouteName.MagicApprovalRecord]: {
		top: { backgroundColor: "rgba(249,249,249, 1)" },
		bottom: { backgroundColor: "rgba(249,249,249, 1)" },
	},
	// ClawPlayground: top matches header bg-background, bottom matches page/input bg-sidebar
}

/**
 * Apply route-specific GlobalSafeArea overrides (used when the Super mobile drawer is closed).
 */
export function applyRouteGlobalSafeAreaStyle(pathname: string): void {
	const matchedRoute = Object.keys(SAFE_AREA_STYLE_ROUTES).find((route) =>
		routesPathMatch(route as RouteName, pathname),
	)
	if (matchedRoute) {
		const style = SAFE_AREA_STYLE_ROUTES[matchedRoute]
		interfaceStore.setGlobalSafeAreaStyle("top", style.top || {})
		interfaceStore.setGlobalSafeAreaStyle("bottom", style.bottom || {})
		return
	}

	interfaceStore.resetGlobalSafeAreaStyle()
}
