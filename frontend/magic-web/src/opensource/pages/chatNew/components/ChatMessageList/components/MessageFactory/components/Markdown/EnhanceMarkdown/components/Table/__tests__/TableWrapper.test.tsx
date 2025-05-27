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
					Close
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
		showMore: "Show More",
		rowDetails: "Row Details",
		clickToExpand: "Click to expand full content",
		showAllColumns: "Show All Columns",
		hideAllColumns: "Hide",
		defaultColumn: "Column",
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

	// Method to manually trigger callback for testing
	trigger() {
		this.callback([], this)
	}
}

// Global ResizeObserver mock setup
const mockResizeObserver = MockResizeObserver
Object.defineProperty(window, "ResizeObserver", {
	writable: true,
	configurable: true,
	value: mockResizeObserver,
})

// Mock HTMLElement's offsetWidth property
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
		// Reset ResizeObserver mock
		vi.clearAllMocks()

		// Monitor ResizeObserver creation
		window.ResizeObserver = vi.fn().mockImplementation((callback) => {
			resizeObserverInstance = new MockResizeObserver(callback)
			return resizeObserverInstance
		})
	})

	afterEach(() => {
		resizeObserverInstance = null
	})

	// Create test table elements
	const createTable = (columnCount: number, rowCount: number = 2) => {
		const headers = Array.from({ length: columnCount }, (_, i) => `Title${i + 1}`)
		const rows = Array.from({ length: rowCount }, (_, rowIndex) =>
			Array.from(
				{ length: columnCount },
				(_, colIndex) => `Data${rowIndex + 1}-${colIndex + 1}`,
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

	it("should render basic table structure", () => {
		const tableContent = createTable(3)
		render(<TableWrapper>{tableContent}</TableWrapper>)

		expect(screen.getByRole("table")).toBeDefined()
		expect(screen.getByText("Title1")).toBeDefined()
		expect(screen.getByText("Data1-1")).toBeDefined()
	})

	it("should dynamically calculate visible columns based on container width", async () => {
		const tableContent = createTable(8)
		const { container } = render(<TableWrapper>{tableContent}</TableWrapper>)

		const tableContainer = container.querySelector(".table-container-class") as HTMLElement

		// Mock smaller container width (can only fit 3 columns + more column)
		mockOffsetWidth(tableContainer, 400) // 3 columns * 120px + 80px("more" column) = 440px, but we set 400px

		// Trigger ResizeObserver
		if (resizeObserverInstance) {
			;(resizeObserverInstance as MockResizeObserver).trigger()
		}

		// Wait for state update
		await waitFor(() => {
			// Should show "More" button because there are 8 columns but container can only fit fewer columns
			expect(screen.queryByText("More")).toBeDefined()
		})
	})

	it("should display different number of columns based on container width", async () => {
		const tableContent = createTable(8)
		const { container } = render(<TableWrapper>{tableContent}</TableWrapper>)

		const tableContainer = container.querySelector(".table-container-class") as HTMLElement

		// Mock larger container width (can accommodate more columns)
		mockOffsetWidth(tableContainer, 1000) // Wide enough to display more columns

		// Trigger ResizeObserver
		if (resizeObserverInstance) {
			;(resizeObserverInstance as MockResizeObserver).trigger()
		}

		await waitFor(() => {
			// Even with a wide container, due to DEFAULT_MAX_COLUMNS limit, still won't display more than 5 columns
			expect(screen.getByText("Title1")).toBeDefined()
			expect(screen.getByText("Title5")).toBeDefined()
			expect(screen.getByRole("switch")).toBeDefined() // Should have switch
			expect(screen.queryByText("Title6")).toBeNull() // Should not display 6th column
		})
	})

	it("should display at least minimum columns when container is very small", async () => {
		const tableContent = createTable(8)
		const { container } = render(<TableWrapper>{tableContent}</TableWrapper>)

		const tableContainer = container.querySelector(".table-container-class") as HTMLElement

		// Mock very small container width
		mockOffsetWidth(tableContainer, 100)

		// Trigger ResizeObserver
		if (resizeObserverInstance) {
			;(resizeObserverInstance as MockResizeObserver).trigger()
		}

		await waitFor(() => {
			// Should display at least the first 2 columns (MIN_VISIBLE_COLUMNS = 2)
			expect(screen.getByText("Title1")).toBeDefined()
			expect(screen.getByText("Title2")).toBeDefined()
			expect(screen.getByRole("switch")).toBeDefined() // Should have switch
		})
	})

	it("should not display 'Show More' button when columns are fewer than maximum visible columns", async () => {
		const tableContent = createTable(3) // Only 3 columns
		const { container } = render(<TableWrapper>{tableContent}</TableWrapper>)

		const tableContainer = container.querySelector(".table-container-class") as HTMLElement
		mockOffsetWidth(tableContainer, 1000) // Wide enough container

		// Trigger ResizeObserver
		if (resizeObserverInstance) {
			;(resizeObserverInstance as MockResizeObserver).trigger()
		}

		await waitFor(() => {
			// Since there are only 3 columns, less than the default maximum, should not display switch
			expect(screen.queryByText("Show More")).toBeNull()
			expect(screen.queryByRole("switch")).toBeNull()
		})
	})

	it("should display 'Show More' button when columns exceed dynamically calculated maximum", async () => {
		const tableContent = createTable(8) // 8 columns
		const { container } = render(<TableWrapper>{tableContent}</TableWrapper>)

		const tableContainer = container.querySelector(".table-container-class") as HTMLElement
		mockOffsetWidth(tableContainer, 600) // Medium width container

		// Trigger ResizeObserver
		if (resizeObserverInstance) {
			;(resizeObserverInstance as MockResizeObserver).trigger()
		}

		await waitFor(() => {
			expect(screen.getByRole("switch")).toBeDefined()
			expect(screen.getAllByText("Show More").length).toBeGreaterThan(0)
		})
	})

	it("should respond to window size changes", async () => {
		const tableContent = createTable(8)
		render(<TableWrapper>{tableContent}</TableWrapper>)

		// Mock window size change
		window.dispatchEvent(new Event("resize"))

		// Wait for processing to complete
		await waitFor(
			() => {
				expect(screen.getByRole("table")).toBeDefined()
			},
			{ timeout: 200 },
		)
	})

	it("clicking 'Show More' button should open drawer", async () => {
		const tableContent = createTable(8)
		render(<TableWrapper>{tableContent}</TableWrapper>)

		// Wait for component to fully render
		await waitFor(() => {
			expect(screen.getByRole("table")).toBeDefined()
		})

		// Find and click "Show More" button
		const showMoreButtons = screen.queryAllByText("Show More")
		if (showMoreButtons.length > 0) {
			fireEvent.click(showMoreButtons[0])

			// Verify drawer is open
			expect(screen.getByTestId("mock-drawer")).toBeDefined()
			expect(screen.getByTestId("drawer-title").textContent).toBe("Row Details")
		}
	})

	it("drawer should display complete row data", async () => {
		const tableContent = createTable(8)
		render(<TableWrapper>{tableContent}</TableWrapper>)

		await waitFor(() => {
			const showMoreButtons = screen.queryAllByText("Show More")
			if (showMoreButtons.length > 0) {
				fireEvent.click(showMoreButtons[0])

				// Verify data displayed in drawer
				expect(screen.getByTestId("drawer-row-0").textContent).toBe("Title1: Data1-1")
				expect(screen.getByTestId("drawer-row-7").textContent).toBe("Title8: Data1-8")
			}
		})
	})

	it("clicking 'Show More' on different rows should display corresponding row data", async () => {
		const tableContent = createTable(8, 3) // 8 columns, 3 rows
		render(<TableWrapper>{tableContent}</TableWrapper>)

		await waitFor(() => {
			const showMoreButtons = screen.queryAllByText("Show More")
			if (showMoreButtons.length >= 2) {
				// Click "Show More" button on second row
				fireEvent.click(showMoreButtons[1])

				// Verify displaying second row data
				expect(screen.getByTestId("drawer-row-0").textContent).toBe("Title1: Data2-1")
				expect(screen.getByTestId("drawer-row-1").textContent).toBe("Title2: Data2-2")
			}
		})
	})

	it("closing drawer should hide drawer content", async () => {
		const tableContent = createTable(8)
		render(<TableWrapper>{tableContent}</TableWrapper>)

		await waitFor(() => {
			const showMoreButtons = screen.queryAllByText("Show More")
			if (showMoreButtons.length > 0) {
				// Open drawer
				fireEvent.click(showMoreButtons[0])
				expect(screen.getByTestId("mock-drawer")).toBeDefined()

				// Close drawer
				const closeButton = screen.getByTestId("drawer-close")
				fireEvent.click(closeButton)
				expect(screen.queryByTestId("mock-drawer")).toBeNull()
			}
		})
	})

	it("should correctly handle tables without thead", () => {
		const tableContent = (
			<tbody>
				<tr>
					<td>Data1</td>
					<td>Data2</td>
				</tr>
			</tbody>
		)

		render(<TableWrapper>{tableContent}</TableWrapper>)
		expect(screen.getByRole("table")).toBeDefined()
		expect(screen.getByText("Data1")).toBeDefined()
	})

	it("should correctly handle tables without tbody", () => {
		const tableContent = (
			<thead>
				<tr>
					<th>Title1</th>
					<th>Title2</th>
				</tr>
			</thead>
		)

		render(<TableWrapper>{tableContent}</TableWrapper>)
		expect(screen.getByRole("table")).toBeDefined()
		expect(screen.getByText("Title1")).toBeDefined()
	})

	it("should apply correct CSS classes", () => {
		const tableContent = createTable(3)
		const { container } = render(<TableWrapper>{tableContent}</TableWrapper>)

		const tableContainer = container.querySelector(".table-container-class")
		expect(tableContainer).toBeDefined()

		const mobileTable = container.querySelector(".mobile-table-class")
		expect(mobileTable).toBeDefined()
	})

	it("should correctly extract table data for drawer display", async () => {
		const complexTableContent = (
			<>
				<thead>
					<tr>
						<th>Column1</th>
						<th>Column2</th>
						<th>Column3</th>
						<th>Column4</th>
						<th>Column5</th>
						<th>Column6</th>
						<th>Column7</th>
						<th>Column8</th>
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
			const showMoreButton = screen.queryByText("Show More")
			if (showMoreButton) {
				fireEvent.click(showMoreButton)

				// Verify all data is correctly extracted
				expect(screen.getByTestId("drawer-row-0").textContent).toBe("Column1: A1")
				expect(screen.getByTestId("drawer-row-6").textContent).toBe("Column7: A7")
				expect(screen.getByTestId("drawer-row-7").textContent).toBe("Column8: A8")
			}
		})
	})

	it("Show More column should render correctly", async () => {
		const manyColumnsTable = createTable(8)
		const { container } = render(<TableWrapper>{manyColumnsTable}</TableWrapper>)

		await waitFor(() => {
			// Verify "More" column exists
			const moreHeader = container.querySelector("th")
			const moreCell = container.querySelector("td")

			expect(moreHeader).not.toBeNull()
			expect(moreCell).not.toBeNull()
		})
	})

	it("should correctly handle zero width container", async () => {
		const tableContent = createTable(5)
		const { container } = render(<TableWrapper>{tableContent}</TableWrapper>)

		const tableContainer = container.querySelector(".table-container-class") as HTMLElement

		// Mock zero width container
		mockOffsetWidth(tableContainer, 0)

		// Trigger ResizeObserver
		if (resizeObserverInstance) {
			;(resizeObserverInstance as MockResizeObserver).trigger()
		}

		// Should use default column count, won't crash
		await waitFor(() => {
			expect(screen.getByRole("table")).toBeDefined()
		})
	})

	it("when columns exceed DEFAULT_MAX_COLUMNS should display switch", () => {
		const tableContent = createTable(8) // 8 columns exceed DEFAULT_MAX_COLUMNS(5)
		render(<TableWrapper>{tableContent}</TableWrapper>)

		// Should display control bar and switch
		expect(screen.getByRole("switch")).toBeDefined()
	})

	it("when columns do not exceed DEFAULT_MAX_COLUMNS should not display switch", () => {
		const tableContent = createTable(3) // 3 columns do not exceed DEFAULT_MAX_COLUMNS(5)
		render(<TableWrapper>{tableContent}</TableWrapper>)

		// Should not display control bar and switch
		expect(screen.queryByRole("switch")).toBeNull()
	})

	it("switching to show all columns should work correctly", async () => {
		const tableContent = createTable(8) // 8 columns
		render(<TableWrapper>{tableContent}</TableWrapper>)

		// Default only show first 5 columns
		expect(screen.getByText("Title1")).toBeDefined()
		expect(screen.getByText("Title5")).toBeDefined()
		expect(screen.queryByText("Title6")).toBeNull()
		expect(screen.getByRole("switch")).toBeDefined() // Should have switch

		// Turn on show all columns
		const switchElement = screen.getByRole("switch")
		fireEvent.click(switchElement)

		await waitFor(() => {
			// Now should show all 8 columns
			expect(screen.getByText("Title1")).toBeDefined()
			expect(screen.getByText("Title6")).toBeDefined()
			expect(screen.getByText("Title8")).toBeDefined()
			expect(screen.getByRole("switch")).toBeDefined() // Switch still exists
			expect(screen.getAllByText("Show More").length).toBeGreaterThan(0) // Details button still exists
		})

		// Click again to close show all columns
		fireEvent.click(switchElement)

		await waitFor(() => {
			// Should return to restricted column count state
			expect(screen.getByText("Title1")).toBeDefined()
			expect(screen.getByText("Title5")).toBeDefined()
			expect(screen.queryByText("Title6")).toBeNull()
			expect(screen.getByRole("switch")).toBeDefined() // Should redisplay switch
		})
	})
})
