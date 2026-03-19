import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import TableCell from "../TableCell"

// Mock react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: vi.fn(() => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"markdownTable.clickToExpand": "点击展开完整内容",
			}
			return translations[key] || key
		},
	})),
}))

// Mock styles
vi.mock("../styles", () => ({
	useTableStyles: () => ({
		styles: {
			longText: "long-text-class",
		},
		cx: (...classes: any[]) => classes.filter(Boolean).join(" "),
	}),
}))

// Mock useTableI18n
vi.mock("../useTableI18n", () => ({
	useTableI18n: () => ({
		clickToExpand: "点击展开完整内容",
	}),
}))

describe("TableCell", () => {
	it("应该渲染普通的表格数据单元格", () => {
		render(<TableCell>普通文本</TableCell>)
		const cell = screen.getByRole("cell")
		expect(cell).toBeDefined()
		expect(cell.textContent).toBe("普通文本")
	})

	it("应该渲染表头单元格", () => {
		render(<TableCell isHeader>表头文本</TableCell>)
		const headerCell = screen.getByRole("columnheader")
		expect(headerCell).toBeDefined()
		expect(headerCell.textContent).toBe("表头文本")
	})

	it("应该正确处理短文本内容", () => {
		render(<TableCell>短文本</TableCell>)
		const cell = screen.getByRole("cell")
		expect(cell.textContent).toBe("短文本")
		// 短文本不应该有长文本包装器
		expect(cell.querySelector(".long-text-class")).toBeNull()
	})

	it("应该为超长文本添加长文本包装器", () => {
		const longText =
			"这是一个非常长的文本内容，超过了50个字符的阈值，应该被包装在长文本组件中进行处理，这样就能确保超过50个字符了"
		render(<TableCell>{longText}</TableCell>)

		const longTextWrapper = screen.getByTitle("点击展开完整内容")
		expect(longTextWrapper).toBeDefined()
		expect(longTextWrapper.textContent).toBe(longText)
	})

	it("应该支持长文本的点击展开功能", () => {
		const longText =
			"这是一个非常长的文本内容，超过了50个字符的阈值，应该被包装在长文本组件中进行处理，这样就能确保超过50个字符了"
		render(<TableCell>{longText}</TableCell>)

		const longTextWrapper = screen.getByTitle("点击展开完整内容")
		expect(longTextWrapper).toBeDefined()

		// 点击展开
		fireEvent.click(longTextWrapper)

		// 展开后应该没有title属性
		expect(longTextWrapper.title).toBe("")
	})

	it("应该根据内容自动设置文本对齐方式", () => {
		// 测试左对齐（默认）
		const { unmount: unmount1 } = render(<TableCell>普通文本</TableCell>)
		let cell = screen.getByRole("cell")
		expect(cell.style.textAlign).toBe("left")
		unmount1()

		// 测试右对齐（数字）
		const { unmount: unmount2 } = render(<TableCell>12345</TableCell>)
		cell = screen.getByRole("cell")
		expect(cell.style.textAlign).toBe("right")
		unmount2()

		// 测试居中对齐（特殊符号）
		const { unmount: unmount3 } = render(<TableCell>→</TableCell>)
		cell = screen.getByRole("cell")
		expect(cell.style.textAlign).toBe("center")
		unmount3()
	})

	it("应该处理数组形式的子元素", () => {
		render(
			<TableCell>
				{[
					"文本1",
					"这是一个非常长的文本内容，超过了50个字符的阈值，应该被包装在长文本组件中进行处理，这样就能确保超过50个字符了",
				]}
			</TableCell>,
		)

		const cell = screen.getByRole("cell")
		expect(cell.textContent).toContain("文本1")
		expect(cell.textContent).toContain("这是一个非常长的文本内容")
	})

	it("应该保持空格和特殊字符的样式", () => {
		render(<TableCell>文本 带空格</TableCell>)
		const cell = screen.getByRole("cell")
		expect(cell.style.whiteSpace).toBe("pre-wrap")
	})

	it("应该正确处理空内容", () => {
		render(<TableCell>{""}</TableCell>)
		const cell = screen.getByRole("cell")
		expect(cell).toBeDefined()
		expect(cell.textContent).toBe("")
	})
})
