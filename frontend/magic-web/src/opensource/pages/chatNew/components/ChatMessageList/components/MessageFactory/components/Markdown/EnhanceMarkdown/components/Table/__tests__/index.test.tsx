import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import React from "react"
// @ts-ignore
import { TableWrapper, TableCell, RowDetailDrawer, useTableI18n, useTableStyles } from "../index"

// Mock ResizeObserver
class MockResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

Object.defineProperty(window, "ResizeObserver", {
	writable: true,
	configurable: true,
	value: MockResizeObserver,
})

// Mock HTMLElement offsetWidth
beforeEach(() => {
	Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
		writable: true,
		configurable: true,
		value: 800, // 默认宽度，足够显示6列
	})
})

// Mock react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
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
	}),
}))

// Mock antd components
vi.mock("antd", () => ({
	Drawer: ({ children, title, open, onClose }: any) => {
		return open ? (
			<div data-testid="drawer">
				<div data-testid="drawer-title">{title}</div>
				<button data-testid="drawer-close" onClick={onClose}>
					关闭
				</button>
				{children}
			</div>
		) : null
	},
	Form: {
		Item: ({ children, label }: any) => (
			<div data-testid="form-item">
				<div data-testid="form-label">{label}</div>
				<div data-testid="form-content">{children}</div>
			</div>
		),
	},
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

// Mock antd-style
vi.mock("antd-style", () => ({
	createStyles: () => () => ({
		styles: {
			tableContainer: "table-container",
			mobileTable: "mobile-table",
			showMoreButton: "show-more-button",
			formValueContent: "form-value-content",
			longText: "long-text",
			detailForm: "detail-form",
		},
		cx: (...classes: any[]) => classes.filter(Boolean).join(" "),
	}),
}))

describe("Table 模块集成测试", () => {
	it("应该正确导出所有组件和hooks", () => {
		expect(TableWrapper).toBeDefined()
		expect(TableCell).toBeDefined()
		expect(RowDetailDrawer).toBeDefined()
		expect(useTableI18n).toBeDefined()
		expect(useTableStyles).toBeDefined()
	})

	it("TableWrapper 和 TableCell 应该协同工作", () => {
		const tableContent = (
			<>
				<thead>
					<tr>
						<TableCell isHeader>标题1</TableCell>
						<TableCell isHeader>标题2</TableCell>
						<TableCell isHeader>标题3</TableCell>
					</tr>
				</thead>
				<tbody>
					<tr>
						<TableCell>数据1</TableCell>
						<TableCell>数据2</TableCell>
						<TableCell>数据3</TableCell>
					</tr>
				</tbody>
			</>
		)

		render(<TableWrapper>{tableContent}</TableWrapper>)

		expect(screen.getByText("标题1")).toBeDefined()
		expect(screen.getByText("数据1")).toBeDefined()
	})

	it("完整的表格功能流程测试", () => {
		// 创建一个有很多列的表格来测试完整流程
		const manyColumnsTable = (
			<>
				<thead>
					<tr>
						{Array.from({ length: 8 }, (_, i) => (
							<TableCell key={i} isHeader>
								列{i + 1}
							</TableCell>
						))}
					</tr>
				</thead>
				<tbody>
					<tr>
						{Array.from({ length: 8 }, (_, i) => (
							<TableCell key={i}>数据{i + 1}</TableCell>
						))}
					</tr>
				</tbody>
			</>
		)

		render(<TableWrapper>{manyColumnsTable}</TableWrapper>)

		// 验证只显示前5列
		expect(screen.getByText("列1")).toBeDefined()
		expect(screen.getByText("列5")).toBeDefined()
		expect(screen.queryByText("列6")).toBeNull()
		expect(screen.queryByText("列7")).toBeNull()
		expect(screen.queryByText("列8")).toBeNull()

		// 验证有"显示更多"按钮
		expect(screen.getByText("显示更多")).toBeDefined() // 数据行

		// 点击"显示更多"
		fireEvent.click(screen.getByText("显示更多"))

		// 验证抽屉打开并显示完整数据
		expect(screen.getByTestId("drawer")).toBeDefined()
		expect(screen.getByTestId("drawer-title").textContent).toBe("行详细信息")

		// 验证抽屉中显示所有数据
		const formItems = screen.getAllByTestId("form-item")
		expect(formItems).toHaveLength(8) // 应该显示所有8列的数据

		// 关闭抽屉
		fireEvent.click(screen.getByTestId("drawer-close"))
		expect(screen.queryByTestId("drawer")).toBeNull()
	})

	it("TableCell 长文本功能应该正常工作", () => {
		const longText =
			"这是一个非常长的文本内容，超过了50个字符的阈值，应该被包装在长文本组件中进行处理，点击可以展开，这样就能确保超过50个字符了"

		render(
			<table>
				<tbody>
					<tr>
						<TableCell>{longText}</TableCell>
					</tr>
				</tbody>
			</table>,
		)

		// 验证长文本有点击提示
		const longTextElement = screen.getByTitle("点击展开完整内容")
		expect(longTextElement).toBeDefined()

		// 点击展开
		fireEvent.click(longTextElement)

		// 展开后应该没有title
		expect(longTextElement.title).toBe("")
	})

	it("国际化hook应该正常工作", () => {
		const TestComponent = () => {
			const i18n = useTableI18n()
			return (
				<div>
					<div data-testid="show-more">{i18n.showMore}</div>
					<div data-testid="row-details">{i18n.rowDetails}</div>
					<div data-testid="click-to-expand">{i18n.clickToExpand}</div>
					<div data-testid="show-all-columns">{i18n.showAllColumns}</div>
				</div>
			)
		}

		render(<TestComponent />)

		expect(screen.getByTestId("show-more").textContent).toBe("显示更多")
		expect(screen.getByTestId("row-details").textContent).toBe("行详细信息")
		expect(screen.getByTestId("click-to-expand").textContent).toBe("点击展开完整内容")
		expect(screen.getByTestId("show-all-columns").textContent).toBe("显示所有列")
	})

	it("样式hook应该正常工作", () => {
		const TestComponent = () => {
			const { styles, cx } = useTableStyles()
			return <div className={cx(styles.tableContainer, styles.mobileTable)}>测试样式</div>
		}

		const { container } = render(<TestComponent />)
		const styledDiv = container.querySelector(".table-container.mobile-table")
		expect(styledDiv).toBeDefined()
	})

	it("RowDetailDrawer 应该独立正常工作", () => {
		const rowData = {
			0: "第一列",
			1: "第二列",
			名称: "第一列",
			描述: "第二列",
		}

		const headers = ["名称", "描述"]

		render(
			<RowDetailDrawer
				visible={true}
				onClose={vi.fn()}
				rowData={rowData}
				headers={headers}
				title="测试抽屉"
			/>,
		)

		expect(screen.getByTestId("drawer")).toBeDefined()
		expect(screen.getByTestId("drawer-title").textContent).toBe("测试抽屉")

		const formItems = screen.getAllByTestId("form-item")
		expect(formItems).toHaveLength(2)
	})

	it("所有组件应该支持空props", () => {
		expect(() => {
			render(<TableCell />)
			render(<RowDetailDrawer visible={false} onClose={vi.fn()} rowData={{}} headers={[]} />)
		}).not.toThrow()
	})

	it("复杂表格结构的完整测试", () => {
		// 模拟真实的markdown表格内容
		const complexTable = (
			<>
				<thead>
					<tr>
						<TableCell isHeader>姓名</TableCell>
						<TableCell isHeader>年龄</TableCell>
						<TableCell isHeader>职位</TableCell>
						<TableCell isHeader>部门</TableCell>
						<TableCell isHeader>邮箱</TableCell>
						<TableCell isHeader>电话</TableCell>
						<TableCell isHeader>地址</TableCell>
						<TableCell isHeader>备注</TableCell>
					</tr>
				</thead>
				<tbody>
					<tr>
						<TableCell>张三</TableCell>
						<TableCell>28</TableCell>
						<TableCell>
							这是一个非常长的职位描述信息，包含了很多详细的描述内容，用于测试长文本的处理功能，这样就能确保超过50个字符了
						</TableCell>
						<TableCell>技术部</TableCell>
						<TableCell>zhangsan@example.com</TableCell>
						<TableCell>13800138000</TableCell>
						<TableCell>北京市海淀区中关村大街1号</TableCell>
						<TableCell>简短备注</TableCell>
					</tr>
					<tr>
						<TableCell>李四</TableCell>
						<TableCell>32</TableCell>
						<TableCell>后端工程师</TableCell>
						<TableCell>技术部</TableCell>
						<TableCell>lisi@example.com</TableCell>
						<TableCell>13900139000</TableCell>
						<TableCell>上海市浦东新区陆家嘴环路1000号</TableCell>
						<TableCell>简短备注</TableCell>
					</tr>
				</tbody>
			</>
		)

		render(<TableWrapper>{complexTable}</TableWrapper>)

		// 验证表格基本功能
		expect(screen.getByText("姓名")).toBeDefined()
		expect(screen.getByText("张三")).toBeDefined()

		// 验证长文本处理
		const longTextElement = screen.getByTitle("点击展开完整内容")
		expect(longTextElement).toBeDefined()

		// 验证"显示更多"功能
		const showMoreButtons = screen.getAllByText("显示更多")
		expect(showMoreButtons).toHaveLength(2) // 两行数据

		// 点击第一行的"显示更多"
		fireEvent.click(showMoreButtons[0])

		// 验证抽屉显示的是第一行数据
		expect(screen.getByTestId("drawer")).toBeDefined()
		const formContents = screen.getAllByTestId("form-content")
		expect(formContents[0].textContent).toBe("张三")
		expect(formContents[1].textContent).toBe("28")
	})
})
