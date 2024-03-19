import { describe, it, expect, beforeEach } from "vitest"
import { Editor } from "@tiptap/core"
import { StarterKit } from "@tiptap/starter-kit"
import { HeadingNode } from "../heading-node-extension"

describe("HeadingNode Extension", () => {
	let editor: Editor

	beforeEach(() => {
		// Cleanup previous editor if exists
		if (editor) {
			editor.destroy()
		}
	})

	it("should generate anchor IDs for headings on initial load", () => {
		// Create editor with markdown content
		editor = new Editor({
			extensions: [
				StarterKit.configure({
					heading: false, // Disable default heading
				}),
				HeadingNode.configure({
					levels: [1, 2, 3, 4, 5, 6],
				}),
			],
			content: `
				<h1>Hello World</h1>
				<p>Some text</p>
				<h2>API 开发</h2>
				<p>More text</p>
			`,
		})

		// Wait for plugins to initialize
		// Check if heading nodes have IDs
		let h1Id: string | null = null
		let h2Id: string | null = null

		editor.state.doc.descendants((node) => {
			if (node.type.name === "heading") {
				if (node.attrs.level === 1) {
					h1Id = node.attrs.id
				} else if (node.attrs.level === 2) {
					h2Id = node.attrs.id
				}
			}
		})

		expect(h1Id).toBe("hello-world")
		expect(h2Id).toBe("api-开发")
	})

	it("should update anchor IDs when heading text changes", () => {
		editor = new Editor({
			extensions: [
				StarterKit.configure({
					heading: false,
				}),
				HeadingNode,
			],
			content: "<h1>Original Title</h1>",
		})

		// Check initial ID
		let headingId: string | null = null
		editor.state.doc.descendants((node) => {
			if (node.type.name === "heading") {
				headingId = node.attrs.id
			}
		})
		expect(headingId).toBe("original-title")

		// Update heading text
		editor
			.chain()
			.focus()
			.setTextSelection({ from: 1, to: 15 }) // Select "Original Title"
			.insertContent("New Title")
			.run()

		// Check updated ID
		headingId = null
		editor.state.doc.descendants((node) => {
			if (node.type.name === "heading") {
				headingId = node.attrs.id
			}
		})
		expect(headingId).toBe("new-title")
	})

	it("should generate unique IDs for duplicate headings", () => {
		editor = new Editor({
			extensions: [
				StarterKit.configure({
					heading: false,
				}),
				HeadingNode,
			],
			content: `
				<h1>测试</h1>
				<h2>测试</h2>
				<h3>测试</h3>
			`,
		})

		const headingIds: string[] = []
		editor.state.doc.descendants((node) => {
			if (node.type.name === "heading") {
				headingIds.push(node.attrs.id)
			}
		})

		expect(headingIds).toEqual(["测试", "测试-1", "测试-2"])
	})

	it("should handle headings with special characters", () => {
		editor = new Editor({
			extensions: [
				StarterKit.configure({
					heading: false,
				}),
				HeadingNode,
			],
			content: `
				<h1>Bug-001-登录失败</h1>
				<h2>ES6+ 新特性</h2>
				<h3>第一阶段：规划</h3>
			`,
		})

		const headingIds: string[] = []
		editor.state.doc.descendants((node) => {
			if (node.type.name === "heading") {
				headingIds.push(node.attrs.id)
			}
		})

		expect(headingIds[0]).toBe("bug-001-登录失败")
		expect(headingIds[1]).toBe("es6-新特性")
		expect(headingIds[2]).toBe("第一阶段规划")
	})

	it("should remove ID when heading becomes empty", () => {
		editor = new Editor({
			extensions: [
				StarterKit.configure({
					heading: false,
				}),
				HeadingNode,
			],
			content: "<h1>Title</h1>",
		})

		// Check initial ID
		let headingId: string | null = null
		editor.state.doc.descendants((node) => {
			if (node.type.name === "heading") {
				headingId = node.attrs.id
			}
		})
		expect(headingId).toBe("title")

		// Delete heading content
		editor.chain().focus().setTextSelection({ from: 1, to: 6 }).deleteSelection().run()

		// Check ID is removed
		headingId = "not-null"
		editor.state.doc.descendants((node) => {
			if (node.type.name === "heading") {
				headingId = node.attrs.id
			}
		})
		expect(headingId).toBeNull()
	})

	it("should work with task list scenario titles", () => {
		editor = new Editor({
			extensions: [
				StarterKit.configure({
					heading: false,
				}),
				HeadingNode,
			],
			content: `
				<h2>项目任务清单</h2>
				<h3>第一阶段：规划</h3>
				<h4>需求收集</h4>
				<h4>技术选型</h4>
				<h4>架构设计</h4>
				<h3>第二阶段：开发</h3>
				<h4>环境搭建</h4>
				<h4>数据库设计</h4>
				<h4>API 开发</h4>
				<h4>前端开发</h4>
			`,
		})

		const headingIds: string[] = []
		editor.state.doc.descendants((node) => {
			if (node.type.name === "heading") {
				headingIds.push(node.attrs.id)
			}
		})

		expect(headingIds).toContain("项目任务清单")
		expect(headingIds).toContain("第一阶段规划")
		expect(headingIds).toContain("需求收集")
		expect(headingIds).toContain("技术选型")
		expect(headingIds).toContain("架构设计")
		expect(headingIds).toContain("第二阶段开发")
		expect(headingIds).toContain("环境搭建")
		expect(headingIds).toContain("数据库设计")
		expect(headingIds).toContain("api-开发")
		expect(headingIds).toContain("前端开发")
	})

	it("should preserve IDs when content is set programmatically", () => {
		editor = new Editor({
			extensions: [
				StarterKit.configure({
					heading: false,
				}),
				HeadingNode,
			],
			content: "",
		})

		// Set new content programmatically (simulating document switch)
		editor.commands.setContent(`
			<h1>需求分析</h1>
			<p>Content here</p>
			<h2>核心功能开发</h2>
		`)

		const headingIds: string[] = []
		editor.state.doc.descendants((node) => {
			if (node.type.name === "heading") {
				headingIds.push(node.attrs.id)
			}
		})

		expect(headingIds).toEqual(["需求分析", "核心功能开发"])
	})
})
