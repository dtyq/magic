import { beforeEach, describe, expect, it } from "vitest"
import { Schema, type SchemaSpec } from "prosemirror-model"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { buildAgentPromptContent } from "@/components/business/ElementInspector/ElementInspectorOverlay"
import { INSPECTOR_DETAIL_MARKER, INSPECTOR_DETAIL_TYPE } from "../const"
import { serializeInspectorContent, transformInspectorContent } from "../transform"
import {
	resetHtmlScreenshotTargetStore,
	setHtmlScreenshotMention,
} from "../../../services/HtmlScreenshotTargetStore"
import type { InspectedElementInfo } from "@/components/business/ElementInspector/types"
import schemaConfig from "@/pages/superMagic/components/MessageList/components/Text/components/RichText/schemaConfig"

const fileMention = {
	type: MentionItemType.PROJECT_FILE,
	data: {
		file_id: "file-1",
		file_name: "index.html",
		file_path: "/index.html",
		file_extension: "html",
	},
}

const screenshotMention = {
	type: MentionItemType.PROJECT_FILE,
	data: {
		file_id: "screenshot-1",
		file_name: "hero.png",
		file_path: "/hero.png",
		file_extension: "png",
	},
}

const labels = {
	title: "Selected element",
	selector: "Selector",
	size: "Size",
	computedStyles: "Computed Styles",
	textContent: "Text Content",
	elementAttributes: "Element Attributes",
	resource: "Resource",
	domContext: "DOM Context",
	elementHtml: "Element HTML",
	selectorMatchCount: "Selector Match Count",
}

function createInspectedElement(): InspectedElementInfo {
	return {
		selector: "body > button.primary",
		tagName: "button",
		id: "",
		classList: ["primary"],
		textContent: "Submit",
		rect: {
			x: 0,
			y: 0,
			top: 0,
			left: 0,
			right: 120,
			bottom: 40,
			width: 120,
			height: 40,
		},
		computedStyles: {
			display: "flex",
			width: "120px",
			height: "40px",
		},
		attributes: { src: "images/submit.png", alt: "Submit" },
		resource: "images/submit.png",
		domContext: {
			parentSelector: "body > main",
			siblingIndex: 2,
			sameTagSiblingCount: 3,
			sameTagIndex: 2,
			previousSibling: "button.primary text=Cancel",
			nextSibling: "button.primary text=Next",
		},
		elementHtml: '<button src="images/submit.png" alt="Submit">Submit</button>',
		selectorMatchCount: 1,
	}
}

describe("inspector-detail transform", () => {
	beforeEach(() => {
		resetHtmlScreenshotTargetStore()
	})

	it("stores the inspected file mention on the inspector node instead of a standalone paragraph", () => {
		const content = buildAgentPromptContent(createInspectedElement(), labels.title, {
			fileId: "file-1",
			fileName: "index.html",
			filePath: "/index.html",
		})

		const paragraph = content.content?.[0]
		const inspectorNode = paragraph?.content?.[0]

		expect(content.content).toHaveLength(1)
		expect(paragraph?.type).toBe("paragraph")
		expect(inspectorNode?.type).toBe(INSPECTOR_DETAIL_TYPE)
		expect(inspectorNode?.attrs?.fileMention).toEqual(fileMention)
	})

	it("preserves resource and DOM context for AI source matching", () => {
		const content = buildAgentPromptContent(createInspectedElement(), labels.title)
		const attrs = content.content?.[0]?.content?.[0]?.attrs

		expect(attrs?.resource).toBe("images/submit.png")
		expect(JSON.parse(attrs?.elementAttributes)).toEqual({
			src: "images/submit.png",
			alt: "Submit",
		})
		expect(JSON.parse(attrs?.domContext).sameTagIndex).toBe(2)
		expect(attrs?.selectorMatchCount).toBe(1)

		const serialized = serializeInspectorContent(content, labels)
		const lines = serialized.content?.map((node) => node.content?.[0]?.text).filter(Boolean)
		expect(lines).toContain("Resource: images/submit.png")
		expect(lines?.some((line) => line?.startsWith("DOM Context: "))).toBe(true)
		expect(lines?.some((line) => line?.startsWith("Element HTML: "))).toBe(true)
		expect(lines?.indexOf("Resource: images/submit.png")).toBeLessThan(
			lines?.findIndex((line) => line?.startsWith("Computed Styles: ")) ?? -1,
		)
	})

	it("serializes a paragraph-wrapped inspector file mention back to normal detail paragraphs", () => {
		const serialized = serializeInspectorContent(
			{
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [
							{
								type: INSPECTOR_DETAIL_TYPE,
								attrs: {
									title: labels.title,
									selector: "body > button.primary",
									tagName: "button",
									size: "120 x 40 px",
									computedStyles: "{}",
									styleCount: 0,
									textContent: "Submit",
									fileMention,
								},
							},
						],
					},
				],
			},
			labels,
		)

		expect(serialized.content?.[0]).toEqual({
			type: "paragraph",
			content: [{ type: "mention", attrs: fileMention }],
		})
		expect(serialized.content?.[1]?.content?.[0]?.text).toBe(
			`${INSPECTOR_DETAIL_MARKER}${labels.title}`,
		)
	})

	it("transforms serialized inspector paragraphs into schema-valid paragraph-wrapped nodes", () => {
		const transformed = transformInspectorContent({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "mention", attrs: fileMention }],
				},
				{
					type: "paragraph",
					content: [{ type: "text", text: `${INSPECTOR_DETAIL_MARKER}${labels.title}` }],
				},
				{
					type: "paragraph",
					content: [{ type: "text", text: `${labels.selector}: body > button.primary` }],
				},
			],
		})

		const inspectorParagraph = transformed.content?.[0]
		const inspectorNode = inspectorParagraph?.content?.[0]

		expect(inspectorParagraph?.type).toBe("paragraph")
		expect(inspectorNode?.type).toBe(INSPECTOR_DETAIL_TYPE)
		expect(inspectorNode?.attrs?.fileMention).toEqual(fileMention)

		const schema = new Schema(schemaConfig as SchemaSpec)
		expect(() => schema.nodeFromJSON(transformed)).not.toThrow()
	})

	it("keeps element screenshots local and does not serialize them", () => {
		setHtmlScreenshotMention("element:#hero:1", screenshotMention)
		const serialized = serializeInspectorContent(
			{
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [
							{
								type: INSPECTOR_DETAIL_TYPE,
								attrs: {
									title: labels.title,
									selector: "#hero",
									tagName: "section",
									size: "300 × 120 px",
									computedStyles: "{}",
									styleCount: 0,
									textContent: "Hero",
									screenshotMention,
									captureId: "element:#hero:1",
								},
							},
						],
					},
				],
			},
			labels,
		)

		expect(JSON.stringify(serialized)).not.toContain("hero.png")
		expect(
			serialized.content?.some((node) => node.content?.[0]?.text === 'Text Content: "Hero"'),
		).toBe(true)
		expect(JSON.stringify(serialized)).not.toContain(INSPECTOR_DETAIL_MARKER.repeat(9))
	})

	it("round-trips captureId so the message list can load the local screenshot", () => {
		const serialized = serializeInspectorContent(
			{
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [
							{
								type: INSPECTOR_DETAIL_TYPE,
								attrs: {
									title: labels.title,
									selector: "#hero",
									tagName: "section",
									size: "300 × 120 px",
									computedStyles: "{}",
									styleCount: 0,
									textContent: "Hero",
									captureId: "element:#hero:1",
								},
							},
						],
					},
				],
			},
			labels,
		)

		expect(JSON.stringify(serialized)).not.toContain("hero.png")

		const transformed = transformInspectorContent(serialized)
		const inspectorNode = transformed.content?.[0]?.content?.[0]

		expect(inspectorNode?.type).toBe(INSPECTOR_DETAIL_TYPE)
		expect(inspectorNode?.attrs?.captureId).toBe("element:#hero:1")
		expect(inspectorNode?.attrs?.screenshotMention).toBeFalsy()

		const schema = new Schema(schemaConfig as SchemaSpec)
		const doc = schema.nodeFromJSON(transformed)
		let preservedCaptureId: string | null = null
		doc.descendants((node) => {
			if (node.type.name === INSPECTOR_DETAIL_TYPE) {
				preservedCaptureId = node.attrs.captureId
			}
			return true
		})
		expect(preservedCaptureId).toBe("element:#hero:1")
	})
})
