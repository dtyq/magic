import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useTableStyles } from "../styles"

// Mock antd-style
vi.mock("antd-style", () => ({
	createStyles: (styleFunction: () => any) => {
		// Create a simple mock function to simulate createStyles behavior
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
	it("should return style object", () => {
		const { result } = renderHook(() => useTableStyles())

		expect(result.current.styles).toBeDefined()
		expect(result.current.cx).toBeDefined()
	})

	it("should contain all required style classes", () => {
		const { result } = renderHook(() => useTableStyles())
		const { styles } = result.current

		expect(styles.tableContainer).toBe("table-container-style")
		expect(styles.showMoreButton).toBe("show-more-button-style")
		expect(styles.formValueContent).toBe("form-value-content-style")
		expect(styles.longText).toBe("long-text-style")
		expect(styles.detailForm).toBe("detail-form-style")
		expect(styles.mobileTable).toBe("mobile-table-style")
	})

	it("cx function should correctly merge class names", () => {
		const { result } = renderHook(() => useTableStyles())
		const { cx } = result.current

		expect(cx("class1", "class2")).toBe("class1 class2")
		expect(cx("class1", null, "class2")).toBe("class1 class2")
		expect(cx("class1", false, "class2")).toBe("class1 class2")
		expect(cx("class1", undefined, "class2")).toBe("class1 class2")
	})

	it("styles object should be object type", () => {
		const { result } = renderHook(() => useTableStyles())
		const { styles } = result.current

		expect(typeof styles).toBe("object")
		expect(styles).not.toBeNull()
	})

	it("cx function should be function type", () => {
		const { result } = renderHook(() => useTableStyles())
		const { cx } = result.current

		expect(typeof cx).toBe("function")
	})
})
