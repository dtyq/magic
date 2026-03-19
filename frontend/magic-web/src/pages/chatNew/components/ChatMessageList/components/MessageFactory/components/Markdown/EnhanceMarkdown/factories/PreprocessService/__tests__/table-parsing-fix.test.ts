import { describe, it, expect } from "vitest"
import { parseTable } from "../utils"

describe("Table Parsing Fix", () => {
	it("should not create empty columns when parsing markdown tables", () => {
		const header = "| Name | Age | City |"
		const separator = "|------|-----|------|"
		const rows = "| John | 25  | NYC  |\n| Jane | 30  | LA   |"

		const result = parseTable(header, separator, rows)

		// Check that the result doesn't contain empty th or td elements
		expect(result).not.toContain('<th style="text-align:left"></th>')
		expect(result).not.toContain('<td style="text-align:left"></td>')

		// Check that the result contains the correct number of columns (3)
		const headerMatches = result.match(/<th\s[^>]*>/g)
		expect(headerMatches).toHaveLength(3)

		// Check each data row has 3 cells
		const cellMatches = result.match(/<td\s[^>]*>/g)
		expect(cellMatches).toHaveLength(6) // 2 rows × 3 columns = 6 cells
	})

	it("should correctly parse table headers", () => {
		const header = "| Name | Age | City |"
		const separator = "|------|-----|------|"
		const rows = "| John | 25  | NYC  |"

		const result = parseTable(header, separator, rows)

		expect(result).toContain('<th style="text-align:left">Name</th>')
		expect(result).toContain('<th style="text-align:left">Age</th>')
		expect(result).toContain('<th style="text-align:left">City</th>')
	})

	it("should correctly parse table data cells", () => {
		const header = "| Name | Age | City |"
		const separator = "|------|-----|------|"
		const rows = "| John | 25  | NYC  |\n| Jane | 30  | LA   |"

		const result = parseTable(header, separator, rows)

		expect(result).toContain('<td style="text-align:left">John</td>')
		expect(result).toContain('<td style="text-align:left">25</td>')
		expect(result).toContain('<td style="text-align:left">NYC</td>')
		expect(result).toContain('<td style="text-align:left">Jane</td>')
		expect(result).toContain('<td style="text-align:left">30</td>')
		expect(result).toContain('<td style="text-align:left">LA</td>')
	})

	it("should handle tables with alignment correctly", () => {
		const header = "| Left | Center | Right |"
		const separator = "|:-----|:------:|------:|"
		const rows = "| L1   | C1     | R1    |"

		const result = parseTable(header, separator, rows)

		expect(result).toContain('<th style="text-align:left">Left</th>')
		expect(result).toContain('<th style="text-align:center">Center</th>')
		expect(result).toContain('<th style="text-align:right">Right</th>')

		expect(result).toContain('<td style="text-align:left">L1</td>')
		expect(result).toContain('<td style="text-align:center">C1</td>')
		expect(result).toContain('<td style="text-align:right">R1</td>')
	})

	it("should filter out empty rows", () => {
		const header = "| Name | Age |"
		const separator = "|------|-----|"
		const rows = "| John | 25  |\n\n| Jane | 30  |\n"

		const result = parseTable(header, separator, rows)

		// Should only have 2 data rows, not 3 or 4
		const rowMatches = result.match(/<tr>/g)
		expect(rowMatches).toHaveLength(3) // 1 header row + 2 data rows
	})

	it("should handle tables with extra cells gracefully", () => {
		const header = "| Name | Age |"
		const separator = "|------|-----|"
		const rows = "| John | 25  | Extra | MoreExtra |\n| Jane | 30  |"

		const result = parseTable(header, separator, rows)

		// Should only have 2 columns matching the header
		const headerMatches = result.match(/<th\s[^>]*>/g)
		expect(headerMatches).toHaveLength(2)

		// Each row should only have 2 cells
		const firstRowCells = result.match(/<td\s[^>]*>John<\/td>|<td\s[^>]*>25<\/td>/g)
		expect(firstRowCells).toHaveLength(2)

		// Should not contain the extra cells
		expect(result).not.toContain("Extra")
		expect(result).not.toContain("MoreExtra")
	})
})
