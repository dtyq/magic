import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import RowDetailDrawer from "../RowDetailDrawer"

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
}))

// Mock styles
vi.mock("../styles", () => ({
	useTableStyles: () => ({
		styles: {
			detailForm: "detail-form-class",
			formValueContent: "form-value-content-class",
		},
	}),
}))

describe("RowDetailDrawer", () => {
	const mockRowData = {
		0: "第一列数据",
		1: "第二列数据",
		2: "第三列数据",
		名称: "第一列数据",
		描述: "第二列数据",
		状态: "第三列数据",
	}

	const mockHeaders = ["名称", "描述", "状态"]

	it("应该在visible为true时渲染抽屉", () => {
		render(
			<RowDetailDrawer
				visible={true}
				onClose={vi.fn()}
				rowData={mockRowData}
				headers={mockHeaders}
				title="行详情"
			/>,
		)

		expect(screen.getByTestId("drawer")).toBeDefined()
		expect(screen.getByTestId("drawer-title")).toBeDefined()
		expect(screen.getByTestId("drawer-title").textContent).toBe("行详情")
	})

	it("应该在visible为false时不渲染抽屉", () => {
		render(
			<RowDetailDrawer
				visible={false}
				onClose={vi.fn()}
				rowData={mockRowData}
				headers={mockHeaders}
			/>,
		)

		expect(screen.queryByTestId("drawer")).toBeNull()
	})

	it("应该使用默认标题", () => {
		render(
			<RowDetailDrawer
				visible={true}
				onClose={vi.fn()}
				rowData={mockRowData}
				headers={mockHeaders}
			/>,
		)

		expect(screen.getByTestId("drawer-title").textContent).toBe("详细信息")
	})

	it("应该正确渲染表单项", () => {
		render(
			<RowDetailDrawer
				visible={true}
				onClose={vi.fn()}
				rowData={mockRowData}
				headers={mockHeaders}
			/>,
		)

		const formItems = screen.getAllByTestId("form-item")
		expect(formItems).toHaveLength(3)

		const labels = screen.getAllByTestId("form-label")
		expect(labels[0].textContent).toBe("名称")
		expect(labels[1].textContent).toBe("描述")
		expect(labels[2].textContent).toBe("状态")

		const contents = screen.getAllByTestId("form-content")
		expect(contents[0].textContent).toBe("第一列数据")
		expect(contents[1].textContent).toBe("第二列数据")
		expect(contents[2].textContent).toBe("第三列数据")
	})

	it("应该处理缺失的数据", () => {
		const incompleteRowData = {
			0: "第一列数据",
			名称: "第一列数据",
		}

		render(
			<RowDetailDrawer
				visible={true}
				onClose={vi.fn()}
				rowData={incompleteRowData}
				headers={["名称", "描述", "状态"]}
			/>,
		)

		const contents = screen.getAllByTestId("form-content")
		expect(contents[0].textContent).toBe("第一列数据")
		expect(contents[1].textContent).toBe("") // 缺失数据显示为空
		expect(contents[2].textContent).toBe("") // 缺失数据显示为空
	})

	it("应该正确调用onClose回调", () => {
		const mockOnClose = vi.fn()

		render(
			<RowDetailDrawer
				visible={true}
				onClose={mockOnClose}
				rowData={mockRowData}
				headers={mockHeaders}
			/>,
		)

		const closeButton = screen.getByTestId("drawer-close")
		fireEvent.click(closeButton)

		expect(mockOnClose).toHaveBeenCalledTimes(1)
	})

	it("应该处理空的headers数组", () => {
		render(
			<RowDetailDrawer visible={true} onClose={vi.fn()} rowData={mockRowData} headers={[]} />,
		)

		const formItems = screen.queryAllByTestId("form-item")
		expect(formItems).toHaveLength(0)
	})

	it("应该处理React节点作为值", () => {
		const rowDataWithJSX = {
			0: <span>JSX内容</span>,
			名称: <span>JSX内容</span>,
		}

		render(
			<RowDetailDrawer
				visible={true}
				onClose={vi.fn()}
				rowData={rowDataWithJSX}
				headers={["名称"]}
			/>,
		)

		expect(screen.getByText("JSX内容")).toBeDefined()
	})

	it("应该优先使用索引键获取数据", () => {
		const conflictRowData = {
			0: "索引数据",
			名称: "名称数据",
		}

		render(
			<RowDetailDrawer
				visible={true}
				onClose={vi.fn()}
				rowData={conflictRowData}
				headers={["名称"]}
			/>,
		)

		const content = screen.getByTestId("form-content")
		expect(content.textContent).toBe("索引数据") // 应该优先使用索引0的值
	})
})
