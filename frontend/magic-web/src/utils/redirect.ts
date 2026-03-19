import { RouteName } from "@/routes/constants"
import { configStore } from "@/models/config"
import { userStore } from "@/models/user"
import { isMobile } from "@/utils/devices"

// 获取登录后跳转的首页
export const getHomeURL = async () => {
	const { clusterCode } = configStore.cluster
	const defaultRouteName = isMobile ? RouteName.MobileTabs : RouteName.Super

	try {
		const location = window.location.pathname
		if (location.startsWith("/platform") && userStore.user.isAdmin) {
			return {
				name: RouteName.PlatformHome,
			}
		}
		if (location.startsWith("/admin") && userStore.user.isAdmin) {
			return {
				name: RouteName.AdminEnterpriseOrganization,
			}
		}

		return {
			name: defaultRouteName,
			clusterCode,
		}
	} catch (error) {
		console.error(error)
		// 兜底跳转
		return {
			name: defaultRouteName,
			clusterCode,
		}
	}
}
