import { matchPath, useLocation } from "react-router"
import { RoutePath } from "@/constants/routes"

/** Route parameters remain authoritative while the detail stores are still switching projects. */
export function useChatSidebarSelection() {
	const { pathname } = useLocation()
	const detail = matchPath(`/:clusterCode${RoutePath.SuperChatProjectState}`, pathname)
	const isChatHome = Boolean(matchPath(`/:clusterCode${RoutePath.SuperChatHome}`, pathname))
	return {
		isChatHome,
		isChatRoute: isChatHome || Boolean(detail),
		projectId: detail?.params.projectId,
	}
}
