import { getNativePort } from "@/platform/native"
import { APP_TAB_BAR_KEYS_MAP, MobileTabBarKey } from "@/pages/mobileTabs/constants"
import { MOBILE_TAB_BAR_APPS_KEY } from "@/layouts/BaseLayoutMobile/components/MobileTabBar/constants/tabsConfig"
import { isMagicApp } from "@/utils/devices"

/**
 * 通知 Magic App 当前 Tab 和 TabBar 高度
 * @param targetKey 目标 Tab 键值
 */
export function notifyAppTabChange(targetKey: MobileTabBarKey | typeof MOBILE_TAB_BAR_APPS_KEY) {
	const appTabKey =
		targetKey === MOBILE_TAB_BAR_APPS_KEY
			? MOBILE_TAB_BAR_APPS_KEY
			: APP_TAB_BAR_KEYS_MAP[targetKey]

	// 只在 Magic App 中且存在对应的 APP tab key 时才通知
	if (!isMagicApp || !appTabKey) return

	// 通过 data-tabbar-wrap 属性查找 TabBar 元素
	const tabBarElement = document.querySelector("[data-tabbar-wrap]")?.parentElement

	if (!tabBarElement) {
		console.warn("TabBar element not found, cannot notify app")
		return
	}

	// 获取元素的计算样式中的 bottom 值（已包含安全边距）
	// 使用 getBoundingClientRect 获取元素底部到视口底部的距离
	const rect = tabBarElement.getBoundingClientRect()
	const bottomValue = window.innerHeight - rect.bottom

	getNativePort().navigation.changeBottomTab({
		tab: appTabKey,
		bottomTabHeight: tabBarElement.offsetHeight + bottomValue,
	})
}
