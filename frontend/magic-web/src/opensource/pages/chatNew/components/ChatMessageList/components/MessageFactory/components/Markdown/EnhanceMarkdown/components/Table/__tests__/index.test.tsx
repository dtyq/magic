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
		value: 800, // Default width, enough to display 6 columns
	})
})

// Mock react-i18next
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const translations: Record<string, string> = {
				"markdownTable.showMore": "Show More",
				"markdownTable.rowDetails": "Row Details",
				"markdownTable.clickToExpand": "Click to expand full content",
				"markdownTable.showAllColumns": "Show All Columns",
				"markdownTable.hideAllColumns": "Hide",
				"markdownTable.defaultColumn": "Column",
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

describe("Table Module Integration Tests", () => {
	it("should correctly export all components and hooks", () => {
		expect(TableWrapper).toBeDefined()
		expect(TableCell).toBeDefined()
		expect(RowDetailDrawer).toBeDefined()
		expect(useTableI18n).toBeDefined()
		expect(useTableStyles).toBeDefined()
	})

	it("TableWrapper and TableCell should work together", () => {
		const tableContent = (
			<>
				<thead>
					<tr>
						<TableCell isHeader>Title 1</TableCell>
						<TableCell isHeader>Title 2</TableCell>
						<TableCell isHeader>Title 3</TableCell>
					</tr>
				</thead>
				<tbody>
					<tr>
						<TableCell>Data 1</TableCell>
						<TableCell>Data 2</TableCell>
						<TableCell>Data 3</TableCell>
					</tr>
				</tbody>
			</>
		)

		render(<TableWrapper>{tableContent}</TableWrapper>)

		expect(screen.getByText("Title 1")).toBeDefined()
		expect(screen.getByText("Data 1")).toBeDefined()
	})

	it("complete table functionality flow test", () => {
		// Create a table with many columns to test complete flow
		const manyColumnsTable = (
			<>
				<thead>
					<tr>
						{Array.from({ length: 8 }, (_, i) => (
							<TableCell key={i} isHeader>
								Column {i + 1}
							</TableCell>
						))}
					</tr>
				</thead>
				<tbody>
					<tr>
						{Array.from({ length: 8 }, (_, i) => (
							<TableCell key={i}>Content {i + 1}</TableCell>
						))}
					</tr>
				</tbody>
			</>
		)

		render(<TableWrapper>{manyColumnsTable}</TableWrapper>)

		// Verify only first 5 columns are displayed
		expect(screen.getByText("Column 1")).toBeDefined()
		expect(screen.getByText("Column 5")).toBeDefined()
		expect(screen.queryByText("Column 6")).toBeNull()
		expect(screen.queryByText("Column 7")).toBeNull()
		expect(screen.queryByText("Column 8")).toBeNull()

		// Verify "Show More" button exists
		expect(screen.getByText("Show More")).toBeDefined() // Data row

		// Click "Show More"
		fireEvent.click(screen.getByText("Show More"))

		// Verify drawer opens and displays complete data
		expect(screen.getByTestId("drawer")).toBeDefined()
		expect(screen.getByTestId("drawer-title").textContent).toBe("Row Details")

		// Verify drawer displays all data
		const formItems = screen.getAllByTestId("form-item")
		expect(formItems).toHaveLength(8) // Should display all 8 columns of data

		// Close drawer
		fireEvent.click(screen.getByTestId("drawer-close"))
		expect(screen.queryByTestId("drawer")).toBeNull()
	})

	it("TableCell long text functionality should work properly", () => {
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

		// Verify long text has click hint
		const longTextElement = screen.getByTitle("Click to expand full content")
		expect(longTextElement).toBeDefined()

		// Click to expand
		fireEvent.click(longTextElement)

		// Should not have title after expansion
		expect(longTextElement.title).toBe("")
	})

	it("internationalization hook should work properly", () => {
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

		expect(screen.getByTestId("show-more").textContent).toBe("Show More")
		expect(screen.getByTestId("row-details").textContent).toBe("Row Details")
		expect(screen.getByTestId("click-to-expand").textContent).toBe("Click to expand full content")
		expect(screen.getByTestId("show-all-columns").textContent).toBe("Show All Columns")
	})

	it("style hook should work properly", () => {
		const TestComponent = () => {
			const { styles, cx } = useTableStyles()
			return <div className={cx(styles.tableContainer, styles.mobileTable)}>Test Style</div>
		}

		const { container } = render(<TestComponent />)
		const styledDiv = container.querySelector(".table-container.mobile-table")
		expect(styledDiv).toBeDefined()
	})

	it("RowDetailDrawer should work independently", () => {
		const rowData = {
			0: "First Column",
			1: "Second Column",
			"First Column": "First Column",
			"Second Column": "Second Column",
		}

		const headers = ["名称", "描述"]

		render(
			<RowDetailDrawer
				visible={true}
				onClose={vi.fn()}
				rowData={rowData}
				headers={headers}
				title="Test Drawer"
			/>,
		)

		expect(screen.getByTestId("drawer")).toBeDefined()
		expect(screen.getByTestId("drawer-title").textContent).toBe("Test Drawer")

		const formItems = screen.getAllByTestId("form-item")
		expect(formItems).toHaveLength(2)
	})

	it("all components should support empty props", () => {
		expect(() => {
			render(<TableCell />)
			render(<RowDetailDrawer visible={false} onClose={vi.fn()} rowData={{}} headers={[]} />)
		}).not.toThrow()
	})

	it("complex table structure complete test", () => {
		// Simulate real markdown table content
		const complexTable = (
			<>
				<thead>
					<tr>
						<TableCell isHeader>Name</TableCell>
						<TableCell isHeader>Age</TableCell>
						<TableCell isHeader>Position</TableCell>
						<TableCell isHeader>Department</TableCell>
						<TableCell isHeader>Email</TableCell>
						<TableCell isHeader>Phone</TableCell>
						<TableCell isHeader>Address</TableCell>
						<TableCell isHeader>Note</TableCell>
					</tr>
				</thead>
				<tbody>
					<tr>
						<TableCell>Zhang San</TableCell>
						<TableCell>28</TableCell>
						<TableCell>
							This is a very long position description information, containing many detailed description content, used to test the long text processing function, so that it can ensure more than 50 characters
						</TableCell>
						<TableCell>Technology Department</TableCell>
						<TableCell>zhangsan@example.com</TableCell>
						<TableCell>13800138000</TableCell>
						<TableCell>Beijing Haidian District Zhongguancun Street 1</TableCell>
						<TableCell>Short Note</TableCell>
					</tr>
					<tr>
						<TableCell>Li Si</TableCell>
						<TableCell>32</TableCell>
						<TableCell>Backend Engineer</TableCell>
						<TableCell>Technology Department</TableCell>
						<TableCell>lisi@example.com</TableCell>
						<TableCell>13900139000</TableCell>
						<TableCell>Shanghai Pudong New Area Lujiazui Ring Road 1000</TableCell>
						<TableCell>Short Note</TableCell>
					</tr>
				</tbody>
			</>
		)

		render(<TableWrapper>{complexTable}</TableWrapper>)

		// Verify table basic functionality
		expect(screen.getByText("Name")).toBeDefined()
		expect(screen.getByText("Zhang San")).toBeDefined()

		// Verify long text processing
		const longTextElement = screen.getByTitle("Click to expand full content")
		expect(longTextElement).toBeDefined()

		// Verify "Show More" functionality
		const showMoreButtons = screen.getAllByText("Show More")
		expect(showMoreButtons).toHaveLength(2) // Two rows of data

		// Click "Show More" on the first row
		fireEvent.click(showMoreButtons[0])

		// Verify drawer displays the first row data
		expect(screen.getByTestId("drawer")).toBeDefined()
		const formContents = screen.getAllByTestId("form-content")
		expect(formContents[0].textContent).toBe("Zhang San")
		expect(formContents[1].textContent).toBe("28")
	})
})
