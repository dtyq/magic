import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DataTable } from "../../../src/components/data-table"

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("../../../src/hooks/use-is-mobile", () => ({ useIsMobile: () => false }))

const columns = [{ accessorKey: "name", header: "Name" }]
const data = [{ name: "Example" }]

function renderTable(stickyHeader?: boolean, isLoading = false) {
	return render(
		<DataTable
			columns={columns}
			data={data}
			emptyState="Empty"
			stickyHeader={stickyHeader}
			isLoading={isLoading}
		/>,
	)
}

describe("DataTable native sticky header", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"ResizeObserver",
			class {
				observe = vi.fn()
				disconnect = vi.fn()
			},
		)
	})

	afterEach(() => {
		cleanup()
		vi.unstubAllGlobals()
	})

	it("enables sticky headers by default with one accessible table and sorting control", () => {
		renderTable()
		expect(document.querySelector('[data-slot="data-table-sticky-header"]')).not.toBeNull()
		expect(screen.getAllByRole("table")).toHaveLength(1)
		expect(screen.getAllByRole("columnheader")).toHaveLength(1)
		expect(screen.getAllByRole("button", { name: "Name" })).toHaveLength(1)
		expect(screen.getByRole("cell", { name: "Example" })).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Name" }))
		expect(screen.getByRole("button", { name: "Name" })).toHaveAttribute(
			"aria-sort",
			"ascending",
		)
	})

	it("keeps horizontal scrolling synchronized from either viewport", () => {
		renderTable()
		const headerViewport = document.querySelector<HTMLElement>(
			'[data-slot="data-table-sticky-header"]',
		)!
		const bodyViewport = screen.getByRole("cell").closest("table")!.parentElement!
		bodyViewport.scrollLeft = 240
		fireEvent.scroll(bodyViewport)
		expect(headerViewport.scrollLeft).toBe(240)
		// Keyboard focus may scroll the header viewport to reveal an off-screen control.
		headerViewport.scrollLeft = 400
		fireEvent.scroll(headerViewport)
		expect(bodyViewport.scrollLeft).toBe(400)
		fireEvent.wheel(headerViewport, { deltaX: 100 })
		expect(bodyViewport.scrollLeft).toBe(500)
		expect(headerViewport.scrollLeft).toBe(500)
		fireEvent.wheel(headerViewport, { deltaY: 100 })
		expect(bodyViewport.scrollLeft).toBe(500)
	})

	it("allows a table to explicitly disable sticky headers", () => {
		renderTable(false)
		expect(document.querySelector('[data-slot="data-table-sticky-header"]')).toBeNull()
		expect(screen.getByRole("table").tagName).toBe("TABLE")
		expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument()
	})

	it("uses the same header during loading", () => {
		renderTable(true, true)
		expect(screen.getAllByRole("columnheader")).toHaveLength(1)
		expect(
			screen.getByRole("columnheader").closest('[data-slot="data-table-sticky-header"]'),
		).not.toBeNull()
	})
})
