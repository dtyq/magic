import MagicrewIcon from "@/layouts/BaseLayoutMobile/components/MobileTabBar/icons/MagicrewIcon"
import type {
	MobileTabBarConfig,
	MobileTabBarItem,
	SharedMobileTabBarConfigsParams,
	SharedMobileTabBarItemsParams,
} from "@/layouts/BaseLayoutMobile/components/MobileTabBar/constants/tabsConfig.shared"
import {
	buildMobileTabBarConfigs,
	buildMobileTabBarItems,
	getOrganizationAppsChildrenConfigs,
	MOBILE_TAB_BAR_APPS_KEY,
} from "@/layouts/BaseLayoutMobile/components/MobileTabBar/constants/tabsConfig.shared"

export { MOBILE_TAB_BAR_APPS_KEY }
export type { MobileTabBarConfig, MobileTabBarItem }

type GetMobileTabBarConfigsParams = Pick<SharedMobileTabBarConfigsParams, "isPersonalOrganization">

type GetMobileTabBarItemsParams = Pick<
	SharedMobileTabBarItemsParams,
	"activeKey" | "chatUnreadCount" | "iconSize" | "isPersonalOrganization" | "translate"
>

export function getMobileTabBarConfigs(params: GetMobileTabBarConfigsParams): MobileTabBarConfig[] {
	return buildMobileTabBarConfigs({
		...params,
		appsChildrenConfigs: getOrganizationAppsChildrenConfigs(params),
		includeRecording: false,
		superIconComponent: MagicrewIcon,
	})
}

export function getMobileTabBarItems(params: GetMobileTabBarItemsParams): MobileTabBarItem[] {
	return buildMobileTabBarItems({
		...params,
		appsChildrenConfigs: getOrganizationAppsChildrenConfigs(params),
		includeRecording: false,
		superIconComponent: MagicrewIcon,
	})
}
