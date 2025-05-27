import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useTableI18n } from "../useTableI18n"

// Mock react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: vi.fn(() => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"markdownTable.showMore": "显示更多",
				"markdownTable.rowDetails": "行详细信息",
				"markdownTable.clickToExpand": "点击展开完整内容",
				"markdownTable.showAllColumns": "显示所有列",
				"markdownTable.hideAllColumns": "隐藏",
				"markdownTable.defaultColumn": "列",
			}
			return translations[key] || key
		},
	})),
}))

describe("useTableI18n", () => {
	it("should return correct translation text", () => {
		const { result } = renderHook(() => useTableI18n())

		expect(result.current.showMore).toBe("显示更多")
		expect(result.current.rowDetails).toBe("行详细信息")
		expect(result.current.clickToExpand).toBe("点击展开完整内容")
		expect(result.current.showAllColumns).toBe("显示所有列")
		expect(result.current.hideAllColumns).toBe("隐藏")
		expect(result.current.defaultColumn).toBe("列")
	})

	it("should contain all required translation keys", () => {
		const { result } = renderHook(() => useTableI18n())

		expect(result.current).toHaveProperty("showMore")
		expect(result.current).toHaveProperty("rowDetails")
		expect(result.current).toHaveProperty("clickToExpand")
		expect(result.current).toHaveProperty("showAllColumns")
		expect(result.current).toHaveProperty("hideAllColumns")
		expect(result.current).toHaveProperty("defaultColumn")
	})

	it("should return string type translation values", () => {
		const { result } = renderHook(() => useTableI18n())

		expect(typeof result.current.showMore).toBe("string")
		expect(typeof result.current.rowDetails).toBe("string")
		expect(typeof result.current.clickToExpand).toBe("string")
		expect(typeof result.current.showAllColumns).toBe("string")
		expect(typeof result.current.hideAllColumns).toBe("string")
		expect(typeof result.current.defaultColumn).toBe("string")
	})
})
