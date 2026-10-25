import { describe, expect, it } from "vitest"
import { mergeWidgetConfig, normalizeWidgetConfig, resolveInitialWidgetConfig } from "../src/config"
import type { MagicWidget } from "../src/types"

/** Creates bounded fictional rows for count and payload boundary tests. */
function createCustomMentionItems(count: number, prefix: string, dataBytes = 0) {
	return Array.from({ length: count }, (_, index) => ({
		id: `${prefix}-${index}`,
		type: "fixture",
		text: `Fixture ${index}`,
		...(dataBytes > 0 ? { data: { value: "x".repeat(dataBytes) } } : {}),
	}))
}

describe("Widget config", () => {
	it("uses the legacy mobile layout and viewport semantics as initial defaults", () => {
		expect(resolveInitialWidgetConfig(undefined)).toEqual({
			layout: "mobile",
			responsive: { mobileDetection: "viewport" },
		})
	})

	it("keeps explicit initial layout and responsive overrides", () => {
		expect(
			resolveInitialWidgetConfig({
				layout: "desktop",
				responsive: { mobileDetection: "device-and-viewport" },
			}),
		).toEqual({
			layout: "desktop",
			responsive: { mobileDetection: "device-and-viewport" },
		})
	})

	it("normalizes the supported layout and visibility fields", () => {
		expect(
			normalizeWidgetConfig({
				layout: "desktop",
				shell: { appSidebar: false },
				responsive: { mobileDetection: "device-and-viewport" },
				conversation: {
					projectFiles: false,
					topicHistory: true,
					autoHire: false,
					previewMode: "fullscreen",
				},
			}),
		).toEqual({
			layout: "desktop",
			shell: { appSidebar: false },
			responsive: { mobileDetection: "device-and-viewport" },
			conversation: {
				projectFiles: false,
				topicHistory: true,
				autoHire: false,
				previewMode: "fullscreen",
			},
		})
	})

	it("merges nested updates without dropping previously confirmed fields", () => {
		expect(
			mergeWidgetConfig(
				{
					layout: "desktop",
					shell: { appSidebar: false },
					responsive: { mobileDetection: "viewport" },
					conversation: { projectFiles: false },
				},
				{
					conversation: {
						topicHistory: true,
						autoHire: false,
						previewMode: "switchable",
					},
					responsive: { mobileDetection: "device-and-viewport" },
				},
			),
		).toEqual({
			layout: "desktop",
			shell: { appSidebar: false },
			responsive: { mobileDetection: "device-and-viewport" },
			conversation: {
				projectFiles: false,
				topicHistory: true,
				autoHire: false,
				previewMode: "switchable",
			},
		})
	})

	it("rejects invalid and undeclared configuration fields", () => {
		expect(() => normalizeWidgetConfig({ layout: "tablet" })).toThrow(/config\.layout/)
		expect(() => normalizeWidgetConfig({ shell: { globalNotice: false } })).toThrow(
			/globalNotice/,
		)
		expect(() => normalizeWidgetConfig({ conversation: { projectFiles: "no" } })).toThrow(
			/projectFiles/,
		)
		expect(() => normalizeWidgetConfig({ conversation: { autoHire: "yes" } })).toThrow(
			/autoHire/,
		)
		expect(() => normalizeWidgetConfig({ conversation: { previewMode: "overlay" } })).toThrow(
			/previewMode/,
		)
		expect(() => normalizeWidgetConfig({ conversation: { previewMode: true } })).toThrow(
			/previewMode/,
		)
		expect(() =>
			normalizeWidgetConfig({ responsive: { mobileDetection: "device-only" } }),
		).toThrow(/mobileDetection/)
		expect(() => normalizeWidgetConfig({ responsive: { mobileDetection: true } })).toThrow(
			/mobileDetection/,
		)
		expect(() => normalizeWidgetConfig({ responsive: { breakpoint: 640 } })).toThrow(
			/breakpoint/,
		)
		expect(() => normalizeWidgetConfig({ header: { topicName: { mode: "static" } } })).toThrow(
			/topicName.text/,
		)
		expect(() => normalizeWidgetConfig({ header: { title: "   " } })).toThrow(/header\.title/)
		expect(() => normalizeWidgetConfig({ header: { title: { mode: "static" } } })).toThrow(
			/title\.text/,
		)
		expect(() =>
			normalizeWidgetConfig({ header: { title: { mode: "hidden", text: "Mock Title" } } }),
		).toThrow(/title\.text/)
		expect(() => normalizeWidgetConfig({ header: { title: { mode: "current" } } })).toThrow(
			/title\.mode/,
		)
		expect(() => normalizeWidgetConfig({ panel: { agents: false } })).toThrow(/panel\.agents/)
		expect(() =>
			normalizeWidgetConfig({ header: { topicName: { mode: "static", text: "   " } } }),
		).toThrow(/topicName\.text/)
		expect(() => normalizeWidgetConfig({ bottom: { upload: { enabled: "yes" } } })).toThrow(
			/upload.enabled/,
		)
		expect(() => normalizeWidgetConfig({ bottom: { model: { enabled: false } } })).toThrow(
			/bottom\.model\.enabled/,
		)
	})

	it("normalizes Widget customization and merges nested updates", () => {
		const initial = normalizeWidgetConfig({
			header: {
				visible: true,
				title: "Mock Assistant",
				topicName: { mode: "current" },
				actions: { fullscreen: true, share: false, close: false },
			},
			panel: {
				projectFiles: false,
				uploadFiles: false,
				otherProjectFiles: false,
				digitalEmployees: false,
				microApps: false,
				workflows: false,
				connectors: false,
				skills: false,
				canvasElements: false,
			},
			bottom: {
				internetSearch: { enabled: true, buttonVisible: false },
				upload: { enabled: false, buttonVisible: false },
				model: { buttonVisible: false },
			},
			window: { closable: false },
		})

		expect(initial.header?.title).toBe("Mock Assistant")
		expect(
			normalizeWidgetConfig({ header: { title: "  Mock Assistant  " } }).header?.title,
		).toBe("Mock Assistant")
		expect(
			normalizeWidgetConfig({
				header: { title: { mode: "static", text: "  Mock Assistant  " } },
			}).header?.title,
		).toEqual({ mode: "static", text: "Mock Assistant" })
		expect(normalizeWidgetConfig({ header: { title: { mode: "hidden" } } }).header?.title).toEqual(
			{ mode: "hidden" },
		)
		expect(initial.header?.actions).toEqual({ fullscreen: true, share: false, close: false })
		expect(initial.panel).toEqual({
			projectFiles: false,
			uploadFiles: false,
			otherProjectFiles: false,
			digitalEmployees: false,
			microApps: false,
			workflows: false,
			connectors: false,
			skills: false,
			canvasElements: false,
		})
		expect(initial.bottom?.internetSearch).toEqual({ enabled: true, buttonVisible: false })
		expect(initial.bottom?.model).toEqual({ buttonVisible: false })
		expect(initial.window).toEqual({ closable: false })

		expect(
			mergeWidgetConfig(initial, {
				panel: { workflows: false },
				header: { actions: { more: false }, title: { mode: "hidden" } },
				bottom: { upload: { buttonVisible: true } },
			}),
		).toEqual({
			header: {
				visible: true,
				title: { mode: "hidden" },
				topicName: { mode: "current" },
				actions: { fullscreen: true, share: false, close: false, more: false },
			},
			panel: {
				projectFiles: false,
				uploadFiles: false,
				otherProjectFiles: false,
				digitalEmployees: false,
				microApps: false,
				workflows: false,
				connectors: false,
				skills: false,
				canvasElements: false,
			},
			bottom: {
				internetSearch: { enabled: true, buttonVisible: false },
				upload: { enabled: false, buttonVisible: true },
				model: { buttonVisible: false },
			},
			window: { closable: false },
		})
	})

	it("validates and clones named custom Mention groups", () => {
		const source = {
			panel: {
				customGroups: [
					{
						id: "group-fictional",
						label: "Sample group",
						items: [
							{
								id: "item-fictional",
								type: "card",
								text: "Sample content",
								data: { nested: { value: "fixture" } },
							},
						],
					},
				],
			},
		}
		const normalized = normalizeWidgetConfig(source)
		expect(normalized.panel?.customGroups).toEqual(source.panel.customGroups)
		expect(normalized.panel?.customGroups).not.toBe(source.panel.customGroups)
		expect(normalized.panel?.customGroups?.[0]?.items[0]?.data).not.toBe(
			source.panel.customGroups[0].items[0].data,
		)
	})

	it("rejects unsafe and duplicate custom groups atomically", () => {
		expect(() =>
			normalizeWidgetConfig({
				panel: {
					customGroups: [
						{
							id: "same-group",
							label: "Same",
							items: [
								{ id: "same", type: "card", text: "one" },
								{ id: "same", type: "card", text: "two" },
							],
						},
					],
				},
			}),
		).toThrow(/duplicate id/)

		const cyclic: Record<string, unknown> = {}
		cyclic.self = cyclic
		expect(() =>
			normalizeWidgetConfig({
				panel: {
					customGroups: [
						{
							id: "cycle-group",
							label: "Cycle",
							items: [{ id: "cycle", type: "card", text: "unsafe", data: cyclic }],
						},
					],
				},
			}),
		).toThrow(/circular/)
	})

	it("requires unique root group IDs while allowing IDs to repeat across groups", () => {
		const normalized = normalizeWidgetConfig({
			panel: {
				customGroups: [
					{
						id: "charts",
						label: "Charts",
						items: [{ id: "same-item", type: "chart", text: "A" }],
					},
					{
						id: "links",
						label: "Links",
						items: [{ id: "same-item", type: "link", text: "B" }],
					},
				],
			},
		})
		expect(normalized.panel?.customGroups?.[1]?.items[0]?.id).toBe("same-item")
		expect(() =>
			normalizeWidgetConfig({
				panel: {
					customGroups: [
						{ id: "charts", label: "One", items: [] },
						{ id: "charts", label: "Two", items: [] },
					],
				},
			}),
		).toThrow(/duplicate group id/)
		expect(() =>
			normalizeWidgetConfig({
				panel: { customGroups: [{ id: "project-files", label: "Collision", items: [] }] },
			}),
		).toThrow(/conflicts with a built-in/)
	})

	it("filters group, per-group item, and total item overflow with one warning", () => {
		const maximumSnapshot = normalizeWidgetConfig({
			panel: {
				customGroups: Array.from({ length: 5 }, (_, groupIndex) => ({
					id: `group-${groupIndex}`,
					label: `Group ${groupIndex}`,
					items: createCustomMentionItems(1_000, `group-${groupIndex}-item`),
				})),
			},
		})
		expect(maximumSnapshot.panel?.customGroups).toHaveLength(5)
		expect(maximumSnapshot.panel?.customGroups?.[0]?.items).toHaveLength(1_000)

		const groupWarnings: MagicWidget.ConfigWarning[] = []
		const groupOverflow = normalizeWidgetConfig(
			{
				panel: {
					customGroups: Array.from({ length: 51 }, (_, index) => ({
						id: `group-${index}`,
						label: `Group ${index}`,
						items: [],
					})),
				},
			},
			(warning) => groupWarnings.push(warning),
		)
		expect(groupOverflow.panel?.customGroups).toHaveLength(50)
		expect(groupWarnings).toEqual([
			expect.objectContaining({
				code: "CUSTOM_MENTION_FILTERED",
				details: expect.objectContaining({ droppedGroups: 1, reasons: ["MAX_GROUPS"] }),
			}),
		])

		const perGroupWarnings: MagicWidget.ConfigWarning[] = []
		const perGroupOverflow = normalizeWidgetConfig(
			{
				panel: {
					customGroups: [
						{
							id: "oversized-group",
							label: "Oversized group",
							items: createCustomMentionItems(1_001, "oversized-item"),
						},
					],
				},
			},
			(warning) => perGroupWarnings.push(warning),
		)
		expect(perGroupOverflow.panel?.customGroups?.[0]?.items).toHaveLength(1_000)
		expect(perGroupWarnings[0]?.details).toMatchObject({
			droppedItems: 1,
			reasons: ["MAX_ITEMS_PER_GROUP"],
		})

		const totalWarnings: MagicWidget.ConfigWarning[] = []
		const totalOverflow = normalizeWidgetConfig(
			{
				panel: {
					customGroups: [
						...Array.from({ length: 5 }, (_, groupIndex) => ({
							id: `full-group-${groupIndex}`,
							label: `Full group ${groupIndex}`,
							items: createCustomMentionItems(1_000, `full-${groupIndex}`),
						})),
						{
							id: "one-too-many",
							label: "One too many",
							items: createCustomMentionItems(1, "extra"),
						},
					],
				},
			},
			(warning) => totalWarnings.push(warning),
		)
		expect(
			totalOverflow.panel?.customGroups?.reduce(
				(count, group) => count + group.items.length,
				0,
			),
		).toBe(5_000)
		expect(totalWarnings[0]?.details).toMatchObject({
			droppedItems: 1,
			reasons: ["MAX_TOTAL_ITEMS"],
		})
	})

	it("filters item and complete snapshot UTF-8 byte overflow", () => {
		const itemWarnings: MagicWidget.ConfigWarning[] = []
		const itemOverflow = normalizeWidgetConfig(
			{
				panel: {
					customGroups: [
						{
							id: "large-item-group",
							label: "Large item group",
							items: createCustomMentionItems(1, "large-item", 32 * 1024),
						},
					],
				},
			},
			(warning) => itemWarnings.push(warning),
		)
		expect(itemOverflow.panel?.customGroups?.[0]?.items).toEqual([])
		expect(itemWarnings[0]?.details).toMatchObject({
			droppedItems: 1,
			reasons: ["MAX_ITEM_BYTES"],
		})

		const payloadWarnings: MagicWidget.ConfigWarning[] = []
		const payloadOverflow = normalizeWidgetConfig(
			{
				panel: {
					customGroups: [
						{
							id: "payload-a",
							label: "Payload A",
							items: createCustomMentionItems(500, "payload-a-item", 2_100),
						},
						{
							id: "payload-b",
							label: "Payload B",
							items: createCustomMentionItems(500, "payload-b-item", 2_100),
						},
					],
				},
			},
			(warning) => payloadWarnings.push(warning),
		)
		expect(
			new TextEncoder().encode(JSON.stringify(payloadOverflow.panel?.customGroups))
				.byteLength,
		).toBeLessThanOrEqual(2 * 1024 * 1024)
		expect(payloadWarnings[0]?.details.reasons).toContain("MAX_PAYLOAD_BYTES")
		expect(payloadWarnings[0]?.details.droppedItems).toBeGreaterThan(0)
	})

	it("validates and preserves safe HTTPS iconUrl for groups and items", () => {
		const source = {
			panel: {
				customGroups: [
					{
						id: "docs-group",
						label: "Documentation",
						icon: "ts-doc-file",
						iconUrl: "https://example.com/icons/group.png",
						items: [
							{
								id: "item-1",
								type: "doc",
								text: "API Reference",
								icon: "ts-api",
								iconUrl: "https://example.com/icons/item-1.png",
							},
						],
					},
				],
			},
		}
		const normalized = normalizeWidgetConfig(source)
		const group = normalized.panel?.customGroups?.[0]
		expect(group?.icon).toBe("ts-doc-file")
		expect(group?.iconUrl).toBe("https://example.com/icons/group.png")
		expect(group?.items[0]?.icon).toBe("ts-api")
		expect(group?.items[0]?.iconUrl).toBe("https://example.com/icons/item-1.png")
	})

	it("rejects non-HTTPS or malformed iconUrl on groups and items", () => {
		// Reject HTTP protocol
		expect(() =>
			normalizeWidgetConfig({
				panel: {
					customGroups: [
						{
							id: "group-http",
							label: "HTTP Group",
							iconUrl: "http://insecure.com/icon.png",
							items: [],
						},
					],
				},
			}),
		).toThrow(/https:/)

		expect(() =>
			normalizeWidgetConfig({
				panel: {
					customGroups: [
						{
							id: "group-valid",
							label: "Group",
							items: [
								{
									id: "item-http",
									type: "card",
									text: "Card",
									iconUrl: "http://insecure.com/icon.png",
								},
							],
						},
					],
				},
			}),
		).toThrow(/https:/)

		// Reject javascript / data / blob protocols
		expect(() =>
			normalizeWidgetConfig({
				panel: {
					customGroups: [
						{
							id: "group-js",
							label: "JS Group",
							iconUrl: "javascript:alert(1)",
							items: [],
						},
					],
				},
			}),
		).toThrow(/https:/)

		expect(() =>
			normalizeWidgetConfig({
				panel: {
					customGroups: [
						{
							id: "group-data",
							label: "Data Group",
							iconUrl: "data:image/png;base64,abc",
							items: [],
						},
					],
				},
			}),
		).toThrow(/https:/)

		// Reject malformed URL
		expect(() =>
			normalizeWidgetConfig({
				panel: {
					customGroups: [
						{
							id: "group-bad",
							label: "Bad Group",
							iconUrl: "not-a-url",
							items: [],
						},
					],
				},
			}),
		).toThrow(/valid HTTPS URL/)

		// Reject oversized URL (> 2048 chars)
		const oversizedUrl = `https://example.com/${"a".repeat(2040)}`
		expect(() =>
			normalizeWidgetConfig({
				panel: {
					customGroups: [
						{
							id: "group-oversized",
							label: "Oversized Group",
							iconUrl: oversizedUrl,
							items: [],
						},
					],
				},
			}),
		).toThrow(/at most 2048 characters/)

		// Reject malformed URL containing https: prefix
		expect(() =>
			normalizeWidgetConfig({
				panel: {
					customGroups: [
						{
							id: "group-bracket",
							label: "Bracket Group",
							iconUrl: "https://[",
							items: [],
						},
					],
				},
			}),
		).toThrow(/valid HTTPS URL/)
	})

	it("validates and preserves custom Mention group placement", () => {
		// Accepts "start" and "end"
		const normalized = normalizeWidgetConfig({
			panel: {
				customGroups: [
					{
						id: "group-start",
						label: "Start Group",
						placement: "start",
						items: [],
					},
					{
						id: "group-end",
						label: "End Group",
						placement: "end",
						items: [],
					},
					{
						id: "group-default",
						label: "Default Group",
						items: [],
					},
				],
			},
		})

		const groups = normalized.panel?.customGroups
		expect(groups?.[0]?.placement).toBe("start")
		expect(groups?.[1]?.placement).toBe("end")
		expect(groups?.[2]?.placement).toBeUndefined()

		// Rejects invalid placement
		expect(() =>
			normalizeWidgetConfig({
				panel: {
					customGroups: [
						{
							id: "group-invalid",
							label: "Invalid Placement",
							// @ts-expect-error test runtime validation of invalid value
							placement: "top",
							items: [],
						},
					],
				},
			}),
		).toThrow(/must be "start" or "end"/)
	})
})
