import { describe, it, expect } from "vitest"
import type { JSONContent } from "@tiptap/core"
import { replaceExistQuickInstruction, transformQuickInstruction } from "../index"
import { ExtensionName } from "../../extension/constants"

describe("replaceQuickInstruction", () => {
	it("应该替换顶层的快捷指令节点", () => {
		const content = {
			type: ExtensionName,
			attrs: { old: "value" },
		} as JSONContent
		const newAttrs = { new: "value" }

		const result = transformQuickInstruction(content, (c) => {
			c.attrs = newAttrs
		}) as JSONContent
		expect(result?.attrs).toEqual({ new: "value" })
	})

	it("应该替换数组中的快捷指令节点", () => {
		const content = [
			{
				type: ExtensionName,
				attrs: { old: "value" },
			},
			{
				type: "paragraph",
				content: "text",
			},
		] as JSONContent
		const newAttrs = { new: "value" }

		const result = transformQuickInstruction(content, (c) => {
			c.attrs = newAttrs
		}) as JSONContent[]
		expect(result?.[0].attrs).toEqual({ new: "value" })
		expect(result?.[1]).toEqual({ type: "paragraph", content: "text" })
	})

	it("应该替换嵌套对象中的快捷指令节点", () => {
		const content = {
			type: "doc",
			content: [
				{
					type: ExtensionName,
					attrs: { old: "value" },
				},
			],
		} as JSONContent
		const newAttrs = { new: "value" }

		const result = transformQuickInstruction(content, (c) => {
			c.attrs = newAttrs
		}) as JSONContent
		expect(result?.content?.[0].attrs).toEqual({ new: "value" })
	})

	it("应该处理复杂的嵌套结构", () => {
		const content = {
			type: "doc",
			content: [
				{
					type: ExtensionName,
					attrs: { old: "value1" },
				},
				{
					type: "paragraph",
					content: [
						{
							type: ExtensionName,
							attrs: { old: "value2" },
						},
					],
				},
			],
		} as JSONContent
		const newAttrs = { new: "value" }

		const result = transformQuickInstruction(content, (c) => {
			c.attrs = newAttrs
		}) as JSONContent
		expect(result?.content?.[0].attrs).toEqual({ new: "value" })
		expect(result?.content?.[1].content?.[0].attrs).toEqual({ new: "value" })
	})
})

describe("replaceExistQuickInstruction", () => {
	it("应该替换顶层的匹配快捷指令并返回 true", () => {
		const content = {
			type: ExtensionName,
			attrs: {
				instructionName: "testInstruction",
				value: "oldValue",
			},
		} as JSONContent

		const result = replaceExistQuickInstruction(
			content,
			(attrs) => attrs?.instructionName === "testInstruction",
			"newValue",
		)

		expect(result).toBe(true)
		expect(content.attrs).toEqual({
			instructionName: "testInstruction",
			value: "newValue",
		})
	})

	it("应该在数组中替换匹配的快捷指令并返回 true", () => {
		const content = [
			{
				type: ExtensionName,
				attrs: {
					instructionName: "testInstruction",
					value: "oldValue",
				},
			},
			{
				type: "paragraph",
				content: [],
			},
		] as JSONContent

		const result = replaceExistQuickInstruction(
			content,
			(attrs) => attrs?.instructionName === "testInstruction",
			"newValue",
		)

		expect(result).toBe(true)
		expect(content[0].attrs).toEqual({
			instructionName: "testInstruction",
			value: "newValue",
		})
		expect(content[1]).toEqual({
			type: "paragraph",
			content: [],
		})
	})

	it("应该在嵌套结构中替换所有匹配的快捷指令并返回 true", () => {
		const content = {
			type: "doc",
			content: [
				{
					type: ExtensionName,
					attrs: {
						instructionName: "testInstruction",
						value: "oldValue1",
					},
				},
				{
					type: "paragraph",
					content: [
						{
							type: ExtensionName,
							attrs: {
								instructionName: "testInstruction",
								value: "oldValue2",
							},
						},
					],
				},
			],
		} as JSONContent

		const result = replaceExistQuickInstruction(
			content,
			(attrs) => attrs?.instructionName === "testInstruction",
			"newValue",
		)

		expect(result).toBe(true)
		expect(content.content?.[0].attrs).toEqual({
			instructionName: "testInstruction",
			value: "newValue",
		})
		expect(content.content?.[1].content?.[0].attrs).toEqual({
			instructionName: "testInstruction",
			value: "newValue",
		})
	})

	it("当没有匹配的指令时应该返回 false", () => {
		const content = {
			type: ExtensionName,
			attrs: {
				instructionName: "differentInstruction",
				value: "oldValue",
			},
		} as JSONContent

		const result = replaceExistQuickInstruction(
			content,
			(attrs) => attrs?.instructionName === "testInstruction",
			"newValue",
		)

		expect(result).toBe(false)
		expect(content.attrs?.value).toBe("oldValue")
	})

	it("应该只替换指定名称的快捷指令", () => {
		const content = [
			{
				type: ExtensionName,
				attrs: {
					instructionName: "instruction1",
					value: "value1",
				},
			},
			{
				type: ExtensionName,
				attrs: {
					instructionName: "instruction2",
					value: "value2",
				},
			},
		] as JSONContent

		const result = replaceExistQuickInstruction(
			content,
			(attrs) => attrs?.instructionName === "instruction1",
			"newValue",
		)

		expect(result).toBe(true)
		expect(content[0].attrs.value).toBe("newValue")
		expect(content[1].attrs.value).toBe("value2")
	})
})
