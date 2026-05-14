import { makeAutoObservable } from "mobx"
import type { ThemeMode } from "antd-style"

import { normalizeThemeMode } from "@/constants/theme"
import { Storage } from "@/models/repository/Cache"

/** 与 `ConfigRepository` 写入主题时的 Storage key 一致 */
const THEME_STORAGE_KEY = "config:theme"

function readPersistedThemeMode(): ThemeMode | undefined {
	if (typeof window === "undefined") return undefined

	const raw = Storage.get(THEME_STORAGE_KEY) as unknown
	if (raw && typeof raw === "object" && "value" in raw) {
		const value = (raw as { value?: unknown }).value
		if (value === "dark" || value === "light" || value === "auto") {
			return value
		}
		return undefined
	}
	if (raw === "dark" || raw === "light" || raw === "auto") {
		return raw
	}
	return undefined
}

/**
 * @description 主题配置 Store：内存状态 + 首屏从本地缓存恢复（与持久化写入同一 key）
 */
export class ThemeStore {
	// 默认浅色；浏览器端构造时会用缓存覆盖（见 `hydrateInitialThemeFromLocalCache`）
	theme: ThemeMode = "light"

	constructor() {
		makeAutoObservable(this)
		if (typeof window !== "undefined") {
			this.hydrateInitialThemeFromLocalCache()
		}
	}

	/**
	 * 首次从 localStorage 读取用户上次主题，作为内存默认值，并同步 `html.dark`，减轻首屏闪浅色。
	 * 持久化写入仍由 `ConfigService.setThemeConfig` → `ConfigRepository.setThemeConfig` 负责。
	 */
	private hydrateInitialThemeFromLocalCache() {
		const persisted = readPersistedThemeMode()
		if (persisted) {
			this.theme = normalizeThemeMode(persisted)
		}
		this.syncDocumentDarkClass()
	}

	/** 按当前 `theme` 解析亮/暗并写 `<html class="dark">` */
	syncDocumentDarkClass() {
		if (typeof window === "undefined") return

		const normalized = normalizeThemeMode(this.theme)
		if (this.theme !== normalized) {
			this.theme = normalized
		}

		let resolved: "light" | "dark" = "light"
		if (normalized === "auto") {
			resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
		} else {
			resolved = normalized === "dark" ? "dark" : "light"
		}

		document.documentElement.classList.toggle("dark", resolved === "dark")
	}

	/**
	 * @description 设置主题（内存）；持久化请走 `ConfigService.setThemeConfig`
	 */
	setTheme(theme: ThemeMode) {
		this.theme = theme
	}
}

export const themeStore = new ThemeStore()
