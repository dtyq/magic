import type { ThemeMode } from "antd-style"

/** Product policy: only light until dark mode ships. */
export const IS_DARK_MODE_DISABLED = true

export function normalizeThemeMode(theme: ThemeMode): ThemeMode {
	return theme
}
