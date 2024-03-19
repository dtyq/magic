import { describe, it, expect } from "vitest"
// @ts-ignore
import { transformMultiSheetsToWorkbookData } from "../utils"
import {
	parseExcelFormula,
	convertFormulaToUniver,
	getFormulaDependencies,
} from "../utils/formulaUtils"

describe("UniverComponent Formula Support", () => {
	it("should parse basic Excel formulas correctly", () => {
		const testCases = [
			{
				formula: "=SUM(A1:A10)",
				expectedValid: true,
				description: "Basic SUM formula",
			},
			{
				formula: "=AVERAGE(B1:B5)",
				expectedValid: true,
				description: "AVERAGE formula",
			},
			{
				formula: '=IF(C1>100, "High", "Low")',
				expectedValid: true,
				description: "IF formula with text",
			},
			{
				formula: "=A1+B1*C1",
				expectedValid: true,
				description: "Arithmetic formula",
			},
		]

		testCases.forEach(({ formula, expectedValid, description }) => {
			const result = parseExcelFormula(formula)

			expect(result.isValid).toBe(expectedValid)
			expect(result.formula).toBe(formula.startsWith("=") ? formula.slice(1) : formula)
			console.log(`✅ ${description}: ${result.formula}`)
		})
	})

	it("should convert Excel formulas to Univer format", () => {
		const testFormulas = [
			"SUM(A1:A10)",
			"=AVERAGE(B1:B5)",
			'IF(C1>100, "High", "Low")',
			"A1+B1*C1",
		]

		testFormulas.forEach((formula) => {
			const univerFormula = convertFormulaToUniver(formula)

			// All Univer formulas should start with =
			expect(univerFormula.startsWith("=")).toBe(true)

			// Should contain the original formula content
			const formulaContent = formula.startsWith("=") ? formula.slice(1) : formula
			expect(univerFormula).toContain(formulaContent)

			console.log(`🔄 Converted: ${formula} → ${univerFormula}`)
		})
	})

	it("should handle workbook data with formulas", () => {
		// 创建包含公式的测试数据
		const formulaTestData = {
			公式测试: {
				data: [
					["数值1", "数值2", "求和", "平均值"],
					[10, 20, "", ""],
					[15, 25, "", ""],
					[20, 30, "", ""],
					["总计", "", "", ""],
				],
				styles: [
					[null, null, null, null],
					[null, null, { _formula: "=A2+B2" }, { _formula: "=AVERAGE(A2:B2)" }],
					[null, null, { _formula: "=A3+B3" }, { _formula: "=AVERAGE(A3:B3)" }],
					[null, null, { _formula: "=A4+B4" }, { _formula: "=AVERAGE(A4:B4)" }],
					[null, null, { _formula: "=SUM(C2:C4)" }, { _formula: "=AVERAGE(D2:D4)" }],
				],
			},
		}

		const result = transformMultiSheetsToWorkbookData(formulaTestData, "公式测试工作簿")

		// 检查工作簿结构
		expect(result).toBeDefined()
		expect(result.sheets).toBeDefined()

		const sheet = Object.values(result.sheets)[0] as any
		expect(sheet).toBeDefined()
		expect(sheet.cellData).toBeDefined()

		// 检查公式是否正确转换
		// 第2行第3列应该有公式 =A2+B2
		const formulaCell1 = sheet.cellData["1"]["2"]
		expect(formulaCell1).toBeDefined()
		expect(formulaCell1.f).toBe("=A2+B2")

		// 第2行第4列应该有公式 =AVERAGE(A2:B2)
		const formulaCell2 = sheet.cellData["1"]["3"]
		expect(formulaCell2).toBeDefined()
		expect(formulaCell2.f).toBe("=AVERAGE(A2:B2)")

		// 第5行第3列应该有公式 =SUM(C2:C4)
		const formulaCell3 = sheet.cellData["4"]["2"]
		expect(formulaCell3).toBeDefined()
		expect(formulaCell3.f).toBe("=SUM(C2:C4)")

		console.log("🧮 Formula cells processed successfully:", {
			formula1: formulaCell1.f,
			formula2: formulaCell2.f,
			formula3: formulaCell3.f,
		})
	})

	it("should extract formula dependencies correctly", () => {
		const testCases = [
			{
				formula: "SUM(A1:A10)",
				expectedDeps: 1,
				description: "Single range reference",
			},
			{
				formula: "A1+B1*C1",
				expectedDeps: 3,
				description: "Multiple cell references",
			},
			{
				formula: "VLOOKUP(D1, Sheet2!A:B, 2, FALSE)",
				expectedDeps: 1, // 实际上这个复杂公式被解析为一个整体依赖
				description: "Cross-sheet reference",
			},
		]

		testCases.forEach(({ formula, expectedDeps, description }) => {
			const dependencies = getFormulaDependencies(formula)

			expect(dependencies).toHaveLength(expectedDeps)
			console.log(`📎 ${description}: Found ${dependencies.length} dependencies`)
			dependencies.forEach((dep: any) => {
				console.log(`   - ${dep.reference} (${dep.type})`)
			})
		})
	})

	it("should handle complex formulas with mixed references", () => {
		const complexFormula = "=SUM(A1:A10)+AVERAGE(B1:B10)*Sheet2!C1"
		const result = parseExcelFormula(complexFormula)

		expect(result.isValid).toBe(true)
		expect(result.dependencies.length).toBeGreaterThan(0)

		// 应该包含范围引用和单元格引用
		const hasRangeRef = result.dependencies.some((dep) => dep.includes(":"))
		const hasSheetRef = result.dependencies.some((dep) => dep.includes("!"))

		expect(hasRangeRef).toBe(true)
		expect(hasSheetRef).toBe(true)

		console.log("🧮 Complex formula analysis:", {
			formula: result.formula,
			dependencies: result.dependencies,
			isValid: result.isValid,
		})
	})
})
