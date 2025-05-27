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
					Close
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

	it("should render drawer when visible is true", () => {
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

	it("should not render drawer when visible is false", () => {
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

	it("should use default title", () => {
		render(
			<RowDetailDrawer
				visible={true}
				onClose={vi.fn()}
				rowData={mockRowData}
				headers={mockHeaders}
			/>,
		)

		expect(screen.getByTestId("drawer-title").textContent).toBe("Details")
	})

	it("should correctly render form items", () => {
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

	it("should handle missing data", () => {
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
		expect(contents[1].textContent).toBe("") // Missing data displays as empty
		expect(contents[2].textContent).toBe("") // Missing data displays as empty
	})

	it("should correctly call onClose callback", () => {
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

	it("should handle empty headers array", () => {
		render(
			<RowDetailDrawer visible={true} onClose={vi.fn()} rowData={mockRowData} headers={[]} />,
		)

		const formItems = screen.queryAllByTestId("form-item")
		expect(formItems).toHaveLength(0)
	})

	it("should handle React nodes as values", () => {
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

	it("should prioritize index keys for data retrieval", () => {
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
		expect(content.textContent).toBe("索引数据") // Should prioritize index 0 value
	})
})
