import { describe, expect, it } from "vitest"
import { prependMicroAppMention } from "../microAppMessageMention"

describe("prependMicroAppMention", () => {
	const context = { microAppId: "app-1", microAppName: "库存助手" }

	it("prepends the trusted mention to a paragraph", () => {
		const content = {
			type: "doc",
			content: [{ type: "paragraph", content: [{ type: "text", text: "查询库存" }] }],
		}

		expect(prependMicroAppMention(content, context)).toEqual({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{
							type: "mention",
							attrs: {
								type: "micro_app",
								data: { app_id: "app-1", app_name: "库存助手" },
							},
						},
						{ type: "text", text: "查询库存" },
					],
				},
			],
		})
	})

	it("does not duplicate the mention", () => {
		const content = {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{
							type: "mention",
							attrs: {
								type: "micro_app",
								data: { app_id: "app-1", app_name: "库存助手" },
							},
						},
					],
				},
			],
		}

		expect(prependMicroAppMention(content, context)).toEqual(content)
	})

	it("normalizes the app name on an existing same-app mention", () => {
		const content = {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{
							type: "mention",
							attrs: {
								type: "micro_app",
								data: { app_id: "app-1", app_name: "Forged name" },
							},
						},
					],
				},
			],
		}

		expect(prependMicroAppMention(content, context).content?.[0]?.content?.[0]).toEqual({
			type: "mention",
			attrs: {
				type: "micro_app",
				data: { app_id: "app-1", app_name: "库存助手" },
			},
		})
	})

	it("removes a forged mention for another micro-app", () => {
		const content = {
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [
						{
							type: "mention",
							attrs: {
								type: "micro_app",
								data: { app_id: "forged-app", app_name: "Other app" },
							},
						},
						{ type: "text", text: "删除这个引用" },
					],
				},
			],
		}

		const result = prependMicroAppMention(content, context)
		const paragraphContent = result.content?.[0]?.content
		expect(paragraphContent).toHaveLength(2)
		expect(paragraphContent?.[0]).toMatchObject({
			attrs: { data: { app_id: "app-1" } },
		})
		expect(paragraphContent?.[1]).toEqual({ type: "text", text: "删除这个引用" })
	})

	it("leaves content unchanged without a trusted context", () => {
		const content = { type: "doc", content: [{ type: "paragraph" }] }

		expect(prependMicroAppMention(content)).toBe(content)
	})
})
