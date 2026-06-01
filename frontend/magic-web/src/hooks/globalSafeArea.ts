import { applyRouteGlobalSafeAreaStyle } from "@/layouts/BaseLayoutMobile/components/GlobalSafeArea/routeStyles"
import { applyMobileGlobalSafeAreaForSidebar } from "@/pages/superMagicMobile/utils/mobileDocumentTheme"

export { applyRouteGlobalSafeAreaStyle } from "@/layouts/BaseLayoutMobile/components/GlobalSafeArea/routeStyles"

export interface SyncGlobalSafeAreaOptions {
	pathname: string
	isSidebarOpen: boolean
}

export function syncGlobalSafeArea({ pathname, isSidebarOpen }: SyncGlobalSafeAreaOptions) {
	if (isSidebarOpen) {
		applyMobileGlobalSafeAreaForSidebar(true)
		return
	}

	applyRouteGlobalSafeAreaStyle(pathname)
}
