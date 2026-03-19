import { describe, it, expect } from "vitest"
// @ts-ignore
import { transformMultiSheetsToWorkbookData } from "../utils"

describe("UniverComponent Multi-Sheet Support", () => {
	it("should transform multiple sheets data to workbook format", () => {
		const mockSheetsData = {
			Sheet1: [
				["Name", "Age", "City"],
				["John", 25, "New York"],
				["Jane", 30, "London"],
			],
			Sheet2: [
				["Product", "Price", "Stock"],
				["Laptop", 999, 10],
				["Mouse", 25, 100],
			],
			Sheet3: [
				["Date", "Revenue"],
				["2024-01-01", 1000],
				["2024-01-02", 1500],
			],
		}

		const result = transformMultiSheetsToWorkbookData(mockSheetsData, "TestWorkbook")

		// Check basic workbook structure
		expect(result).toHaveProperty("id")
		expect(result).toHaveProperty("name", "TestWorkbook")
		expect(result).toHaveProperty("sheetOrder")
		expect(result).toHaveProperty("sheets")

		// Check that all sheets are created
		expect(result.sheetOrder).toHaveLength(3)
		expect(Object.keys(result.sheets)).toHaveLength(3)

		// Check sheet names
		const sheetNames = Object.values(result.sheets).map((sheet: any) => sheet.name)
		expect(sheetNames).toContain("Sheet1")
		expect(sheetNames).toContain("Sheet2")
		expect(sheetNames).toContain("Sheet3")

		// Check first sheet data
		const firstSheet = Object.values(result.sheets)[0] as any
		expect(firstSheet.cellData["0"]["0"].v).toBe("Name")
		expect(firstSheet.cellData["0"]["1"].v).toBe("Age")
		expect(firstSheet.cellData["0"]["2"].v).toBe("City")
		expect(firstSheet.cellData["1"]["0"].v).toBe("John")
		expect(firstSheet.cellData["1"]["1"].v).toBe(25)
		expect(firstSheet.cellData["1"]["2"].v).toBe("New York")
	})

	it("should handle empty sheets data", () => {
		const emptyData = {}
		const result = transformMultiSheetsToWorkbookData(emptyData, "EmptyWorkbook")

		expect(result).toHaveProperty("id")
		expect(result).toHaveProperty("name", "EmptyWorkbook")
		expect(result.sheetOrder).toHaveLength(0)
		expect(Object.keys(result.sheets)).toHaveLength(0)
	})

	it("should handle single sheet data", () => {
		const singleSheetData = {
			OnlySheet: [
				["A1", "B1"],
				["A2", "B2"],
			],
		}

		const result = transformMultiSheetsToWorkbookData(singleSheetData, "SingleSheet")

		expect(result.sheetOrder).toHaveLength(1)
		expect(Object.keys(result.sheets)).toHaveLength(1)

		const sheet = Object.values(result.sheets)[0] as any
		expect(sheet.name).toBe("OnlySheet")
		expect(sheet.cellData["0"]["0"].v).toBe("A1")
		expect(sheet.cellData["0"]["1"].v).toBe("B1")
	})

	it("should generate unique sheet IDs", () => {
		const mockData = {
			Sheet1: [["A1"]],
			Sheet2: [["A1"]],
			Sheet3: [["A1"]],
		}

		const result = transformMultiSheetsToWorkbookData(mockData, "Test")

		// Check that all sheet IDs are unique
		const sheetIds = result.sheetOrder
		expect(new Set(sheetIds).size).toBe(sheetIds.length)

		// Check that sheet IDs match the keys in sheets object
		sheetIds.forEach((id: string) => {
			expect(result.sheets).toHaveProperty(id)
		})
	})

	it("should set default sheet name when name is empty", () => {
		const dataWithEmptyName = {
			"": [["A1", "B1"]],
			Sheet2: [["A2", "B2"]],
		}

		const result = transformMultiSheetsToWorkbookData(dataWithEmptyName, "Test")

		const sheetNames = Object.values(result.sheets).map((sheet: any) => sheet.name)
		expect(sheetNames).toContain("工作表1") // Default name for empty sheet name
		expect(sheetNames).toContain("Sheet2")
	})

	it("should handle sheets with different row and column counts", () => {
		const mixedData = {
			SmallSheet: [["A1", "B1"]],
			LargeSheet: [
				["A1", "B1", "C1", "D1", "E1"],
				["A2", "B2", "C2", "D2", "E2"],
				["A3", "B3", "C3", "D3", "E3"],
				["A4", "B4", "C4", "D4", "E4"],
			],
		}

		const result = transformMultiSheetsToWorkbookData(mixedData, "Mixed")

		// Find the sheets
		const sheets = Object.values(result.sheets) as any[]
		const smallSheet = sheets.find((sheet) => sheet.name === "SmallSheet")
		const largeSheet = sheets.find((sheet) => sheet.name === "LargeSheet")

		// Check dimensions
		expect(smallSheet.rowCount).toBeGreaterThanOrEqual(1)
		expect(smallSheet.columnCount).toBeGreaterThanOrEqual(2)

		expect(largeSheet.rowCount).toBeGreaterThanOrEqual(4)
		expect(largeSheet.columnCount).toBeGreaterThanOrEqual(5)
	})

	it("should handle new format with styles", () => {
		const styledData = {
			StyledSheet: {
				data: [
					["Header1", "Header2", "Header3"],
					["Data1", "Data2", "Data3"],
					["Data4", "Data5", "Data6"],
				],
				styles: [
					[
						{ font: { bold: true, sz: 12 } },
						{ font: { bold: true, sz: 12 } },
						{ font: { bold: true, sz: 12 } },
					],
					[
						null,
						{ fill: { fgColor: { rgb: "FFFF0000" } } },
						{ alignment: { horizontal: "center" } },
					],
					[null, null, { border: { top: { style: "thin" } } }],
				],
			},
		}

		const result = transformMultiSheetsToWorkbookData(styledData, "StyledWorkbook")

		// Check that styles were generated
		expect(result.styles).toBeDefined()
		expect(Object.keys(result.styles).length).toBeGreaterThan(0)

		// Check that cells have style references
		const sheet = Object.values(result.sheets)[0] as any
		expect(sheet.cellData["0"]["0"].s).toBeDefined()
		expect(typeof sheet.cellData["0"]["0"].s).toBe("string")
		expect(sheet.cellData["1"]["1"].s).toBeDefined()
		expect(typeof sheet.cellData["1"]["1"].s).toBe("string")
	})

	it("should handle mixed old and new format", () => {
		const mixedData = {
			OldFormat: [
				["A1", "B1"],
				["A2", "B2"],
			],
			NewFormat: {
				data: [
					["C1", "D1"],
					["C2", "D2"],
				],
				styles: [
					[{ font: { bold: true } }, null],
					[null, null],
				],
			},
		}

		const result = transformMultiSheetsToWorkbookData(mixedData, "MixedWorkbook")

		expect(result.sheetOrder).toHaveLength(2)
		expect(Object.keys(result.sheets)).toHaveLength(2)

		// Check that both sheets are created correctly
		const sheets = Object.values(result.sheets) as any[]
		const oldSheet = sheets.find((sheet) => sheet.name === "OldFormat")
		const newSheet = sheets.find((sheet) => sheet.name === "NewFormat")

		expect(oldSheet.cellData["0"]["0"].v).toBe("A1")
		expect(newSheet.cellData["0"]["0"].v).toBe("C1")
		expect(newSheet.cellData["0"]["0"].s).toBeDefined()
	})

	it("should convert Excel styles to Univer format correctly", () => {
		const styledData = {
			StyledSheet: {
				data: [["Test Cell"]],
				styles: [
					[
						{
							font: {
								bold: true,
								italic: true,
								sz: 14,
								name: "Arial",
								color: { rgb: "FF0000FF" },
							},
							fill: {
								fgColor: { rgb: "FFFFFF00" },
							},
							alignment: {
								horizontal: "center",
								vertical: "middle",
								wrapText: true,
							},
							border: {
								top: { style: "thin", color: { rgb: "FF000000" } },
								bottom: { style: "medium", color: { rgb: "FF000000" } },
							},
						},
					],
				],
			},
		}

		const result = transformMultiSheetsToWorkbookData(styledData, "StyledWorkbook")

		// Check that styles were converted (including default style)
		expect(Object.keys(result.styles).length).toBeGreaterThan(1)

		// Find the non-default style
		const styleKeys = Object.keys(result.styles).filter((key) => key !== "default")
		expect(styleKeys).toHaveLength(1)
		const styleKey = styleKeys[0]
		const style = result.styles[styleKey]
		expect(style.bl).toBe(1) // bold
		expect(style.it).toBe(1) // italic
		expect(style.fs).toBe(14) // font size
		expect(style.ff).toBe("Arial") // font family
		expect(style.cl.rgb).toBe("#0000FF") // font color
		expect(style.bg.rgb).toBe("#FFFF00") // background color
		expect(style.ht).toBe(2) // horizontal center
		expect(style.vt).toBe(2) // vertical middle
		expect(style.tb).toBe(1) // text wrap
		expect(style.bd.t).toBeDefined() // top border
		expect(style.bd.b).toBeDefined() // bottom border
	})

	it("should handle null styles gracefully", () => {
		const dataWithNullStyles = {
			Sheet1: {
				data: [["A1", "B1"]],
				styles: [[null, null]],
			},
		}

		const result = transformMultiSheetsToWorkbookData(dataWithNullStyles, "TestWorkbook")

		// Check that only default style exists for null entries
		expect(Object.keys(result.styles)).toHaveLength(1)
		expect(result.styles).toHaveProperty("default")

		// Check that cell data is still correct
		const sheet = Object.values(result.sheets)[0] as any
		expect(sheet.cellData["0"]["0"].v).toBe("A1")
		expect(sheet.cellData["0"]["0"].s).toBeUndefined()
	})

	it("should handle sheet visibility correctly", () => {
		const dataWithHiddenSheets = {
			VisibleSheet1: {
				data: [["A1", "B1"]],
				hidden: false,
			},
			HiddenSheet1: {
				data: [["A1", "B1"]],
				hidden: true,
			},
			VisibleSheet2: {
				data: [["A1", "B1"]],
				// hidden property not specified, should default to visible
			},
			HiddenSheet2: {
				data: [["A1", "B1"]],
				hidden: true,
			},
		}

		const result = transformMultiSheetsToWorkbookData(dataWithHiddenSheets, "TestWorkbook")

		// Check that all sheets are created
		expect(Object.keys(result.sheets)).toHaveLength(4)

		// Check visibility of each sheet
		const sheets = Object.values(result.sheets) as any[]
		const visibleSheet1 = sheets.find((sheet) => sheet.name === "VisibleSheet1")
		const hiddenSheet1 = sheets.find((sheet) => sheet.name === "HiddenSheet1")
		const visibleSheet2 = sheets.find((sheet) => sheet.name === "VisibleSheet2")
		const hiddenSheet2 = sheets.find((sheet) => sheet.name === "HiddenSheet2")

		expect(visibleSheet1.hidden).toBe(0) // 0 = visible
		expect(hiddenSheet1.hidden).toBe(1) // 1 = hidden
		expect(visibleSheet2.hidden).toBe(0) // default to visible
		expect(hiddenSheet2.hidden).toBe(1) // 1 = hidden

		// Count hidden and visible sheets
		const hiddenCount = sheets.filter((sheet) => sheet.hidden === 1).length
		const visibleCount = sheets.filter((sheet) => sheet.hidden === 0).length

		expect(hiddenCount).toBe(2)
		expect(visibleCount).toBe(2)
	})

	it("should handle old format sheets as visible by default", () => {
		const oldFormatData = {
			Sheet1: [["A1", "B1"]],
			Sheet2: [["A2", "B2"]],
		}

		const result = transformMultiSheetsToWorkbookData(oldFormatData, "TestWorkbook")

		// Check that all sheets are visible by default
		const sheets = Object.values(result.sheets) as any[]
		sheets.forEach((sheet) => {
			expect(sheet.hidden).toBe(0) // 0 = visible
		})
	})
})
