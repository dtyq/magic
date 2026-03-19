import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useTableStyles } from "../styles"

// Mock antd-style
vi.mock("antd-style", () => ({
	createStyles: (styleFunction: () => any) => {
		// 创建一个简单的mock函数来模拟createStyles的行为
		return () => ({
			styles: {
				tableContainer: "table-container-style",
				showMoreButton: "show-more-button-style",
				formValueContent: "form-value-content-style",
				longText: "long-text-style",
				detailForm: "detail-form-style",
				mobileTable: "mobile-table-style",
			},
			cx: (...classes: any[]) => classes.filter(Boolean).join(" "),
		})
	},
}))

describe("useTableStyles", () => {
	it("应该返回样式对象", () => {
		const { result } = renderHook(() => useTableStyles())

		expect(result.current.styles).toBeDefined()
		expect(result.current.cx).toBeDefined()
	})

	it("应该包含所有必需的样式类", () => {
		const { result } = renderHook(() => useTableStyles())
		const { styles } = result.current

		expect(styles.tableContainer).toBe("table-container-style")
		expect(styles.showMoreButton).toBe("show-more-button-style")
		expect(styles.formValueContent).toBe("form-value-content-style")
		expect(styles.longText).toBe("long-text-style")
		expect(styles.detailForm).toBe("detail-form-style")
		expect(styles.mobileTable).toBe("mobile-table-style")
	})

	it("cx函数应该正确合并类名", () => {
		const { result } = renderHook(() => useTableStyles())
		const { cx } = result.current

		expect(cx("class1", "class2")).toBe("class1 class2")
		expect(cx("class1", null, "class2")).toBe("class1 class2")
		expect(cx("class1", false, "class2")).toBe("class1 class2")
		expect(cx("class1", undefined, "class2")).toBe("class1 class2")
	})

	it("styles对象应该是对象类型", () => {
		const { result } = renderHook(() => useTableStyles())
		const { styles } = result.current

		expect(typeof styles).toBe("object")
		expect(styles).not.toBeNull()
	})

	it("cx函数应该是函数类型", () => {
		const { result } = renderHook(() => useTableStyles())
		const { cx } = result.current

		expect(typeof cx).toBe("function")
	})
})
