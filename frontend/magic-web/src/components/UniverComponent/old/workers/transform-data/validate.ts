#!/usr/bin/env node

/**
 * Transform Data Worker 验证脚本
 * 用于验证 xmldom 集成和 Worker 功能是否正常
 */

import { getDOMParser, processExcelRichText, convertHtmlToRichText } from "../../utils/textUtils"

console.log("🔍 开始验证 Transform Data Worker...")

// 测试 1: DOMParser 在不同环境下的工作情况
console.log("\n1. 测试 DOMParser 兼容性:")

try {
	const parser = getDOMParser()
	console.log("✅ DOMParser 初始化成功")

	// 测试 XML 解析
	const xmlDoc = parser.parseFromString("<test><item>Hello World</item></test>", "text/xml")
	const item = xmlDoc.querySelector("item")
	if (item?.textContent === "Hello World") {
		console.log("✅ XML 解析功能正常")
	} else {
		console.log("❌ XML 解析功能异常")
	}
} catch (error) {
	console.log("❌ DOMParser 初始化失败:", error)
}

// 测试 2: Excel 富文本处理
console.log("\n2. 测试 Excel 富文本处理:")

const excelRichTextXml = `
<r>
	<rPr>
		<b/>
		<sz val="14"/>
		<color rgb="FFFF0000"/>
		<rFont val="Arial"/>
	</rPr>
	<t>粗体红色文本</t>
</r>
<r>
	<rPr>
		<i/>
		<sz val="12"/>
		<color rgb="FF0000FF"/>
	</rPr>
	<t>斜体蓝色文本</t>
</r>
`

try {
	const richTextResult = processExcelRichText(excelRichTextXml)
	if (richTextResult && richTextResult.body) {
		console.log("✅ Excel 富文本处理成功")
		console.log("   文本内容:", richTextResult.body.dataStream.replace(/\r\n/g, ""))
		console.log("   文本运行数量:", richTextResult.body.textRuns.length)
	} else {
		console.log("❌ Excel 富文本处理失败")
	}
} catch (error) {
	console.log("❌ Excel 富文本处理异常:", error)
}

// 测试 3: HTML 到富文本转换
console.log("\n3. 测试 HTML 富文本转换:")

const htmlContent = "<div><b>粗体</b>和<i>斜体</i>以及<u>下划线</u>文本</div>"

try {
	const htmlResult = convertHtmlToRichText(htmlContent)
	if (htmlResult && htmlResult.text) {
		console.log("✅ HTML 富文本转换成功")
		console.log("   文本内容:", htmlResult.text)
		console.log("   样式运行数量:", htmlResult.textRuns.length)
	} else {
		console.log("❌ HTML 富文本转换失败")
	}
} catch (error) {
	console.log("❌ HTML 富文本转换异常:", error)
}

// 测试 4: 模拟 Worker 环境
console.log("\n4. 测试模拟 Worker 环境:")

// 临时删除 window 对象来模拟 Worker 环境
const originalWindow = (global as any).window
delete (global as any).window

try {
	const workerParser = getDOMParser()
	const workerDoc = workerParser.parseFromString(
		"<worker><test>Worker Test</test></worker>",
		"text/xml",
	)
	const testElement = workerDoc.querySelector("test")

	if (testElement?.textContent === "Worker Test") {
		console.log("✅ Worker 环境 DOM 解析正常")
	} else {
		console.log("❌ Worker 环境 DOM 解析异常")
	}
} catch (error) {
	console.log("❌ Worker 环境测试失败:", error)
} finally {
	// 恢复 window 对象
	if (originalWindow) {
		;(global as any).window = originalWindow
	}
}

console.log("\n🎉 验证完成!")

// 输出环境信息
console.log("\n📊 环境信息:")
console.log("   Node.js 版本:", process.version)
console.log("   平台:", process.platform)
console.log("   架构:", process.arch)

export {}
