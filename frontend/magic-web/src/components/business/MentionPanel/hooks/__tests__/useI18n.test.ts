import { renderHook, act } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
// @ts-ignore
import { useI18n, useI18nStatic } from "../useI18n"
import type { Language } from "../../i18n/types"

// Mock the i18n modules
vi.mock("../../i18n", () => ({
	getDefaultLanguage: vi.fn(() => "en"),
	normalizeLocale: vi.fn((locale: string) => {
		if (!locale || typeof locale !== "string") return "en"
		const normalized = locale.toLowerCase().trim()
		if (normalized.startsWith("zh") || normalized === "chinese" || normalized === "中文") {
			return "zh-CN"
		}
		if (normalized.startsWith("en") || normalized === "english") {
			return "en"
		}
		console.warn(`Unsupported language: ${locale}, falling back to English`)
		return "en"
	}),
	isSupportedLocale: vi.fn((locale: string) => {
		if (!locale || typeof locale !== "string") return false
		const normalized = locale.toLowerCase().trim()
		return (
			normalized.startsWith("zh") ||
			normalized.startsWith("en") ||
			normalized === "chinese" ||
			normalized === "english" ||
			normalized === "中文"
		)
	}),
}))

vi.mock("../../i18n/locales/en", () => ({
	en: {
		searchPlaceholder: "Search project files",
		loading: "Loading...",
		error: "Failed to load data",
		retry: "Retry",
		empty: "No data available",
		keyboardHints: {
			navigate: "Navigate",
			confirm: "Confirm",
			goBack: "Go back",
			goForward: "Go forward",
			exitSearch: "Exit",
		},
		ariaLabels: {
			panel: "Mention panel",
			menuItem: "Menu item",
			searchInput: "Search input",
			retryButton: "Retry button",
		},
	},
}))

vi.mock("../../i18n/locales/zh-CN", () => ({
	zhCN: {
		searchPlaceholder: "搜索项目文件",
		loading: "加载中...",
		error: "加载失败",
		retry: "重试",
		empty: "暂无数据",
		keyboardHints: {
			navigate: "切换选择",
			confirm: "确认",
			goBack: "返回上一层",
			goForward: "进入下一层",
			exitSearch: "退出",
		},
		ariaLabels: {
			panel: "提及面板",
			menuItem: "菜单项",
			searchInput: "搜索输入框",
			retryButton: "重试按钮",
		},
	},
}))

describe("useI18n", () => {
	let consoleWarnSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
	})

	afterEach(() => {
		consoleWarnSpy.mockRestore()
		vi.clearAllMocks()
	})

	describe("initialization", () => {
		it("should initialize with default language when no initial language provided", () => {
			const { result } = renderHook(() => useI18n())

			expect(result.current.language).toBe("en")
			expect(result.current.t.searchPlaceholder).toBe("Search project files")
		})

		it("should initialize with provided initial language", () => {
			const { result } = renderHook(() => useI18n("zh-CN"))

			expect(result.current.language).toBe("zh-CN")
			expect(result.current.t.searchPlaceholder).toBe("搜索项目文件")
		})

		it("should fall back to English for unsupported initial language", () => {
			const { result } = renderHook(() => useI18n("fr" as Language))

			expect(result.current.language).toBe("en")
			expect(result.current.t.searchPlaceholder).toBe("Search project files")
		})
	})

	describe("language switching", () => {
		it("should switch language correctly", () => {
			const { result } = renderHook(() => useI18n("en"))

			act(() => {
				result.current.setLanguage("zh-CN")
			})

			expect(result.current.language).toBe("zh-CN")
			expect(result.current.t.searchPlaceholder).toBe("搜索项目文件")
		})

		it("should switch from Chinese to English", () => {
			const { result } = renderHook(() => useI18n("zh-CN"))

			act(() => {
				result.current.setLanguage("en")
			})

			expect(result.current.language).toBe("en")
			expect(result.current.t.searchPlaceholder).toBe("Search project files")
		})

		it("should warn and fall back to English for unsupported language", () => {
			const { result } = renderHook(() => useI18n("en"))

			act(() => {
				result.current.setLanguage("fr" as Language)
			})

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				"Unsupported language: fr, falling back to English",
			)
			expect(result.current.language).toBe("en")
			expect(result.current.t.searchPlaceholder).toBe("Search project files")
		})

		it("should not re-render when setting the same language", () => {
			const { result, rerender } = renderHook(() => useI18n("en"))
			const initialT = result.current.t

			act(() => {
				result.current.setLanguage("en")
			})

			rerender()
			expect(result.current.t).toBe(initialT)
		})
	})

	describe("text content", () => {
		it("should provide correct English texts", () => {
			const { result } = renderHook(() => useI18n("en"))

			expect(result.current.t).toEqual({
				searchPlaceholder: "Search project files",
				loading: "Loading...",
				error: "Failed to load data",
				retry: "Retry",
				empty: "No data available",
				keyboardHints: {
					navigate: "Navigate",
					confirm: "Confirm",
					goBack: "Go back",
					goForward: "Go forward",
					exitSearch: "Exit",
				},
				ariaLabels: {
					panel: "Mention panel",
					menuItem: "Menu item",
					searchInput: "Search input",
					retryButton: "Retry button",
				},
			})
		})

		it("should provide correct Chinese texts", () => {
			const { result } = renderHook(() => useI18n("zh-CN"))

			expect(result.current.t).toEqual({
				searchPlaceholder: "搜索项目文件",
				loading: "加载中...",
				error: "加载失败",
				retry: "重试",
				empty: "暂无数据",
				keyboardHints: {
					navigate: "切换选择",
					confirm: "确认",
					goBack: "返回上一层",
					goForward: "进入下一层",
					exitSearch: "退出",
				},
				ariaLabels: {
					panel: "提及面板",
					menuItem: "菜单项",
					searchInput: "搜索输入框",
					retryButton: "重试按钮",
				},
			})
		})
	})

	describe("memoization", () => {
		it("should memoize texts when language doesn't change", () => {
			const { result, rerender } = renderHook(() => useI18n("en"))
			const initialT = result.current.t

			rerender()
			expect(result.current.t).toBe(initialT)
		})

		it("should update texts when language changes", () => {
			const { result } = renderHook(() => useI18n("en"))
			const initialT = result.current.t

			act(() => {
				result.current.setLanguage("zh-CN")
			})

			expect(result.current.t).not.toBe(initialT)
			expect(result.current.t.searchPlaceholder).toBe("搜索项目文件")
		})
	})
})

describe("useI18nStatic", () => {
	it("should return English texts by default", () => {
		const { result } = renderHook(() => useI18nStatic())

		expect(result.current.searchPlaceholder).toBe("Search project files")
		expect(result.current.loading).toBe("Loading...")
	})

	it("should return texts for specified language", () => {
		const { result } = renderHook(() => useI18nStatic("zh-CN"))

		expect(result.current.searchPlaceholder).toBe("搜索项目文件")
		expect(result.current.loading).toBe("加载中...")
	})

	it("should fall back to English for unsupported language", () => {
		const { result } = renderHook(() => useI18nStatic("fr" as Language))

		expect(result.current.searchPlaceholder).toBe("Search project files")
		expect(result.current.loading).toBe("Loading...")
	})

	it("should memoize results", () => {
		const { result, rerender } = renderHook(() => useI18nStatic("en"))
		const initialResult = result.current

		rerender()
		expect(result.current).toBe(initialResult)
	})

	it("should update when language prop changes", () => {
		const { result, rerender } = renderHook(({ lang }) => useI18nStatic(lang), {
			initialProps: { lang: "en" as Language },
		})
		const initialResult = result.current

		rerender({ lang: "zh-CN" })
		expect(result.current).not.toBe(initialResult)
		expect(result.current.searchPlaceholder).toBe("搜索项目文件")
	})

	describe("keyboard hints", () => {
		it("should provide correct keyboard hints for English", () => {
			const { result } = renderHook(() => useI18nStatic("en"))

			expect(result.current.keyboardHints).toEqual({
				navigate: "Navigate",
				confirm: "Confirm",
				goBack: "Go back",
				goForward: "Go forward",
				exitSearch: "Exit",
			})
		})

		it("should provide correct keyboard hints for Chinese", () => {
			const { result } = renderHook(() => useI18nStatic("zh-CN"))

			expect(result.current.keyboardHints).toEqual({
				navigate: "切换选择",
				confirm: "确认",
				goBack: "返回上一层",
				goForward: "进入下一层",
				exitSearch: "退出",
			})
		})
	})

	describe("aria labels", () => {
		it("should provide correct aria labels for English", () => {
			const { result } = renderHook(() => useI18nStatic("en"))

			expect(result.current.ariaLabels).toEqual({
				panel: "Mention panel",
				menuItem: "Menu item",
				searchInput: "Search input",
				retryButton: "Retry button",
			})
		})

		it("should provide correct aria labels for Chinese", () => {
			const { result } = renderHook(() => useI18nStatic("zh-CN"))

			expect(result.current.ariaLabels).toEqual({
				panel: "提及面板",
				menuItem: "菜单项",
				searchInput: "搜索输入框",
				retryButton: "重试按钮",
			})
		})
	})
})
