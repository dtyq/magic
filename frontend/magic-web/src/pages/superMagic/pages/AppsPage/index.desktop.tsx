import Navigate from "@/routes/components/Navigate"
import { RouteName } from "@/routes/constants"

/**
 * 首期 Apps 页面只为移动端重构落地，桌面端访问时先回到 Super 首页避免暴露未设计态。
 */
export default function AppsPageDesktop() {
	return <Navigate name={RouteName.Super} replace />
}
