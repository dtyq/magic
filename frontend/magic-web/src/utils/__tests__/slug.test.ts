import { describe, it, expect } from "vitest"
import { slugify, generateUniqueSlug } from "../slug"

describe("slugify", () => {
	it("should handle basic English text", () => {
		expect(slugify("Hello World")).toBe("hello-world")
		expect(slugify("API Development")).toBe("api-development")
	})

	it("should handle Chinese text", () => {
		expect(slugify("需求分析")).toBe("需求分析")
		expect(slugify("核心功能开发")).toBe("核心功能开发")
	})

	it("should handle mixed Chinese and English", () => {
		expect(slugify("API 开发")).toBe("api-开发")
		expect(slugify("React 入门")).toBe("react-入门")
	})

	it("should handle text with hyphens and numbers", () => {
		expect(slugify("Bug-001-登录失败")).toBe("bug-001-登录失败")
		expect(slugify("Bug-002-数据丢失")).toBe("bug-002-数据丢失")
	})

	it("should handle text with special characters", () => {
		expect(slugify("ES6+ 新特性")).toBe("es6-新特性")
		expect(slugify("HTML 基础")).toBe("html-基础")
		expect(slugify("TypeScript")).toBe("typescript")
	})

	it("should handle text with multiple spaces", () => {
		expect(slugify("Hello   World")).toBe("hello-world")
		expect(slugify("API  开发  测试")).toBe("api-开发-测试")
	})

	it("should remove leading and trailing hyphens", () => {
		expect(slugify("-Hello-")).toBe("hello")
		expect(slugify("--Test--")).toBe("test")
	})

	it("should handle empty strings", () => {
		expect(slugify("")).toBe("")
		expect(slugify("   ")).toBe("")
	})

	it("should handle text with underscores", () => {
		expect(slugify("user_profile")).toBe("user_profile")
		expect(slugify("get_user_data")).toBe("get_user_data")
	})

	it("should handle task list scenario titles", () => {
		expect(slugify("需求收集")).toBe("需求收集")
		expect(slugify("技术选型")).toBe("技术选型")
		expect(slugify("架构设计")).toBe("架构设计")
		expect(slugify("环境搭建")).toBe("环境搭建")
		expect(slugify("数据库设计")).toBe("数据库设计")
		expect(slugify("API 开发")).toBe("api-开发")
		expect(slugify("前端开发")).toBe("前端开发")
	})

	it("should handle phase titles", () => {
		expect(slugify("第一阶段：规划")).toBe("第一阶段规划")
		expect(slugify("第二阶段：开发")).toBe("第二阶段开发")
		expect(slugify("第三阶段：测试")).toBe("第三阶段测试")
	})

	it("should handle complex bug titles", () => {
		expect(slugify("Bug-004-UI-显示错误")).toBe("bug-004-ui-显示错误")
		expect(slugify("Bug-005-表单验证")).toBe("bug-005-表单验证")
		expect(slugify("Bug-006-兼容性问题")).toBe("bug-006-兼容性问题")
	})
})

describe("generateUniqueSlug", () => {
	it("should generate unique slug without suffix for first occurrence", () => {
		const idSet = new Set<string>()
		expect(generateUniqueSlug("Hello World", idSet)).toBe("hello-world")
		expect(idSet.has("hello-world")).toBe(true)
	})

	it("should add numeric suffix for duplicate slugs", () => {
		const idSet = new Set<string>()
		expect(generateUniqueSlug("测试", idSet)).toBe("测试")
		expect(generateUniqueSlug("测试", idSet)).toBe("测试-1")
		expect(generateUniqueSlug("测试", idSet)).toBe("测试-2")
	})

	it("should handle empty text", () => {
		const idSet = new Set<string>()
		expect(generateUniqueSlug("", idSet)).toBe("")
		expect(generateUniqueSlug("   ", idSet)).toBe("")
	})

	it("should maintain uniqueness across mixed content", () => {
		const idSet = new Set<string>()
		expect(generateUniqueSlug("API 开发", idSet)).toBe("api-开发")
		expect(generateUniqueSlug("api-开发", idSet)).toBe("api-开发-1")
		expect(generateUniqueSlug("API  开发", idSet)).toBe("api-开发-2")
	})
})
