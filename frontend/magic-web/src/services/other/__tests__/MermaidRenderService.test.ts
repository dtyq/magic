import { describe, it, expect, vi, beforeEach, Mock } from "vitest"
// @ts-ignore
import MermaidRenderService from "../MermaidRenderService"
import type { RenderResult } from "mermaid"

// Mock the database module
vi.mock("@/opensource/database/mermaid", () => ({
	initMermaidDb: vi.fn(() => ({
		mermaid: {
			toArray: vi.fn().mockResolvedValue([
				{
					data: "cached-chart",
					svg: "<svg>cached</svg>",
					png: "cached-png-data",
				},
			]),
			put: vi.fn().mockResolvedValue(undefined),
			where: vi.fn(() => ({
				equals: vi.fn(() => ({
					first: vi.fn().mockResolvedValue(null),
				})),
			})),
		},
	})),
}))

describe("MermaidRenderService", () => {
	let service: typeof MermaidRenderService
	let mockDb: any

	beforeEach(() => {
		// Reset the service instance
		service = MermaidRenderService
		mockDb = service.db

		// Clear cache before each test
		service.cacheSvg.clear()

		// Reset mocks
		vi.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize the database", () => {
			// Arrange & Act & Assert
			// The constructor is already called when the module is imported
			// Just verify the service has been initialized with the database
			expect(service.db).toBeDefined()
			expect(service.cacheSvg).toBeInstanceOf(Map)
		})
	})

	describe("isErrorSvg", () => {
		it("should return true when svg contains error pattern", () => {
			// Arrange
			const errorSvg = "<svg><g></g></svg>"

			// Act
			const result = service.isErrorSvg(errorSvg)

			// Assert
			expect(result).toBe(true)
		})

		it("should return false when svg does not contain error pattern", () => {
			// Arrange
			const validSvg = '<svg><path d="M10 10"></path></svg>'

			// Act
			const result = service.isErrorSvg(validSvg)

			// Assert
			expect(result).toBe(false)
		})

		it("should return false for empty svg", () => {
			// Arrange
			const emptySvg = ""

			// Act
			const result = service.isErrorSvg(emptySvg)

			// Assert
			expect(result).toBe(false)
		})
	})

	describe("cache", () => {
		it("should cache new svg successfully", async () => {
			// Arrange
			const chart = "flowchart TD\n    A --> B"
			const renderResult: RenderResult = {
				svg: "<svg>test</svg>",
				diagramType: "flowchart",
			}

			// Act
			const result = service.cache(chart, renderResult)

			// Assert
			expect(result).toEqual({
				data: chart,
				svg: renderResult.svg,
				diagramType: renderResult.diagramType,
				png: "",
			})
			expect(service.cacheSvg.has(chart)).toBe(true)
			expect(mockDb.mermaid.put).toHaveBeenCalledWith({
				data: chart,
				svg: renderResult.svg,
				diagramType: renderResult.diagramType,
				png: "",
			})
		})

		it("should return existing cache when svg is the same", () => {
			// Arrange
			const chart = "flowchart TD\n    A --> B"
			const existingCache = {
				data: chart,
				svg: "<svg>test</svg>",
				png: "existing-png",
			}
			service.cacheSvg.set(chart, existingCache)

			const renderResult: RenderResult = {
				svg: "<svg>test</svg>",
				diagramType: "flowchart",
			}

			// Act
			const result = service.cache(chart, renderResult)

			// Assert
			expect(result).toEqual(existingCache)
			expect(mockDb.mermaid.put).not.toHaveBeenCalled()
		})

		it("should return undefined for error svg", () => {
			// Arrange
			const chart = "invalid chart"
			const errorRenderResult: RenderResult = {
				svg: "<svg><g></g></svg>",
				diagramType: "flowchart",
			}

			// Act
			const result = service.cache(chart, errorRenderResult)

			// Assert
			expect(result).toBeUndefined()
			expect(service.cacheSvg.has(chart)).toBe(false)
			expect(mockDb.mermaid.put).not.toHaveBeenCalled()
		})

		it("should handle database put error gracefully", async () => {
			// Arrange
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			mockDb.mermaid.put.mockRejectedValue(new Error("Database error"))

			const chart = "flowchart TD\n    A --> B"
			const renderResult: RenderResult = {
				svg: "<svg>test</svg>",
				diagramType: "flowchart",
			}

			// Act
			const result = service.cache(chart, renderResult)

			// Assert
			expect(result).toBeDefined()
			expect(service.cacheSvg.has(chart)).toBe(true)

			// Wait for async operation to complete and check error handling
			await new Promise((resolve) => setTimeout(resolve, 10))
			expect(consoleSpy).toHaveBeenCalledWith("缓存失败", expect.any(Error))
			consoleSpy.mockRestore()
		})
	})

	describe("getCache", () => {
		it("should return cache from memory when available", async () => {
			// Arrange
			const chart = "test-chart"
			const cachedData = {
				data: chart,
				svg: "<svg>cached</svg>",
				png: "cached-png",
			}
			service.cacheSvg.set(chart, cachedData)

			// Act
			const result = await service.getCache(chart)

			// Assert
			expect(result).toEqual(cachedData)
			expect(mockDb.mermaid.where).not.toHaveBeenCalled()
		})

		it("should fetch from database when not in memory cache", async () => {
			// Arrange
			const chart = "test-chart"
			const dbData = {
				data: chart,
				svg: "<svg>from-db</svg>",
				png: "db-png",
			}

			const mockFirst = vi.fn().mockResolvedValue(dbData)
			const mockEquals = vi.fn().mockReturnValue({ first: mockFirst })
			mockDb.mermaid.where.mockReturnValue({ equals: mockEquals })

			// Act
			const result = await service.getCache(chart)

			// Assert
			expect(result).toEqual(dbData)
			expect(mockDb.mermaid.where).toHaveBeenCalledWith("data")
			expect(mockEquals).toHaveBeenCalledWith(chart)
			expect(mockFirst).toHaveBeenCalled()
			expect(service.cacheSvg.has(chart)).toBe(true)
		})

		it("should return undefined when not found in cache or database", async () => {
			// Arrange
			const chart = "non-existent-chart"

			const mockFirst = vi.fn().mockResolvedValue(null)
			const mockEquals = vi.fn().mockReturnValue({ first: mockFirst })
			mockDb.mermaid.where.mockReturnValue({ equals: mockEquals })

			// Act
			const result = await service.getCache(chart)

			// Assert
			expect(result).toBeUndefined()
			expect(mockDb.mermaid.where).toHaveBeenCalledWith("data")
			expect(mockEquals).toHaveBeenCalledWith(chart)
			expect(mockFirst).toHaveBeenCalled()
		})
	})

	describe("fix", () => {
		it("should return empty string for undefined input", () => {
			// Arrange
			const input = undefined

			// Act
			const result = service.fix(input)

			// Assert
			expect(result).toBe("")
		})

		it("should return empty string for null input", () => {
			// Arrange
			const input = null as any

			// Act
			const result = service.fix(input)

			// Assert
			expect(result).toBe("")
		})

		it("should return empty string for empty string input", () => {
			// Arrange
			const input = ""

			// Act
			const result = service.fix(input)

			// Assert
			expect(result).toBe("")
		})

		it("should replace Chinese punctuation with English punctuation", () => {
			// Arrange
			const input = "这是一个测试，包含中文符号：分号；感叹号！问号？"

			// Act
			const result = service.fix(input)

			// Assert
			expect(result).toBe("这是一个测试, 包含中文符号: 分号; 感叹号! 问号? ")
		})

		it("should replace Chinese brackets and quotes", () => {
			// Arrange
			const input = '测试（括号）和"引号"以及【方括号】'

			// Act
			const result = service.fix(input)

			// Assert
			expect(result).toBe('测试 (括号) 和"引号"以及 [方括号] ')
		})

		it("should replace Chinese symbols with their equivalents", () => {
			// Arrange
			const input = "Temperature: 25°C, Price: ¥100"

			// Act
			const result = service.fix(input)

			// Assert
			expect(result).toBe("Temperature: 25度C, Price: 元100")
		})

		it("should handle mixed Chinese and English punctuation", () => {
			// Arrange
			const input = "Hello，世界！This is a test。"

			// Act
			const result = service.fix(input)

			// Assert
			expect(result).toBe("Hello, 世界! This is a test.")
		})

		it("should preserve text without Chinese punctuation", () => {
			// Arrange
			const input = "This is English text with normal punctuation."

			// Act
			const result = service.fix(input)

			// Assert
			expect(result).toBe("This is English text with normal punctuation.")
		})

		it("should handle special characters correctly", () => {
			// Arrange
			const input = "连接符-和波浪号~保持不变"

			// Act
			const result = service.fix(input)

			// Assert
			expect(result).toBe("连接符-和波浪号~保持不变")
		})

		it("should handle multiple occurrences of the same punctuation", () => {
			// Arrange
			const input = "多个，逗号，测试，结果。"

			// Act
			const result = service.fix(input)

			// Assert
			expect(result).toBe("多个, 逗号, 测试, 结果.")
		})

		it("should fix Chinese punctuation in gantt chart with talent development plan", () => {
			// Arrange
			const input = `gantt
       title 移动端人才梯队建设计划
       dateFormat  YYYY-Q
       section iOS开发
       导师制培养        ：active,  des1, 2023-Q3, 2024-Q1
       外部大牛工作坊    ：         des2, 2024-Q2, 2024-Q3
       section Flutter架构
       技术攻关小组      ：         des3, 2023-Q4, 2024-Q2`

			// Act
			const result = service.fix(input)

			// Assert
			expect(result).toBe(`gantt
       title 移动端人才梯队建设计划
       dateFormat  YYYY-Q
       section iOS开发
       导师制培养        : active,  des1, 2023-Q3, 2024-Q1
       外部大牛工作坊    :          des2, 2024-Q2, 2024-Q3
       section Flutter架构
       技术攻关小组      :          des3, 2023-Q4, 2024-Q2`)
		})

		it("should fix Chinese punctuation in pie chart with talent distribution", () => {
			// Arrange
			const input = `pie
    title 人才盘点九宫格分布
    "超级明星（3%）" ： 6
    "绩效之星（12%）" ： 22
    "中坚力量（28%）" ： 52
    "熟练员工（25%）" ： 47
    "稳定员工（20%）" ： 37
    "潜力之星（8%）" ： 15
    "待发展者（3%）" ： 6
    "差距员工（1%）" ： 2`

			// Act
			const result = service.fix(input)

			// Assert
			expect(result).toBe(`pie
    title 人才盘点九宫格分布
    "超级明星 (3%) " :  6
    "绩效之星 (12%) " :  22
    "中坚力量 (28%) " :  52
    "熟练员工 (25%) " :  47
    "稳定员工 (20%) " :  37
    "潜力之星 (8%) " :  15
    "待发展者 (3%) " :  6
    "差距员工 (1%) " :  2`)
		})

		it("should fix Chinese punctuation in gantt chart with ROI analysis", () => {
			// Arrange
			const input = `gantt
    title 人力ROI分析模型
    section 关键指标
    人才留存率 ：a1, 2023-07, 30d
    高潜投产比 ：a2, after a1, 45d
    离职成本预警 ：a3, after a2, 20d`

			// Act
			const result = service.fix(input)

			// Assert
			expect(result).toBe(`gantt
    title 人力ROI分析模型
    section 关键指标
    人才留存率 : a1, 2023-07, 30d
    高潜投产比 : a2, after a1, 45d
    离职成本预警 : a3, after a2, 20d`)
		})

		describe("enhanced syntax fixes", () => {
			it("should fix multiline classDef definitions", () => {
				// Arrange
				const input = `flowchart TD
      A([开始]) --> B[显示登录页面]
      
      %% 设置样式
      classDef start 
  fill:#9f6,stroke:#333,stroke-width:2px;
      classDef end fill:#f96,stroke:#333,stroke-width:2px;
      classDef process 
  fill:#fff,stroke:#333,stroke-width:1px;
      classDef decision 
  fill:#ffc,stroke:#333,stroke-width:1px;
      
      %% 应用样式
      class A start;
      class B process;`

				// Act
				const result = service.fix(input)

				// Assert
				expect(result).toContain(
					"classDef startStyle fill:#9f6,stroke:#333,stroke-width:2px;",
				)
				expect(result).toContain("classDef process fill:#fff,stroke:#333,stroke-width:1px;")
				expect(result).toContain(
					"classDef decision fill:#ffc,stroke:#333,stroke-width:1px;",
				)
				expect(result).toContain("class A startStyle;")
				expect(result).toContain("class B process;")
			})

			it("should remove trailing backslashes", () => {
				// Arrange
				const input = `flowchart TD
      A --> B
      class A start;\\
      class B process;\\\\
      classDef default fill:#f9f;\\`

				// Act
				const result = service.fix(input)

				// Assert
				expect(result).not.toContain("\\")
				expect(result).toContain("class A startStyle;")
				expect(result).toContain("class B process;")
				expect(result).toContain("classDef defaultStyle fill:#f9f;")
			})

			it("should handle the complete problematic mermaid diagram", () => {
				// Arrange
				const input = `flowchart TD
      A([开始]) --> B[显示登录页面]
      B --> C[用户输入用户名和密码]
      C --> D{验证信息}
      D -->|验证成功| E[登录成功]
      D -->|验证失败| F[显示错误信息]
      F --> C
      E --> G[进入系统主页]
      G --> H([结束])

      %% 设置样式
      classDef start 
  fill:#9f6,stroke:#333,stroke-width:2px;
      classDef end fill:#f96,stroke:#333,stroke-width:2px;
      classDef process 
  fill:#fff,stroke:#333,stroke-width:1px;
      classDef decision 
  fill:#ffc,stroke:#333,stroke-width:1px;
      
      %% 应用样式
      class A start;
      class H end;
      class B,C,E,F,G process;
      class D decision;\\`

				// Act
				const result = service.fix(input)

				// Assert
				// Check that classDef definitions are properly formatted
				expect(result).toContain(
					"classDef startStyle fill:#9f6,stroke:#333,stroke-width:2px;",
				)
				expect(result).toContain(
					"classDef endStyle fill:#f96,stroke:#333,stroke-width:2px;",
				)
				expect(result).toContain("classDef process fill:#fff,stroke:#333,stroke-width:1px;")
				expect(result).toContain(
					"classDef decision fill:#ffc,stroke:#333,stroke-width:1px;",
				)

				// Check that trailing backslashes are removed
				expect(result).not.toContain("\\")

				// Check that the flowchart structure is preserved
				expect(result).toContain("flowchart TD")
				expect(result).toContain("A([开始]) --> B[显示登录页面]")
				expect(result).toContain("D -->|验证成功| E[登录成功]")
				expect(result).toContain("D -->|验证失败| F[显示错误信息]")

				// Check that class assignments are preserved
				expect(result).toContain("class A startStyle;")
				expect(result).toContain("class H endStyle;")
				expect(result).toContain("class B,C,E,F,G process;")
				expect(result).toContain("class D decision;")
			})

			it("should handle multiple classDef definitions with different formatting", () => {
				// Arrange
				const input = `flowchart TD
      A --> B
      
      classDef class1 
  fill:#f9f,stroke:#333;
      classDef class2 
  fill:#9ff,stroke:#666;
      classDef class3 fill:#ff9,stroke:#999;
      
      class A class1;
      class B class2;\\`

				// Act
				const result = service.fix(input)

				// Assert
				expect(result).toContain("classDef class1 fill:#f9f,stroke:#333;")
				expect(result).toContain("classDef class2 fill:#9ff,stroke:#666;")
				expect(result).toContain("classDef class3 fill:#ff9,stroke:#999;")
				expect(result).not.toContain("\\")
			})

			it("should normalize whitespace and remove empty lines", () => {
				// Arrange
				const input = `flowchart TD
      A   -->   B
      
      
      B   -->   C
      
      classDef default fill:#f9f;
      
      
      class A default;`

				// Act
				const result = service.fix(input)

				// Assert
				const lines = result.split("\n").filter((line) => line.trim() !== "")
				expect(lines.length).toBeGreaterThan(0)
				expect(result).toContain("flowchart TD")
				expect(result).toContain("A   -->   B")
				expect(result).toContain("B   -->   C")
				expect(result).toContain("classDef defaultStyle fill:#f9f;")
				expect(result).toContain("class A defaultStyle;")
			})

			it("should handle empty input and whitespace-only input", () => {
				// Arrange & Act & Assert
				expect(service.fix("")).toBe("")
				expect(service.fix(undefined)).toBe("")
				expect(service.fix("   \n   \n   ")).toBe("")
			})

			it("should handle input without syntax errors", () => {
				// Arrange
				const input = `flowchart TD
      A --> B
      B --> C
      classDef default fill:#f9f,stroke:#333,stroke-width:2px;
      class A default;`

				// Act
				const result = service.fix(input)

				// Assert
				expect(result).toContain("flowchart TD")
				expect(result).toContain("A --> B")
				expect(result).toContain("B --> C")
				expect(result).toContain(
					"classDef defaultStyle fill:#f9f,stroke:#333,stroke-width:2px;",
				)
				expect(result).toContain("class A defaultStyle;")
			})

			it("should preserve bracket content while fixing syntax", () => {
				// Arrange
				const input = `flowchart TD
      A[用户输入：用户名，密码] --> B[验证信息]
      B --> C{验证结果？}
      C -->|成功| D[进入系统！]
      
      classDef process 
  fill:#fff,stroke:#333;
      
      class A,B,D process;\\`

				// Act
				const result = service.fix(input)

				// Assert
				// Content inside [] should be preserved
				expect(result).toContain("[用户输入：用户名，密码]")
				expect(result).toContain("[验证信息]")
				expect(result).toContain("[进入系统！]")

				// But content outside [] should be converted
				expect(result).toContain("验证结果? ")

				// classDef should be fixed
				expect(result).toContain("classDef process fill:#fff,stroke:#333;")

				// Backslashes should be removed
				expect(result).not.toContain("\\")
			})

			it("should fix reserved keywords in classDef and class statements", () => {
				// Arrange
				const input = `flowchart TD
      A([开始]) --> B[显示登录页面]
      B --> C[用户输入用户名和密码]
      C --> D{验证信息}
      D -->|验证成功| E[登录成功]
      D -->|验证失败| F[显示错误信息]
      F --> C
      E --> G[进入系统主页]
      G --> H([结束])
      %% 设置样式
      classDef start fill:#9f6,stroke:#333,stroke-width:2px;
      classDef end fill:#f96,stroke:#333,stroke-width:2px;
      classDef process fill:#fff,stroke:#333,stroke-width:1px;
      classDef decision fill:#ffc,stroke:#333,stroke-width:1px;
      %% 应用样式
      class A start;
      class H end;
      class B,C,E,F,G process;
      class D decision;`

				// Act
				const result = service.fix(input)

				// Assert
				// Reserved keywords should be converted to non-reserved versions
				expect(result).toContain(
					"classDef startStyle fill:#9f6,stroke:#333,stroke-width:2px;",
				)
				expect(result).toContain(
					"classDef endStyle fill:#f96,stroke:#333,stroke-width:2px;",
				)
				expect(result).toContain("classDef process fill:#fff,stroke:#333,stroke-width:1px;")
				expect(result).toContain(
					"classDef decision fill:#ffc,stroke:#333,stroke-width:1px;",
				)

				// Class statements should use the new names
				expect(result).toContain("class A startStyle;")
				expect(result).toContain("class H endStyle;")
				expect(result).toContain("class B,C,E,F,G process;")
				expect(result).toContain("class D decision;")

				// Should not contain the original reserved keywords
				expect(result).not.toContain("classDef start ")
				expect(result).not.toContain("classDef end ")
				expect(result).not.toContain("class A start;")
				expect(result).not.toContain("class H end;")
			})

			it("should fix double quotes in node labels", () => {
				// Arrange
				const input = `flowchart TD
      A([开始]) --> B[显示登录页面]
      B --> C[用户输入用户名和密码]
      C --> D{验证信息}
      D -->|验证成功| E[登录成功]
      D -->|验证失败| F[显示错误信息]
      F --> C
      B --> G[用户点击"忘记密码"]
      G --> H[显示密码重置页面]
      H --> I[用户输入注册邮箱]
      I --> J[发送重置链接]
      J --> K[用户点击邮件中的链接]
      K --> L[显示新密码设置页面]
      L --> M[用户设置新密码]
      M --> B
      E --> N[进入系统主页]
      N --> O([结束])`

				// Act
				const result = service.fix(input)

				// Assert
				// Double quotes should be converted to single quotes
				expect(result).toContain("[用户点击'忘记密码']")
				expect(result).not.toContain('[用户点击"忘记密码"]')

				// Other content should remain unchanged
				expect(result).toContain("A([开始]) --> B[显示登录页面]")
				expect(result).toContain("C --> D{验证信息}")
				expect(result).toContain("D -->|验证成功| E[登录成功]")
			})

			it("should handle multiple quotes in the same node label", () => {
				// Arrange
				const input = `flowchart TD
      A --> B[点击"确定"按钮]
      B --> C[显示"操作成功"提示]
      C --> D[返回"主页面"]`

				// Act
				const result = service.fix(input)

				// Assert
				expect(result).toContain("[点击'确定'按钮]")
				expect(result).toContain("[显示'操作成功'提示]")
				expect(result).toContain("[返回'主页面']")
				expect(result).not.toContain('"确定"')
				expect(result).not.toContain('"操作成功"')
				expect(result).not.toContain('"主页面"')
			})

			it("should fix the original user case with reserved keywords", () => {
				// Arrange - Original user case that caused parse error
				const input = `flowchart TD
    A([开始]) --> B[显示登录页面]
    B --> C[用户输入用户名和密码]
    C --> D{验证信息}
    D -->|验证成功| E[登录成功]
    D -->|验证失败| F[显示错误信息]
    F --> C
    E --> G[进入系统主页]
    G --> H([结束])
    %% 设置样式
    classDef start fill:#9f6,stroke:#333,stroke-width:2px;
    classDef end fill:#f96,stroke:#333,stroke-width:2px;
    classDef process fill:#fff,stroke:#333,stroke-width:1px;
    classDef decision fill:#ffc,stroke:#333,stroke-width:1px;
    %% 应用样式
    class A start;
    class H end;
    class B,C,E,F,G process;
    class D decision;`

				// Act
				const result = service.fix(input)

				// Assert
				// Reserved keywords should be fixed
				expect(result).toContain(
					"classDef startStyle fill:#9f6,stroke:#333,stroke-width:2px;",
				)
				expect(result).toContain(
					"classDef endStyle fill:#f96,stroke:#333,stroke-width:2px;",
				)
				expect(result).toContain("classDef process fill:#fff,stroke:#333,stroke-width:1px;")
				expect(result).toContain(
					"classDef decision fill:#ffc,stroke:#333,stroke-width:1px;",
				)

				// Class assignments should use the new names
				expect(result).toContain("class A startStyle;")
				expect(result).toContain("class H endStyle;")
				expect(result).toContain("class B,C,E,F,G process;")
				expect(result).toContain("class D decision;")

				// Should not contain the problematic reserved keywords
				expect(result).not.toContain("classDef start ")
				expect(result).not.toContain("classDef end ")
				expect(result).not.toContain("class A start;")
				expect(result).not.toContain("class H end;")

				// Flowchart structure should be preserved
				expect(result).toContain("flowchart TD")
				expect(result).toContain("A([开始]) --> B[显示登录页面]")
				expect(result).toContain("D -->|验证成功| E[登录成功]")
				expect(result).toContain("D -->|验证失败| F[显示错误信息]")
			})

			it("should fix the complex login flow case with double quotes", () => {
				// Arrange - Second user case with double quotes that caused parse error
				const input = `flowchart TD
    A([开始]) --> B[显示登录页面]
    B --> C[用户输入用户名和密码]
    %% 主登录流程
    C --> D{验证信息}
    D -->|验证成功| E[登录成功]
    D -->|验证失败| F[显示错误信息]
    F --> C
    %% 找回密码流程
    B --> G[用户点击"忘记密码"]
    G --> H[显示密码重置页面]
    H --> I[用户输入注册邮箱]
    I --> J[发送重置链接]
    J --> K[用户点击邮件中的链接]
    K --> L[显示新密码设置页面]
    L --> M[用户设置新密码]
    M --> B
    %% 主流程结束
    E --> N[进入系统主页]
    N --> O([结束])
    %% 设置样式
    classDef startStyle fill:#9f6,stroke:#333,stroke-width:2px;
    classDef endStyle fill:#f96,stroke:#333,stroke-width:2px;
    classDef process fill:#fff,stroke:#333,stroke-width:1px;
    classDef decision fill:#ffc,stroke:#333,stroke-width:1px;
    %% 应用样式
    class A startStyle;
    class O endStyle;
    class B,C,E,F,G,H,I,J,K,L,M,N process;
    class D decision;`

				// Act
				const result = service.fix(input)

				// Assert
				// Double quotes in node labels should be fixed
				expect(result).toContain("[用户点击'忘记密码']")
				expect(result).toContain("[用户点击邮件中的链接]")
				expect(result).not.toContain('[用户点击"忘记密码"]')

				// Flowchart structure should be preserved
				expect(result).toContain("flowchart TD")
				expect(result).toContain("A([开始]) --> B[显示登录页面]")
				expect(result).toContain("B --> G[用户点击'忘记密码']")
				expect(result).toContain("G --> H[显示密码重置页面]")
				expect(result).toContain("D -->|验证成功| E[登录成功]")
				expect(result).toContain("D -->|验证失败| F[显示错误信息]")

				// Comments should be preserved
				expect(result).toContain("%% 主登录流程")
				expect(result).toContain("%% 找回密码流程")
				expect(result).toContain("%% 主流程结束")
				expect(result).toContain("%% 设置样式")
				expect(result).toContain("%% 应用样式")

				// Class definitions and assignments should work correctly
				expect(result).toContain(
					"classDef startStyle fill:#9f6,stroke:#333,stroke-width:2px;",
				)
				expect(result).toContain(
					"classDef endStyle fill:#f96,stroke:#333,stroke-width:2px;",
				)
				expect(result).toContain("class A startStyle;")
				expect(result).toContain("class O endStyle;")
				expect(result).toContain("class B,C,E,F,G,H,I,J,K,L,M,N process;")
				expect(result).toContain("class D decision;")
			})
		})
	})
})
