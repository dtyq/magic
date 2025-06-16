import { describe, it, expect, beforeEach } from "vitest"
// @ts-ignore
import PreprocessService from "../index"
import { PreprocessRule } from "../types"
import { INLINE_MATH_REGEX, TABLE_REGEX } from "../defaultPreprocessRules"
import { parseTable } from "../utils"

describe("PreprocessService", () => {
	let service: any

	beforeEach(() => {
		// 每次测试前重新创建实例
		service = new (PreprocessService.constructor as any)()
	})

	describe("constructor", () => {
		it("should initialize with default rules", () => {
			const rules = service.getAllRules()
			expect(rules.length).toBeGreaterThan(0)
		})

		it("should initialize with custom rules", () => {
			const customRule: PreprocessRule = {
				regex: /test/g,
				replace: () => "replaced",
			}
			const customService = new (PreprocessService.constructor as any)([customRule])
			const rules = customService.getAllRules()

			// Should include both default rules and custom rule
			expect(rules).toContainEqual(customRule)
		})
	})

	describe("registerRule", () => {
		it("should register a new rule", () => {
			const initialCount = service.getAllRules().length
			const newRule: PreprocessRule = {
				regex: /test/g,
				replace: () => "test",
			}

			service.registerRule(/test/g, newRule)

			expect(service.getAllRules().length).toBe(initialCount + 1)
		})

		it("should overwrite existing rule with same regex", () => {
			const regex = /test/g
			const rule1: PreprocessRule = { regex, replace: () => "rule1" }
			const rule2: PreprocessRule = { regex, replace: () => "rule2" }

			service.registerRule(regex, rule1)
			service.registerRule(regex, rule2)

			const rules = service.getAllRules()
			const testRules = rules.filter(
				(r: PreprocessRule) => r.regex.toString() === regex.toString(),
			)
			expect(testRules.length).toBe(1)
			expect(testRules[0].replace("", "")).toBe("rule2")
		})
	})

	describe("unregisterRule", () => {
		it("should remove an existing rule", () => {
			const regex = /test/g
			const rule: PreprocessRule = { regex, replace: () => "test" }

			service.registerRule(regex, rule)
			const beforeCount = service.getAllRules().length

			service.unregisterRule(regex)
			const afterCount = service.getAllRules().length

			expect(afterCount).toBe(beforeCount - 1)
		})

		it("should handle removing non-existent rule gracefully", () => {
			const initialCount = service.getAllRules().length
			service.unregisterRule(/nonexistent/g)
			expect(service.getAllRules().length).toBe(initialCount)
		})
	})

	describe("getAllRules", () => {
		it("should return all registered rules", () => {
			const rules = service.getAllRules()
			expect(Array.isArray(rules)).toBe(true)
			expect(rules.length).toBeGreaterThan(0)
		})
	})

	describe("getInlineLatexRule", () => {
		it("should return inline latex rule", () => {
			const rule = service.getInlineLatexRule()
			expect(rule.regex).toEqual(INLINE_MATH_REGEX)
			expect(typeof rule.replace).toBe("function")
		})

		it("should wrap latex content in MagicLatexInline component", () => {
			const rule = service.getInlineLatexRule()
			const result = rule.replace("$E=mc^2$", "E=mc^2")
			expect(result).toBe('<MagicLatexInline math="E=mc^2" />')
		})
	})

	describe("splitBlockCode", () => {
		it("应该返回空数组当没有内容时", () => {
			const result = PreprocessService.splitBlockCode("")
			expect(result).toEqual([])
		})

		it("应该返回原文本当没有代码块时", () => {
			const markdown = "这是一段普通文本\n这是第二行"
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual([markdown.trim()])
		})

		it("应该正确分割单个代码块", () => {
			const markdown = "```javascript\nconst a = 1;\n```"
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual([markdown])
		})

		it("应该正确分割代码块前后有文本的情况", () => {
			const markdown =
				"这是代码块前的文本\n\n```javascript\nconst a = 1;\n```\n\n这是代码块后的文本"
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual([
				"这是代码块前的文本",
				"```javascript\nconst a = 1;\n```",
				"这是代码块后的文本",
			])
		})

		it("应该正确分割多个代码块", () => {
			const markdown =
				'第一段文本\n\n```javascript\nconst a = 1;\n```\n\n中间文本\n\n```python\nprint("hello")\n```\n\n最后文本'
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual([
				"第一段文本",
				"```javascript\nconst a = 1;\n```",
				"中间文本",
				'```python\nprint("hello")\n```',
				"最后文本",
			])
		})

		it("应该正确处理没有语言标记的代码块", () => {
			const markdown = "```\ncode without language\n```"
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual([markdown])
		})

		it("应该正确处理不完整的代码块标记", () => {
			const markdown = "这是一个不完整的代码块 ``` const a = 1;"
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual([markdown.trim()])
		})

		it("应该正确处理包含三个反引号但不是代码块的文本", () => {
			const markdown = "这里有三个反引号 ``` 但不是代码块"
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual([markdown.trim()])
		})

		it("应该正确处理包含oss-file类型的代码块", () => {
			const markdown =
				'这里是文本\n\n```oss-file\n{\n    "source": "api"\n}\n```\n\n这里是后面的文本'
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual([
				"这里是文本",
				'```oss-file\n{\n    "source": "api"\n}\n```',
				"这里是后面的文本",
			])
		})

		it("应该正确处理包含多个oss-file类型的代码块", () => {
			const markdown =
				'文本1\n\n```oss-file\n{\n    "source": "api1"\n}\n```\n\n文本2\n\n```oss-file\n{\n    "source": "api2"\n}\n```\n\n文本3'
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual([
				"文本1",
				'```oss-file\n{\n    "source": "api1"\n}\n```',
				"文本2",
				'```oss-file\n{\n    "source": "api2"\n}\n```',
				"文本3",
			])
		})

		it("应该正确处理包含大量JSON嵌套的oss-file代码块", () => {
			const markdown =
				'```oss-file\n{\n    "source": "api",\n    "request_body": {\n        "file": {\n            "name": "image.png",\n            "uid": "DT001/123/abc.png"\n        }\n    }\n}\n```'
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual([markdown])
		})

		// 新增图片处理测试
		it("应该正确分割单个图片", () => {
			const markdown = "![alt text](https://example.com/image.png)"
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual([markdown])
		})

		it("应该正确分割图片前后有文本的情况", () => {
			const markdown =
				"这是图片前的文本\n\n![alt text](https://example.com/image.png)\n\n这是图片后的文本"
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual([
				"这是图片前的文本",
				"![alt text](https://example.com/image.png)",
				"这是图片后的文本",
			])
		})

		it("应该正确分割多个图片", () => {
			const markdown = "文本1\n\n![image1](url1)\n\n文本2\n\n![image2](url2)\n\n文本3"
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual([
				"文本1",
				"![image1](url1)",
				"文本2",
				"![image2](url2)",
				"文本3",
			])
		})

		it("应该正确处理代码块和图片混合的情况", () => {
			const markdown = "文本\n\n![image](url)\n\n```js\ncode\n```\n\n![image2](url2)\n\n文本"
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual([
				"文本",
				"![image](url)",
				"```js\ncode\n```",
				"![image2](url2)",
				"文本",
			])
		})

		it("应该正确处理图片在代码块内的情况", () => {
			const markdown = "```markdown\n![image](url)\n```"
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual([markdown])
		})

		it("应该正确处理复杂的图片语法", () => {
			const markdown =
				'文本\n\n![Complex Image Title](https://example.com/path/to/image.png "Image Title")\n\n文本'
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual([
				"文本",
				'![Complex Image Title](https://example.com/path/to/image.png "Image Title")',
				"文本",
			])
		})

		it("应该正确处理空的图片alt文本", () => {
			const markdown = "文本\n\n![](https://example.com/image.png)\n\n文本"
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual(["文本", "![](https://example.com/image.png)", "文本"])
		})

		it("应该正确处理重叠的代码块和图片", () => {
			const markdown = "![image](url)```js\ncode\n```![image2](url2)"
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual(["![image](url)", "```js\ncode\n```", "![image2](url2)"])
		})

		it("应该正确处理只有空白字符的内容", () => {
			const result = PreprocessService.splitBlockCode("   \n   \t   ")
			expect(result).toEqual([])
		})

		// 额外的边界情况测试
		it("应该正确处理嵌套的代码块标记", () => {
			const markdown = "```js\n```nested\ncode\n```\n```"
			const result = PreprocessService.splitBlockCode(markdown)
			// 这个测试展示了正则表达式处理嵌套代码块的实际行为
			// 第一个 ``` 会匹配到第一个结束的 ```，剩余的部分会被当作普通文本
			expect(result).toEqual(["```js\n```", "nested\ncode", "```\n```"])
		})

		it("应该正确处理图片URL中包含特殊字符", () => {
			const markdown =
				"文本\n\n![image](https://example.com/image?param=value&other=123#section)\n\n文本"
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual([
				"文本",
				"![image](https://example.com/image?param=value&other=123#section)",
				"文本",
			])
		})

		it("应该正确处理图片alt文本中包含特殊字符", () => {
			const markdown = '文本\n\n![Image with "quotes" and symbols!@#$%](url)\n\n文本'
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual(["文本", '![Image with "quotes" and symbols!@#$%](url)', "文本"])
		})

		it("应该正确处理多行代码块后紧跟图片", () => {
			const markdown = "```js\nfunction test() {\n  return 'hello';\n}\n```\n![image](url)"
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual([
				"```js\nfunction test() {\n  return 'hello';\n}\n```",
				"![image](url)",
			])
		})

		it("应该正确处理图片后紧跟代码块", () => {
			const markdown = "![image](url)\n```js\nconsole.log('test');\n```"
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual(["![image](url)", "```js\nconsole.log('test');\n```"])
		})

		it("应该正确处理代码块内包含图片语法的字符串", () => {
			const markdown = '```js\nconst markdown = "![image](url)";\nconsole.log(markdown);\n```'
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual([markdown])
		})

		it("应该正确处理多个连续的图片", () => {
			const markdown = "![image1](url1)![image2](url2)![image3](url3)"
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual(["![image1](url1)", "![image2](url2)", "![image3](url3)"])
		})

		it("应该正确处理非标准的代码块语言标识符", () => {
			const markdown = "```c++\n#include <iostream>\nint main() { return 0; }\n```"
			const result = PreprocessService.splitBlockCode(markdown)
			expect(result).toEqual([markdown])
		})
	})

	describe("preprocess", () => {
		it("should process markdown with default rules", () => {
			const result = service.preprocess("This is ~~strikethrough~~ text")
			expect(result).toBeInstanceOf(Array)
			expect(result.length).toBeGreaterThan(0)
		})

		it("should process markdown with latex enabled", () => {
			const markdown = "This is a formula: $E=mc^2$ and some text"
			const result = service.preprocess(markdown, { enableLatex: true })
			expect(result.join("")).toContain('<MagicLatexInline math="E=mc^2" />')
		})

		it("should not process latex when disabled", () => {
			const markdown = "This is a formula: $E=mc^2$ and some text"
			const result = service.preprocess(markdown, { enableLatex: false })
			expect(result.join("")).toContain("$E=mc^2$")
		})

		it("should process citations", () => {
			const markdown = "This is a citation [[citation:1]]"
			const result = service.preprocess(markdown)
			expect(result.join("")).toContain('<MagicCitation index="1" />')
		})

		it("should process task lists", () => {
			const markdown = "- [x] completed task\n- [ ] incomplete task"
			const result = service.preprocess(markdown)
			const joinedResult = result.join("")
			expect(joinedResult).toContain('<input type="checkbox" checked readonly')
			expect(joinedResult).toContain('<input type="checkbox"  readonly')
			expect(joinedResult).toContain("completed task")
			expect(joinedResult).toContain("incomplete task")
		})

		it("should handle empty markdown", () => {
			const result = service.preprocess("")
			expect(result).toEqual([])
		})

		it("should handle markdown with only whitespace", () => {
			const result = service.preprocess("   \n   \t   ")
			expect(result).toEqual([])
		})

		it("should process markdown with mixed content", () => {
			const markdown =
				"Text\n\n```js\ncode\n```\n\n![image](url)\n\nMore ~~strikethrough~~ text"
			const result = service.preprocess(markdown)
			expect(result.length).toBeGreaterThan(0)
		})

		it("should protect URLs in code blocks from being converted to links", () => {
			const markdown = `普通文本中的链接会被转换：https://example.com

\`\`\`business-form
{
  "form_type": "approval",
  "template_config": {
    "code": "000668e7e4f7f1bc240710",
    "url": "https://terp.kkguan.com/"
  }
}
\`\`\`

另一个普通链接：https://google.com`

			const result = service.preprocess(markdown)
			const content = result.join(" ")

			// 普通文本中的URL应该被转换为链接
			expect(content).toContain(
				'<a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>',
			)
			expect(content).toContain(
				'<a href="https://google.com" target="_blank" rel="noopener noreferrer">https://google.com</a>',
			)

			// 代码块内的URL不应该被转换为链接，应该保持原样
			expect(content).toContain('"url": "https://terp.kkguan.com/"')
			expect(content).not.toContain('<a href="https://terp.kkguan.com/"')
		})

		it("should handle multiple code blocks with URLs", () => {
			const markdown = `普通链接：https://example.com

\`\`\`json
{
  "api_url": "https://api.example.com/v1",
  "webhook": "https://webhook.example.com"
}
\`\`\`

\`\`\`business-form
{
  "redirect_url": "https://redirect.example.com"
}
\`\`\`

最后的普通链接：https://final.com`

			const result = service.preprocess(markdown)
			const content = result.join(" ")

			// 普通文本中的URL应该被转换为链接
			expect(content).toContain(
				'<a href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a>',
			)
			expect(content).toContain(
				'<a href="https://final.com" target="_blank" rel="noopener noreferrer">https://final.com</a>',
			)

			// 代码块内的URL不应该被转换为链接
			expect(content).toContain('"api_url": "https://api.example.com/v1"')
			expect(content).toContain('"webhook": "https://webhook.example.com"')
			expect(content).toContain('"redirect_url": "https://redirect.example.com"')

			// 确保代码块内的URL没有被转换为链接
			expect(content).not.toContain('<a href="https://api.example.com/v1"')
			expect(content).not.toContain('<a href="https://webhook.example.com"')
			expect(content).not.toContain('<a href="https://redirect.example.com"')
		})

		it("should process markdown tables", () => {
			const markdown = `| 姓名 | 年龄 | 城市 |
| --- | --- | --- |
| 张三 | 25 | 北京 |
| 李四 | 30 | 上海 |`

			const result = service.preprocess(markdown)
			const joinedResult = result.join("")

			expect(joinedResult).toContain("<table>")
			expect(joinedResult).toContain("<thead>")
			expect(joinedResult).toContain("<tbody>")
			expect(joinedResult).toContain("姓名")
			expect(joinedResult).toContain("张三")
			expect(joinedResult).toContain("李四")
		})

		it("should process tables with different alignments", () => {
			const markdown = `| 左对齐 | 居中 | 右对齐 |
| --- | :---: | ---: |
| left | center | right |`

			const result = service.preprocess(markdown)
			const joinedResult = result.join("")

			expect(joinedResult).toContain("<table>")
			expect(joinedResult).toContain('style="text-align:left"')
			expect(joinedResult).toContain('style="text-align:center"')
			expect(joinedResult).toContain('style="text-align:right"')
		})

		it("should process complex markdown with tables, citations, and latex", () => {
			const markdown = `# 测试文档

这是一个包含多种元素的文档：

## 表格示例
| 名称 | 公式 | 引用 |
| --- | :---: | ---: |
| 牛顿第二定律 | $F = ma$ | [[citation:1]] |
| 能量守恒 | $E = mc^2$ | [[citation:2]] |

## 任务列表
- [x] 完成表格功能
- [ ] 添加更多测试
- [x] ~~优化性能~~

引用信息：[[citation:3]]`

			const result = service.preprocess(markdown, { enableLatex: true })
			const joinedResult = result.join("")

			// 验证表格处理
			expect(joinedResult).toContain("<table>")
			expect(joinedResult).toContain("牛顿第二定律")

			// 验证LaTeX处理
			expect(joinedResult).toContain('<MagicLatexInline math="F = ma" />')
			expect(joinedResult).toContain('<MagicLatexInline math="E = mc^2" />')

			// 验证引用处理
			expect(joinedResult).toContain('<MagicCitation index="1" />')
			expect(joinedResult).toContain('<MagicCitation index="2" />')
			expect(joinedResult).toContain('<MagicCitation index="3" />')

			// 验证任务列表
			expect(joinedResult).toContain('<input type="checkbox" checked readonly')
			expect(joinedResult).toContain('<input type="checkbox"  readonly')

			// 验证删除线
			expect(joinedResult).toContain('<span class="strikethrough">优化性能</span>')
		})
	})

	describe("parseTable", () => {
		it("TABLE_REGEX 应该正确匹配 markdown 表格", () => {
			const tableMarkdown = `| 姓名 | 年龄 | 城市 |
| --- | --- | --- |
| 张三 | 25 | 北京 |
| 李四 | 30 | 上海 |`

			const matches = Array.from(tableMarkdown.matchAll(TABLE_REGEX))
			expect(matches.length).toBe(1)

			const match = matches[0]
			expect(match[1]).toBe("| 姓名 | 年龄 | 城市 |") // 表头
			expect(match[2]).toBe("| --- | --- | --- |") // 分隔符
			expect(match[3]).toBe("| 张三 | 25 | 北京 |\n| 李四 | 30 | 上海 |") // 数据行
		})

		it("应该解析基本的表格", () => {
			const header = "| 姓名 | 年龄 | 城市 |"
			const separator = "| --- | --- | --- |"
			const rows = "| 张三 | 25 | 北京 |\n| 李四 | 30 | 上海 |"

			const result = parseTable(header, separator, rows)

			expect(result).toContain("<table>")
			expect(result).toContain("<thead>")
			expect(result).toContain("<tbody>")
			expect(result).toContain("姓名")
			expect(result).toContain("张三")
			expect(result).toContain("李四")
			expect(result).toContain("25")
			expect(result).toContain("30")
		})

		it("应该正确处理左对齐", () => {
			const header = "| 列1 | 列2 |"
			const separator = "| --- | --- |"
			const rows = "| 数据1 | 数据2 |"

			const result = parseTable(header, separator, rows)

			expect(result).toContain('style="text-align:left"')
		})

		it("应该正确处理右对齐", () => {
			const header = "| 列1 | 列2 |"
			const separator = "| ---: | ---: |"
			const rows = "| 数据1 | 数据2 |"

			const result = parseTable(header, separator, rows)

			expect(result).toContain('style="text-align:right"')
		})

		it("应该正确处理居中对齐", () => {
			const header = "| 列1 | 列2 |"
			const separator = "| :---: | :---: |"
			const rows = "| 数据1 | 数据2 |"

			const result = parseTable(header, separator, rows)

			expect(result).toContain('style="text-align:center"')
		})

		it("应该正确处理混合对齐方式", () => {
			const header = "| 左对齐 | 居中 | 右对齐 |"
			const separator = "| --- | :---: | ---: |"
			const rows = "| left | center | right |"

			const result = parseTable(header, separator, rows)

			expect(result).toContain('style="text-align:left"')
			expect(result).toContain('style="text-align:center"')
			expect(result).toContain('style="text-align:right"')
		})

		it("应该处理没有前后竖线的表格", () => {
			const header = "姓名 | 年龄"
			const separator = "--- | ---"
			const rows = "张三 | 25"

			const result = parseTable(header, separator, rows)

			expect(result).toContain("姓名")
			expect(result).toContain("年龄")
			expect(result).toContain("张三")
			expect(result).toContain("25")
		})

		it("应该处理单行表格", () => {
			const header = "| 标题 |"
			const separator = "| --- |"
			const rows = "| 内容 |"

			const result = parseTable(header, separator, rows)

			expect(result).toContain("<th")
			expect(result).toContain("标题")
			expect(result).toContain("<td")
			expect(result).toContain("内容")
		})

		it("应该处理多行数据", () => {
			const header = "| 编号 | 名称 |"
			const separator = "| --- | --- |"
			const rows = "| 1 | 项目A |\n| 2 | 项目B |\n| 3 | 项目C |"

			const result = parseTable(header, separator, rows)

			expect(result).toContain("项目A")
			expect(result).toContain("项目B")
			expect(result).toContain("项目C")
			// 应该有3个数据行
			const matches = result.match(/<tr>/g)
			expect(matches?.length).toBe(4) // 1个表头行 + 3个数据行
		})

		it("应该正确处理空单元格", () => {
			const header = "| 列1 | 列2 | 列3 |"
			const separator = "| --- | --- | --- |"
			const rows = "| 数据 |  | 更多数据 |"

			const result = parseTable(header, separator, rows)

			expect(result).toContain("数据")
			expect(result).toContain("更多数据")
			// 检查是否有空的td标签
			expect(result).toContain("<td")
		})

		it("应该处理包含特殊字符的表格", () => {
			const header = "| 名称 | 描述 |"
			const separator = "| --- | --- |"
			const rows = "| Test & Demo | <script>alert('xss')</script> |"

			const result = parseTable(header, separator, rows)

			expect(result).toContain("Test & Demo")
			expect(result).toContain("<script>alert('xss')</script>")
		})

		it("应该处理不规则的表格（列数不匹配）", () => {
			const header = "| 列1 | 列2 | 列3 |"
			const separator = "| --- | --- | --- |"
			const rows = "| 数据1 | 数据2 |\n| A | B | C | D |" // 第一行少一列，第二行多一列

			const result = parseTable(header, separator, rows)

			expect(result).toContain("数据1")
			expect(result).toContain("数据2")
			expect(result).toContain("A")
			expect(result).toContain("B")
			expect(result).toContain("C")
			expect(result).toContain("D")
		})

		it("应该生成正确的HTML结构", () => {
			const header = "| 标题 |"
			const separator = "| --- |"
			const rows = "| 内容 |"

			const result = parseTable(header, separator, rows)

			expect(result).toMatch(/^<table>/)
			expect(result).toMatch(/<\/table>$/)
			expect(result).toContain("<thead><tr>")
			expect(result).toContain("</tr></thead>")
			expect(result).toContain("<tbody>")
			expect(result).toContain("</tbody>")
		})

		it("应该处理包含空格和制表符的表格", () => {
			const header = "|   姓名   |  年龄  |"
			const separator = "|   ---   | ---  |"
			const rows = "|  张三  |   25   |"

			const result = parseTable(header, separator, rows)

			expect(result).toContain("姓名")
			expect(result).toContain("年龄")
			expect(result).toContain("张三")
			expect(result).toContain("25")
			// 验证空格被正确trim了
			expect(result).not.toContain("   姓名   ")
		})

		it("应该处理Unicode字符", () => {
			const header = "| 🎯 目标 | 📊 数据 |"
			const separator = "| --- | --- |"
			const rows = "| 测试 | 100% |"

			const result = parseTable(header, separator, rows)

			expect(result).toContain("🎯 目标")
			expect(result).toContain("📊 数据")
			expect(result).toContain("测试")
			expect(result).toContain("100%")
		})

		it("应该处理分隔符中没有对齐指示符的情况", () => {
			const header = "| 列1 | 列2 |"
			const separator = "| | |" // 空分隔符
			const rows = "| 数据1 | 数据2 |"

			const result = parseTable(header, separator, rows)

			// 应该默认为左对齐
			expect(result).toContain('style="text-align:left"')
			expect(result).toContain("数据1")
			expect(result).toContain("数据2")
		})
	})

	describe("blockquote with code blocks", () => {
		it("should not split code blocks inside blockquotes", () => {
			const markdown = `> ### 引用中的标题
> 
> 引用中可以包含标题和其他格式。
> 
> \`\`\`javascript
> // 引用中的代码
> console.log('Hello from quote');
> \`\`\``

			const result = PreprocessService.preprocess(markdown)

			// 应该保持为一个完整的块，不被分割
			expect(result).toHaveLength(1)
			expect(result[0]).toContain("引用中的标题")
			expect(result[0]).toContain("console.log")
		})

		it("should split regular code blocks outside blockquotes", () => {
			const markdown = `# 普通标题

\`\`\`javascript
console.log('Outside quote');
\`\`\`

另一段文本`

			const result = PreprocessService.preprocess(markdown)

			// 应该被分割为3个块：标题、代码块、文本
			expect(result).toHaveLength(3)
			expect(result[0]).toContain("普通标题")
			expect(result[1]).toContain("console.log('Outside quote')")
			expect(result[2]).toContain("另一段文本")
		})

		it("should handle mixed blockquotes and regular content", () => {
			const markdown = `> 引用开始
> 
> \`\`\`javascript
> const inQuote = true;
> \`\`\`

\`\`\`javascript
const outsideQuote = true;
\`\`\`

更多文本`

			const result = PreprocessService.preprocess(markdown)

			// 应该被分割为3个块：引用（包含代码）、外部代码块、文本
			expect(result).toHaveLength(3)
			expect(result[0]).toContain("引用开始")
			expect(result[0]).toContain("inQuote")
			expect(result[1]).toContain("outsideQuote")
			expect(result[2]).toContain("更多文本")
		})

		it("should not split images inside blockquotes", () => {
			const markdown = `> 引用中的图片
> 
> ![alt text](image.jpg)
> 
> 更多引用内容`

			const result = PreprocessService.preprocess(markdown)

			// 应该保持为一个完整的块
			expect(result).toHaveLength(1)
			expect(result[0]).toContain("引用中的图片")
			expect(result[0]).toContain("![alt text](image.jpg)")
			expect(result[0]).toContain("更多引用内容")
		})
	})

	describe("isInsideBlockquote method", () => {
		it("should detect content inside blockquote", () => {
			const markdown = `> This is a quote
> with multiple lines
> 
> \`\`\`javascript
> console.log('test');
> \`\`\``

			const codeStart = markdown.indexOf("```javascript")
			const codeEnd = markdown.lastIndexOf("```") + 3

			// 使用私有方法进行测试（通过类型断言）
			const service = PreprocessService as any
			const result = service.isInsideBlockquote(markdown, codeStart, codeEnd)

			expect(result).toBe(true)
		})

		it("should detect content outside blockquote", () => {
			const markdown = `# Regular content

\`\`\`javascript
console.log('test');
\`\`\``

			const codeStart = markdown.indexOf("```javascript")
			const codeEnd = markdown.lastIndexOf("```") + 3

			// 使用私有方法进行测试
			const service = PreprocessService as any
			const result = service.isInsideBlockquote(markdown, codeStart, codeEnd)

			expect(result).toBe(false)
		})
	})
})
