import { lazy } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"

const AppsPageDesktop = lazy(() => import("./index.desktop"))
const AppsPageMobile = lazy(() => import("./index.mobile"))

/**
 * Apps 页面沿用双端入口模式，首期仅在移动端承接新的目录页实现。
 */
export default function AppsPage() {
	const isMobile = useIsMobile()

	if (isMobile) return <AppsPageMobile />

	return <AppsPageDesktop />
}
