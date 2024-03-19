/**
 * 测试工具模块
 * 提供各种测试数据生成功能
 */
import { transformMultiSheetsToWorkbookData } from "./transformUtils"

/**
 * 创建包含边框和合并单元格测试的样本工作簿数据
 * 用于测试边框渲染和合并单元格是否正常工作
 */
export function createBorderTestWorkbook(): any {
	const testData = [
		["合并标题", "", "", "独立单元格"],
		["", "", "", ""],
		["左上", "右上", "", ""],
		["左下", "右下", "", ""],
		["A5", "B5", "C5", "D5"],
	]

	const testStyles = [
		[
			// A1: 合并单元格的主单元格，加粗字体
			{
				font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
				fill: { fgColor: { rgb: "4F81BD" } },
				border: {
					top: { style: "medium", color: { rgb: "000000" } },
					bottom: { style: "medium", color: { rgb: "000000" } },
					left: { style: "medium", color: { rgb: "000000" } },
					right: { style: "medium", color: { rgb: "000000" } },
				},
			},
			// B1-C1: 被合并的单元格
			null,
			null,
			// D1: 独立单元格
			{ border: { right: { style: "dashed", color: { rgb: "0000FF" } } } },
		],
		[
			// A2-D2: 空行
			null,
			null,
			null,
			null,
		],
		[
			// A3: 2x2合并的左上角
			{
				font: { bold: true, sz: 12 },
				fill: { fgColor: { rgb: "FFFF00" } },
				border: {
					top: { style: "thin", color: { rgb: "000000" } },
					left: { style: "thin", color: { rgb: "000000" } },
				},
			},
			// B3: 2x2合并的右上角
			{
				border: {
					top: { style: "thin", color: { rgb: "000000" } },
					right: { style: "thin", color: { rgb: "000000" } },
				},
			},
			// C3-D3: 独立单元格
			null,
			null,
		],
		[
			// A4: 2x2合并的左下角
			{
				border: {
					bottom: { style: "thin", color: { rgb: "000000" } },
					left: { style: "thin", color: { rgb: "000000" } },
				},
			},
			// B4: 2x2合并的右下角
			{
				border: {
					bottom: { style: "thin", color: { rgb: "000000" } },
					right: { style: "thin", color: { rgb: "000000" } },
				},
			},
			// C4-D4: 独立单元格
			null,
			null,
		],
		[
			// A5-D5: 普通单元格行
			{ border: { bottom: { style: "double", color: { rgb: "800080" } } } },
			{ font: { italic: true, color: { rgb: "FF0000" } } },
			{ fill: { fgColor: { rgb: "00FF00" } } },
			{
				border: {
					top: { style: "thin", color: { rgb: "000000" } },
					bottom: { style: "thin", color: { rgb: "000000" } },
					left: { style: "thin", color: { rgb: "000000" } },
					right: { style: "thin", color: { rgb: "000000" } },
				},
			},
		],
	]

	// 定义合并单元格范围
	const mergeRanges = [
		{
			start: { r: 0, c: 0 }, // A1
			end: { r: 0, c: 2 }, // C1 (A1:C1 合并)
		},
		{
			start: { r: 2, c: 0 }, // A3
			end: { r: 3, c: 1 }, // B4 (A3:B4 2x2合并)
		},
	]

	const testSheetData = {
		边框和合并测试: {
			data: testData,
			styles: testStyles,
			rowProperties: [],
			columnProperties: [],
			mergeRanges: mergeRanges,
		},
	}

	return transformMultiSheetsToWorkbookData(testSheetData, "边框和合并测试工作簿")
}

/**
 * 创建带有合并单元格的测试CSV数据
 * 用于测试合并单元格功能
 *
 * 使用说明：
 * 1. 在LazyUniverComponent中使用 testMode="border-merge" 属性
 * 2. 或者调用 createBorderTestWorkbook() 函数获取测试数据
 * 3. 测试数据包含：
 *    - A1:C1 水平合并单元格
 *    - A3:B4 2x2 合并单元格
 *    - 各种边框和样式测试
 *
 * @returns CSV格式的测试数据字符串
 */
export function createMergeTestCSV(): string {
	return `合并标题,,,独立单元格
,,,
左上,右上,,
左下,右下,,
A5,B5,C5,D5`
}

/**
 * 创建增强样式测试工作簿
 * 用于测试HTML内容、富文本、颜色处理等功能
 *
 * @returns 测试工作簿数据
 */
export function createEnhancedStyleTestWorkbook(): any {
	const testData = [
		["HTML样式测试", "富文本测试", "颜色主题测试", "数字格式测试"],
		["<b>粗体文本</b>", "普通文本", "绿色背景", "1234.56"],
		["<i>斜体文本</i>", "红色字体", "蓝色背景", "78.9%"],
		["<u>下划线</u>", "大字体", "黄色背景", "2023/12/31"],
		[
			"<span style='color: red; font-weight: bold;'>红色粗体</span>",
			"多种格式",
			"渐变色",
			"$999.99",
		],
		[
			"<font color='blue' size='4'><b><i>蓝色粗斜体</i></b></font>",
			"复杂样式",
			"主题色",
			"123.45€",
		],
		[
			"<span style='background-color: yellow;'>黄色背景</span>",
			"背景色测试",
			"索引色",
			"98.7°C",
		],
	]

	// 使用any类型避免TypeScript类型检查问题
	const testStyles: any[][] = [
		[
			// 标题行 - 主题色背景
			{
				font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
				fill: { fgColor: { theme: 4, tint: -0.25 } }, // 蓝色主题色变暗
				border: { bottom: { style: "medium", color: { rgb: "000000" } } },
			},
			{
				font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
				fill: { fgColor: { theme: 5, tint: -0.25 } }, // 红色主题色变暗
				border: { bottom: { style: "medium", color: { rgb: "000000" } } },
			},
			{
				font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
				fill: { fgColor: { theme: 6, tint: -0.25 } }, // 绿色主题色变暗
				border: { bottom: { style: "medium", color: { rgb: "000000" } } },
			},
			{
				font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
				fill: { fgColor: { theme: 7, tint: -0.25 } }, // 紫色主题色变暗
				border: { bottom: { style: "medium", color: { rgb: "000000" } } },
			},
		],
		[
			// HTML内容行 - 基础HTML标签
			{
				font: { bold: true, sz: 12 },
				fill: { fgColor: { rgb: "F0F8FF" } }, // 浅蓝色
				_htmlContent: "<b>粗体文本</b>",
			},
			{
				font: { sz: 12 },
				alignment: { horizontal: "center", wrapText: true },
			},
			{
				fill: { fgColor: { indexed: 17 } }, // 使用索引颜色
				border: {
					top: { style: "thin", color: { theme: 1 } },
					bottom: { style: "thin", color: { theme: 1 } },
				},
			},
			{
				numFmt: "0.00", // 数字格式
				alignment: { horizontal: "right" },
			},
		],
		[
			// 富文本和特殊格式行
			{
				font: { italic: true, sz: 11, color: { theme: 5 } },
				_htmlContent: "<i>斜体文本</i>",
			},
			{
				font: { bold: true, sz: 14, color: { rgb: "FF0000" } },
				alignment: { horizontal: "center" },
			},
			{
				fill: { fgColor: { theme: 4, tint: 0.4 } }, // 蓝色主题色变浅
				font: { color: { rgb: "FFFFFF" } },
			},
			{
				numFmt: "0.0%", // 百分比格式
				font: { bold: true },
			},
		],
		[
			// 更多样式测试
			{
				font: { underline: true, sz: 12 },
				border: {
					left: { style: "dashed", color: { indexed: 23 } },
					right: { style: "dashed", color: { indexed: 23 } },
				},
				_htmlContent: "<u>下划线</u>",
			},
			{
				font: { sz: 18, color: { theme: 6 } },
				alignment: { vertical: "middle", horizontal: "center" },
			},
			{
				fill: { fgColor: { rgb: "FFFF00" } }, // 黄色背景
				border: {
					top: { style: "double", color: { rgb: "FF0000" } },
					bottom: { style: "double", color: { rgb: "FF0000" } },
				},
			},
			{
				numFmt: "yyyy/mm/dd", // 日期格式
				alignment: { horizontal: "center" },
			},
		],
		[
			// 内联样式测试行
			{
				font: { sz: 13 },
				fill: { fgColor: { rgb: "F5F5F5" } },
				_htmlContent: "<span style='color: red; font-weight: bold;'>红色粗体</span>",
			},
			{
				_richText: [
					{ t: "多", rPr: { b: true, color: { rgb: "FF0000" } } },
					{ t: "种", rPr: { i: true, color: { rgb: "00FF00" } } },
					{ t: "格", rPr: { u: true, color: { rgb: "0000FF" } } },
					{ t: "式", rPr: { sz: 16, color: { rgb: "FF00FF" } } },
				],
			},
			{
				fill: {
					patternType: "solid",
					fgColor: { theme: 9, tint: -0.1 },
				},
				alignment: {
					horizontal: "center",
					vertical: "middle",
					textRotation: 45,
				},
			},
			{
				numFmt: "$#,##0.00", // 货币格式
				font: { bold: true, color: { theme: 6 } },
				alignment: { horizontal: "right" },
			},
		],
		[
			// 复杂HTML样式测试行
			{
				font: { sz: 12 },
				alignment: { horizontal: "left" },
				_htmlContent: "<font color='blue' size='4'><b><i>蓝色粗斜体</i></b></font>",
			},
			{
				font: { bold: true, italic: true, strike: true, sz: 13 },
				fill: { fgColor: { theme: 8, tint: 0.2 } },
				border: {
					top: { style: "medium", color: { theme: 1 } },
					bottom: { style: "medium", color: { theme: 1 } },
					left: { style: "medium", color: { theme: 1 } },
					right: { style: "medium", color: { theme: 1 } },
				},
			},
			{
				fill: { fgColor: { indexed: 22 } }, // 使用索引颜色
				font: { color: { rgb: "000000" } },
			},
			{
				numFmt: "#,##0.00 [$€-407]", // 欧元格式
				font: { bold: true },
				alignment: { horizontal: "right" },
			},
		],
		[
			// 背景色和特殊格式测试行
			{
				font: { sz: 11 },
				alignment: { horizontal: "center" },
				_htmlContent: "<span style='background-color: yellow;'>黄色背景</span>",
			},
			{
				font: { sz: 14, underline: true },
				fill: { fgColor: { rgb: "E6E6FA" } }, // 淡紫色背景
			},
			{
				fill: { fgColor: { indexed: 43 } }, // 使用索引颜色
				font: { color: { rgb: "FFFFFF" }, bold: true },
			},
			{
				numFmt: '0.0° "C"', // 温度格式
				font: { italic: true },
				alignment: { horizontal: "center" },
			},
		],
	]

	const testSheetData = {
		增强样式测试: {
			data: testData,
			styles: testStyles,
			rowProperties: [
				{ height: 25 }, // 标题行高
				{ height: 30 }, // 普通行高
				{ height: 30 },
				{ height: 35 }, // 稍高的行
				{ height: 40 }, // 最高的行
				{ height: 35 }, // 内联样式行
				{ height: 35 }, // 复杂HTML行
				{ height: 30 }, // 背景色行
			],
			columnProperties: [
				{ width: 150 }, // 第一列较宽，用于HTML内容
				{ width: 120 }, // 富文本列
				{ width: 120 }, // 颜色测试列
				{ width: 130 }, // 数字格式列
			],
			mergeRanges: [], // 这个测试重点是样式，不测试合并
		},
	}

	return transformMultiSheetsToWorkbookData(testSheetData, "增强样式测试工作簿(含HTML支持)")
}

/**
 * 创建包含富文本的合并单元格测试工作簿
 * 用于测试富文本在合并单元格中的处理是否正确
 */
export function createRichTextMergeTestWorkbook(): any {
	const testData = [
		["富文本合并标题", "", "", "普通文本"],
		["", "", "", ""],
		["单元格1", "单元格2", "单元格3", "单元格4"],
		["HTML内容", "", "普通合并", ""],
		["长文本内容测试", "", "", ""],
	]

	// 创建包含富文本的样式数据
	const testStyles: any[][] = [
		[
			// A1: 包含富文本的合并单元格
			{
				font: { bold: true, sz: 16, color: { rgb: "0000FF" } },
				fill: { fgColor: { rgb: "FFFF00" } },
				border: {
					top: { style: "medium", color: { rgb: "000000" } },
					bottom: { style: "medium", color: { rgb: "000000" } },
					left: { style: "medium", color: { rgb: "000000" } },
					right: { style: "medium", color: { rgb: "000000" } },
				},
				_richText:
					'<r><rPr><b/><sz val="16"/><color rgb="FF0000FF"/><rFont val="Arial"/></rPr><t>富文本</t></r><r><rPr><i/><sz val="14"/><color rgb="FFFF0000"/><rFont val="Arial"/></rPr><t>合并标题</t></r>',
			},
			// B1-C1: 被合并的单元格（可能包含一些样式信息）
			{
				font: { bold: true, sz: 16, color: { rgb: "0000FF" } },
				fill: { fgColor: { rgb: "FFFF00" } },
			},
			{
				font: { bold: true, sz: 16, color: { rgb: "0000FF" } },
				fill: { fgColor: { rgb: "FFFF00" } },
			},
			// D1: 普通单元格
			{
				font: { color: { rgb: "000000" } },
				border: { right: { style: "thin", color: { rgb: "000000" } } },
			},
		],
		[
			// 第二行：空行
			null,
			null,
			null,
			null,
		],
		[
			// 第三行：普通单元格
			{ font: { color: { rgb: "000000" } } },
			{ font: { color: { rgb: "000000" } } },
			{ font: { color: { rgb: "000000" } } },
			{ font: { color: { rgb: "000000" } } },
		],
		[
			// A4: 包含HTML内容的合并单元格
			{
				font: { sz: 14 },
				fill: { fgColor: { rgb: "E6E6FA" } },
				border: {
					top: { style: "thin", color: { rgb: "000000" } },
					bottom: { style: "thin", color: { rgb: "000000" } },
					left: { style: "thin", color: { rgb: "000000" } },
					right: { style: "thin", color: { rgb: "000000" } },
				},
				_htmlContent:
					'<span style="color: red; font-weight: bold;">HTML</span><span style="color: blue; font-style: italic;">内容</span>',
			},
			// B4: 被合并的单元格
			{
				font: { sz: 14 },
				fill: { fgColor: { rgb: "E6E6FA" } },
			},
			// C4: 普通合并
			{
				font: { sz: 12 },
				fill: { fgColor: { rgb: "F0F0F0" } },
				border: {
					top: { style: "thin", color: { rgb: "000000" } },
					bottom: { style: "thin", color: { rgb: "000000" } },
					left: { style: "thin", color: { rgb: "000000" } },
					right: { style: "thin", color: { rgb: "000000" } },
				},
			},
			// D4: 被合并的单元格
			{
				font: { sz: 12 },
				fill: { fgColor: { rgb: "F0F0F0" } },
			},
		],
		[
			// A5: 包含长文本的合并单元格
			{
				font: { sz: 12, color: { rgb: "000000" } },
				fill: { fgColor: { rgb: "F5F5F5" } },
				border: {
					top: { style: "thin", color: { rgb: "000000" } },
					bottom: { style: "thin", color: { rgb: "000000" } },
					left: { style: "thin", color: { rgb: "000000" } },
					right: { style: "thin", color: { rgb: "000000" } },
				},
				_formattedText:
					"这是一个包含长文本内容的合并单元格，用于测试富文本数据在合并单元格中的正确处理。",
			},
			// B5-D5: 被合并的单元格
			{
				font: { sz: 12, color: { rgb: "000000" } },
				fill: { fgColor: { rgb: "F5F5F5" } },
			},
			{
				font: { sz: 12, color: { rgb: "000000" } },
				fill: { fgColor: { rgb: "F5F5F5" } },
			},
			{
				font: { sz: 12, color: { rgb: "000000" } },
				fill: { fgColor: { rgb: "F5F5F5" } },
			},
		],
	]

	// 定义合并单元格范围
	const mergeRanges = [
		{
			start: { r: 0, c: 0 }, // A1
			end: { r: 0, c: 2 }, // C1 (A1:C1 水平合并，包含富文本)
		},
		{
			start: { r: 3, c: 0 }, // A4
			end: { r: 3, c: 1 }, // B4 (A4:B4 水平合并，包含HTML内容)
		},
		{
			start: { r: 3, c: 2 }, // C4
			end: { r: 3, c: 3 }, // D4 (C4:D4 水平合并，普通合并)
		},
		{
			start: { r: 4, c: 0 }, // A5
			end: { r: 4, c: 3 }, // D5 (A5:D5 水平合并，包含长文本)
		},
	]

	const testSheetData = {
		富文本合并测试: {
			data: testData,
			styles: testStyles,
			rowProperties: [
				{ height: 30 }, // A1行高
				{ height: 20 }, // 空行
				{ height: 25 }, // 普通行
				{ height: 28 }, // HTML内容行
				{ height: 35 }, // 长文本行
			],
			columnProperties: [
				{ width: 120 }, // A列
				{ width: 100 }, // B列
				{ width: 100 }, // C列
				{ width: 120 }, // D列
			],
			mergeRanges: mergeRanges,
		},
	}

	return transformMultiSheetsToWorkbookData(testSheetData, "富文本合并测试工作簿")
}
