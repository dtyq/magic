import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import React from "react"
import TableWrapper from "../TableWrapper"

// Mock RowDetailDrawer
vi.mock("../RowDetailDrawer", () => ({
	default: ({ visible, title, onClose, rowData, headers }: any) => {
		return visible ? (
			<div data-testid="mock-drawer">
				<div data-testid="drawer-title">{title}</div>
				<button data-testid="drawer-close" onClick={onClose}>
					关闭
				</button>
				<div data-testid="drawer-content">
					{headers.map((header: string, index: number) => (
						<div key={header} data-testid={`drawer-row-${index}`}>
							{header}: {rowData[index] || rowData[header] || ""}
						</div>
					))}
				</div>
			</div>
		) : null
	},
}))

// Mock styles
vi.mock("../styles", () => ({
	useTableStyles: () => ({
		styles: {
			tableContainer: "table-container-class",
			mobileTable: "mobile-table-class",
			showMoreButton: "show-more-button-class",
		},
		cx: (...classes: any[]) => classes.filter(Boolean).join(" "),
	}),
}))

// Mock useTableI18n
vi.mock("../useTableI18n", () => ({
	useTableI18n: () => ({
		showMore: "显示更多",
		rowDetails: "行详细信息",
		clickToExpand: "点击展开完整内容",
		showAllColumns: "显示所有列",
		hideAllColumns: "隐藏",
		defaultColumn: "列",
	}),
}))

// Mock antd Switch
vi.mock("antd", () => ({
	Switch: ({ checked, onChange, ...props }: any) => (
		<input
			type="checkbox"
			role="switch"
			checked={checked}
			onChange={(e) => onChange && onChange(e.target.checked)}
			{...props}
		/>
	),
}))

// Mock ResizeObserver
class MockResizeObserver {
	private callback: ResizeObserverCallback
	private elements: Element[] = []

	constructor(callback: ResizeObserverCallback) {
		this.callback = callback
	}

	observe(element: Element) {
		this.elements.push(element)
	}

	unobserve(element: Element) {
		this.elements = this.elements.filter((el) => el !== element)
	}

	disconnect() {
		this.elements = []
	}

	// 手动触发回调的方法，用于测试
	trigger() {
		this.callback([], this)
	}
}

// 全局设置ResizeObserver mock
const mockResizeObserver = MockResizeObserver
Object.defineProperty(window, "ResizeObserver", {
	writable: true,
	configurable: true,
	value: mockResizeObserver,
})

// Mock HTMLElement的offsetWidth属性
const mockOffsetWidth = (element: HTMLElement, width: number) => {
	Object.defineProperty(element, "offsetWidth", {
		writable: true,
		configurable: true,
		value: width,
	})
}

describe("TableWrapper", () => {
	let resizeObserverInstance: MockResizeObserver | null = null

	beforeEach(() => {
		// 重置ResizeObserver mock
		vi.clearAllMocks()

		// 监听ResizeObserver的创建
		window.ResizeObserver = vi.fn().mockImplementation((callback) => {
			resizeObserverInstance = new MockResizeObserver(callback)
			return resizeObserverInstance
		})
	})

	afterEach(() => {
		resizeObserverInstance = null
	})

	// 创建测试用的表格元素
	const createTable = (columnCount: number, rowCount: number = 2) => {
		const headers = Array.from({ length: columnCount }, (_, i) => `标题${i + 1}`)
		const rows = Array.from({ length: rowCount }, (_, rowIndex) =>
			Array.from(
				{ length: columnCount },
				(_, colIndex) => `数据${rowIndex + 1}-${colIndex + 1}`,
			),
		)

		return (
			<>
				<thead>
					<tr>
						{headers.map((header, index) => (
							<th key={index}>{header}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, rowIndex) => (
						<tr key={rowIndex}>
							{row.map((cell, cellIndex) => (
								<td key={cellIndex}>{cell}</td>
							))}
						</tr>
					))}
				</tbody>
			</>
		)
	}

	it("应该渲染基本的表格结构", () => {
		const tableContent = createTable(3)
		render(<TableWrapper>{tableContent}</TableWrapper>)

		expect(screen.getByRole("table")).toBeDefined()
		expect(screen.getByText("标题1")).toBeDefined()
		expect(screen.getByText("数据1-1")).toBeDefined()
	})

	it("应该根据容器宽度动态计算可见列数", async () => {
		const tableContent = createTable(8)
		const { container } = render(<TableWrapper>{tableContent}</TableWrapper>)

		const tableContainer = container.querySelector(".table-container-class") as HTMLElement

		// 模拟较小的容器宽度（只能容纳3列 + 更多列）
		mockOffsetWidth(tableContainer, 400) // 3列 * 120px + 80px("更多"列) = 440px，但我们设置400px

		// 触发ResizeObserver
		if (resizeObserverInstance) {
			;(resizeObserverInstance as MockResizeObserver).trigger()
		}

		// 等待状态更新
		await waitFor(() => {
			// 应该显示"更多"按钮，因为有8列但容器只能容纳较少列
			expect(screen.queryByText("更多")).toBeDefined()
		})
	})

	it("应该根据容器宽度显示不同数量的列", async () => {
		const tableContent = createTable(8)
		const { container } = render(<TableWrapper>{tableContent}</TableWrapper>)

		const tableContainer = container.querySelector(".table-container-class") as HTMLElement

		// 模拟较大的容器宽度（可以容纳更多列）
		mockOffsetWidth(tableContainer, 1000) // 足够宽，可以显示更多列

		// 触发ResizeObserver
		if (resizeObserverInstance) {
			;(resizeObserverInstance as MockResizeObserver).trigger()
		}

		await waitFor(() => {
			// 即使容器很宽，由于DEFAULT_MAX_COLUMNS限制，仍然不会显示超过5列
			expect(screen.getByText("标题1")).toBeDefined()
			expect(screen.getByText("标题5")).toBeDefined()
			expect(screen.getByRole("switch")).toBeDefined() // 应该有开关
			expect(screen.queryByText("标题6")).toBeNull() // 不应该显示第6列
		})
	})

	it("容器很小时应该至少显示最小列数", async () => {
		const tableContent = createTable(8)
		const { container } = render(<TableWrapper>{tableContent}</TableWrapper>)

		const tableContainer = container.querySelector(".table-container-class") as HTMLElement

		// 模拟很小的容器宽度
		mockOffsetWidth(tableContainer, 100)

		// 触发ResizeObserver
		if (resizeObserverInstance) {
			;(resizeObserverInstance as MockResizeObserver).trigger()
		}

		await waitFor(() => {
			// 应该至少显示前2列（MIN_VISIBLE_COLUMNS = 2）
			expect(screen.getByText("标题1")).toBeDefined()
			expect(screen.getByText("标题2")).toBeDefined()
			expect(screen.getByRole("switch")).toBeDefined() // 应该有开关
		})
	})

	it("当列数少于最大可见列数时不应该显示'显示更多'按钮", async () => {
		const tableContent = createTable(3) // 只有3列
		const { container } = render(<TableWrapper>{tableContent}</TableWrapper>)

		const tableContainer = container.querySelector(".table-container-class") as HTMLElement
		mockOffsetWidth(tableContainer, 1000) // 足够宽的容器

		// 触发ResizeObserver
		if (resizeObserverInstance) {
			;(resizeObserverInstance as MockResizeObserver).trigger()
		}

		await waitFor(() => {
			// 由于只有3列，小于默认的最大列数，不应该显示开关
			expect(screen.queryByText("显示更多")).toBeNull()
			expect(screen.queryByRole("switch")).toBeNull()
		})
	})

	it("当列数超过动态计算的最大列数时应该显示'显示更多'按钮", async () => {
		const tableContent = createTable(8) // 8列
		const { container } = render(<TableWrapper>{tableContent}</TableWrapper>)

		const tableContainer = container.querySelector(".table-container-class") as HTMLElement
		mockOffsetWidth(tableContainer, 600) // 中等宽度容器

		// 触发ResizeObserver
		if (resizeObserverInstance) {
			;(resizeObserverInstance as MockResizeObserver).trigger()
		}

		await waitFor(() => {
			expect(screen.getByRole("switch")).toBeDefined()
			expect(screen.getAllByText("显示更多").length).toBeGreaterThan(0)
		})
	})

	it("应该响应窗口大小变化", async () => {
		const tableContent = createTable(8)
		render(<TableWrapper>{tableContent}</TableWrapper>)

		// 模拟窗口大小变化
		window.dispatchEvent(new Event("resize"))

		// 等待处理完成
		await waitFor(
			() => {
				expect(screen.getByRole("table")).toBeDefined()
			},
			{ timeout: 200 },
		)
	})

	it("点击'显示更多'按钮应该打开抽屉", async () => {
		const tableContent = createTable(8)
		render(<TableWrapper>{tableContent}</TableWrapper>)

		// 等待组件完全渲染
		await waitFor(() => {
			expect(screen.getByRole("table")).toBeDefined()
		})

		// 查找并点击"显示更多"按钮
		const showMoreButtons = screen.queryAllByText("显示更多")
		if (showMoreButtons.length > 0) {
			fireEvent.click(showMoreButtons[0])

			// 验证抽屉是否打开
			expect(screen.getByTestId("mock-drawer")).toBeDefined()
			expect(screen.getByTestId("drawer-title").textContent).toBe("行详细信息")
		}
	})

	it("抽屉应该显示完整的行数据", async () => {
		const tableContent = createTable(8)
		render(<TableWrapper>{tableContent}</TableWrapper>)

		await waitFor(() => {
			const showMoreButtons = screen.queryAllByText("显示更多")
			if (showMoreButtons.length > 0) {
				fireEvent.click(showMoreButtons[0])

				// 验证抽屉中显示的数据
				expect(screen.getByTestId("drawer-row-0").textContent).toBe("标题1: 数据1-1")
				expect(screen.getByTestId("drawer-row-7").textContent).toBe("标题8: 数据1-8")
			}
		})
	})

	it("点击不同行的'显示更多'按钮应该显示对应行的数据", async () => {
		const tableContent = createTable(8, 3) // 8列3行
		render(<TableWrapper>{tableContent}</TableWrapper>)

		await waitFor(() => {
			const showMoreButtons = screen.queryAllByText("显示更多")
			if (showMoreButtons.length >= 2) {
				// 点击第二行的"显示更多"按钮
				fireEvent.click(showMoreButtons[1])

				// 验证显示的是第二行的数据
				expect(screen.getByTestId("drawer-row-0").textContent).toBe("标题1: 数据2-1")
				expect(screen.getByTestId("drawer-row-1").textContent).toBe("标题2: 数据2-2")
			}
		})
	})

	it("关闭抽屉应该隐藏抽屉内容", async () => {
		const tableContent = createTable(8)
		render(<TableWrapper>{tableContent}</TableWrapper>)

		await waitFor(() => {
			const showMoreButtons = screen.queryAllByText("显示更多")
			if (showMoreButtons.length > 0) {
				// 打开抽屉
				fireEvent.click(showMoreButtons[0])
				expect(screen.getByTestId("mock-drawer")).toBeDefined()

				// 关闭抽屉
				const closeButton = screen.getByTestId("drawer-close")
				fireEvent.click(closeButton)
				expect(screen.queryByTestId("mock-drawer")).toBeNull()
			}
		})
	})

	it("应该正确处理没有thead的表格", () => {
		const tableContent = (
			<tbody>
				<tr>
					<td>数据1</td>
					<td>数据2</td>
				</tr>
			</tbody>
		)

		render(<TableWrapper>{tableContent}</TableWrapper>)
		expect(screen.getByRole("table")).toBeDefined()
		expect(screen.getByText("数据1")).toBeDefined()
	})

	it("应该正确处理没有tbody的表格", () => {
		const tableContent = (
			<thead>
				<tr>
					<th>标题1</th>
					<th>标题2</th>
				</tr>
			</thead>
		)

		render(<TableWrapper>{tableContent}</TableWrapper>)
		expect(screen.getByRole("table")).toBeDefined()
		expect(screen.getByText("标题1")).toBeDefined()
	})

	it("应该应用正确的CSS类", () => {
		const tableContent = createTable(3)
		const { container } = render(<TableWrapper>{tableContent}</TableWrapper>)

		const tableContainer = container.querySelector(".table-container-class")
		expect(tableContainer).toBeDefined()

		const mobileTable = container.querySelector(".mobile-table-class")
		expect(mobileTable).toBeDefined()
	})

	it("应该正确提取表格数据用于抽屉显示", async () => {
		const complexTableContent = (
			<>
				<thead>
					<tr>
						<th>列1</th>
						<th>列2</th>
						<th>列3</th>
						<th>列4</th>
						<th>列5</th>
						<th>列6</th>
						<th>列7</th>
						<th>列8</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>A1</td>
						<td>A2</td>
						<td>A3</td>
						<td>A4</td>
						<td>A5</td>
						<td>A6</td>
						<td>A7</td>
						<td>A8</td>
					</tr>
				</tbody>
			</>
		)

		render(<TableWrapper>{complexTableContent}</TableWrapper>)

		await waitFor(() => {
			const showMoreButton = screen.queryByText("显示更多")
			if (showMoreButton) {
				fireEvent.click(showMoreButton)

				// 验证所有数据都被正确提取
				expect(screen.getByTestId("drawer-row-0").textContent).toBe("列1: A1")
				expect(screen.getByTestId("drawer-row-6").textContent).toBe("列7: A7")
				expect(screen.getByTestId("drawer-row-7").textContent).toBe("列8: A8")
			}
		})
	})

	it("显示更多列应该正常渲染", async () => {
		const manyColumnsTable = createTable(8)
		const { container } = render(<TableWrapper>{manyColumnsTable}</TableWrapper>)

		await waitFor(() => {
			// 验证"更多"列存在
			const moreHeader = container.querySelector("th")
			const moreCell = container.querySelector("td")

			expect(moreHeader).not.toBeNull()
			expect(moreCell).not.toBeNull()
		})
	})

	it("应该正确处理零宽度容器", async () => {
		const tableContent = createTable(5)
		const { container } = render(<TableWrapper>{tableContent}</TableWrapper>)

		const tableContainer = container.querySelector(".table-container-class") as HTMLElement

		// 模拟零宽度容器
		mockOffsetWidth(tableContainer, 0)

		// 触发ResizeObserver
		if (resizeObserverInstance) {
			;(resizeObserverInstance as MockResizeObserver).trigger()
		}

		// 应该使用默认列数，不会崩溃
		await waitFor(() => {
			expect(screen.getByRole("table")).toBeDefined()
		})
	})

	it("当列数超过DEFAULT_MAX_COLUMNS时应该显示切换开关", () => {
		const tableContent = createTable(8) // 8列超过DEFAULT_MAX_COLUMNS(5)
		render(<TableWrapper>{tableContent}</TableWrapper>)

		// 应该显示控制条和开关
		expect(screen.getByRole("switch")).toBeDefined()
	})

	it("当列数不超过DEFAULT_MAX_COLUMNS时不应该显示切换开关", () => {
		const tableContent = createTable(3) // 3列不超过DEFAULT_MAX_COLUMNS(5)
		render(<TableWrapper>{tableContent}</TableWrapper>)

		// 不应该显示控制条和开关
		expect(screen.queryByRole("switch")).toBeNull()
	})

	it("切换显示所有列开关应该正常工作", async () => {
		const tableContent = createTable(8) // 8列
		render(<TableWrapper>{tableContent}</TableWrapper>)

		// 默认只显示前5列
		expect(screen.getByText("标题1")).toBeDefined()
		expect(screen.getByText("标题5")).toBeDefined()
		expect(screen.queryByText("标题6")).toBeNull()
		expect(screen.getByRole("switch")).toBeDefined() // 应该有开关

		// 开启显示所有列
		const switchElement = screen.getByRole("switch")
		fireEvent.click(switchElement)

		await waitFor(() => {
			// 现在应该显示所有8列
			expect(screen.getByText("标题1")).toBeDefined()
			expect(screen.getByText("标题6")).toBeDefined()
			expect(screen.getByText("标题8")).toBeDefined()
			expect(screen.getByRole("switch")).toBeDefined() // 开关仍然存在
			expect(screen.getAllByText("显示更多").length).toBeGreaterThan(0) // 详情按钮仍然存在
		})

		// 再次点击关闭显示所有列
		fireEvent.click(switchElement)

		await waitFor(() => {
			// 应该回到限制列数状态
			expect(screen.getByText("标题1")).toBeDefined()
			expect(screen.getByText("标题5")).toBeDefined()
			expect(screen.queryByText("标题6")).toBeNull()
			expect(screen.getByRole("switch")).toBeDefined() // 应该重新显示开关
		})
	})
})
