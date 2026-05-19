import { makeAutoObservable } from "mobx"
import type { ThemeMode } from "antd-style"

/**
 * @description 主题配置Store，负责内存状态管理
 */
export class ThemeStore {
	// Default light while dark mode is disabled (see constants/theme.ts)
	theme: ThemeMode = "light"

	constructor() {
		makeAutoObservable(this)
	}

	/**
	 * @description 设置主题
	 */
	setTheme(theme: ThemeMode) {
		this.theme = theme
	}
}

export const themeStore = new ThemeStore()
