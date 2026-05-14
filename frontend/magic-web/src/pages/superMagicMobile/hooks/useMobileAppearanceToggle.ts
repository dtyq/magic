import { useMemoizedFn } from "ahooks"
import type { ThemeMode } from "antd-style"

import { magic } from "@/enhance/magicElectron"
import { useTheme } from "@/models/config/hooks"

/**
 * 移动端壳层外观切换：与 SSO `AppearanceSwitch` 同管线（`useTheme` + `magic.theme`），
 * 供 container 组合，view 仅接收回调与状态。
 */
export function useMobileAppearanceToggle() {
	const { prefersColorScheme, setTheme } = useTheme()

	const toggleAppearance = useMemoizedFn(() => {
		const next: ThemeMode = prefersColorScheme === "dark" ? "light" : "dark"
		setTheme(next)
		magic?.theme?.setTheme?.(next)
	})

	return {
		prefersColorScheme,
		isToggleDisabled: false,
		toggleAppearance,
		isDarkAppearance: prefersColorScheme === "dark",
	}
}
