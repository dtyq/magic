import { makeAutoObservable } from "mobx"
import { MobileTabBarKey } from "@/pages/mobileTabs/constants"

// Re-export the type for backward compatibility

class MobileTabStore {
	/**
	 * 当前激活的 Tab
	 */
	activeTab: MobileTabBarKey = MobileTabBarKey.Super

	/**
	 * 导航菜单弹层是否显示
	 */
	navigatePopupVisible = false

	constructor() {
		makeAutoObservable(this)
	}

	/**
	 * 设置当前激活的 Tab
	 * @param tab Tab 键值
	 * @param _shouldNavigate 是否应该触发导航（保留参数以保持向后兼容）
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	setActiveTab(tab: MobileTabBarKey, _shouldNavigate: boolean = true) {
		this.activeTab = tab
	}

	/**
	 * 打开导航菜单弹层
	 */
	openNavigatePopup() {
		this.navigatePopupVisible = true
	}

	/**
	 * 关闭导航菜单弹层
	 */
	closeNavigatePopup() {
		this.navigatePopupVisible = false
	}
}

// 创建全局单例
export const mobileTabStore = new MobileTabStore()
