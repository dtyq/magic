import { describe, expect, it } from "vitest"
import { acceptMagicWidgetConfig } from "../config"
import type { MagicWidgetConfigWarning } from "../types"

/** Creates fictional provider rows without introducing environment-owned identifiers. */
function createCustomMentionItems(count: number, prefix: string, dataBytes = 0) {
	return Array.from({ length: count }, (_, index) => ({
		id: `${prefix}-${index}`,
		type: "fixture",
		text: `Fixture ${index}`,
		...(dataBytes > 0 ? { data: { value: "x".repeat(dataBytes) } } : {}),
	}))
}

describe("acceptMagicWidgetConfig", () => {
	it("keeps host field values that the iframe no longer revalidates", () => {
		const value = {
			header: { title: "   ", actions: { rename: true } },
			conversation: { projectFiles: "invalid" },
		}

		expect(acceptMagicWidgetConfig(value)).toEqual(value)
	})

	it("rejects values that cannot be stored as a config snapshot", () => {
		expect(() => acceptMagicWidgetConfig(undefined)).toThrow(/must be an object/)
		expect(() => acceptMagicWidgetConfig(null)).toThrow(/must be an object/)
		expect(() => acceptMagicWidgetConfig([])).toThrow(/must be an object/)
		expect(() => acceptMagicWidgetConfig("desktop")).toThrow(/must be an object/)
	})

	it("validates custom Mention groups before the iframe commits them", () => {
		const value = {
			panel: {
				customGroups: [
					{
						id: "provider-group",
						label: "Provider group",
						items: [{ id: "provider-item", type: "card", text: "Provider fixture" }],
					},
				],
			},
		}
		expect(acceptMagicWidgetConfig(value)).toEqual(value)
		expect(() =>
			acceptMagicWidgetConfig({
				panel: {
					customGroups: [
						{
							id: "duplicate-group",
							label: "Duplicate group",
							items: [
								{ id: "duplicate", type: "card", text: "one" },
								{ id: "duplicate", type: "card", text: "two" },
							],
						},
					],
				},
			}),
		).toThrow(/duplicate id/)
	})

	it("mirrors SDK count and byte filtering before replacing iframe state", () => {
		const perGroupWarnings: MagicWidgetConfigWarning[] = []
		const perGroupOverflow = acceptMagicWidgetConfig(
			{
				panel: {
					customGroups: [
						{
							id: "provider-oversized-group",
							label: "Provider oversized group",
							items: createCustomMentionItems(1_001, "provider-item"),
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

		const totalWarnings: MagicWidgetConfigWarning[] = []
		const totalOverflow = acceptMagicWidgetConfig(
			{
				panel: {
					customGroups: [
						...Array.from({ length: 5 }, (_, groupIndex) => ({
							id: `provider-group-${groupIndex}`,
							label: `Provider group ${groupIndex}`,
							items: createCustomMentionItems(1_000, `provider-${groupIndex}`),
						})),
						{
							id: "provider-extra-group",
							label: "Provider extra group",
							items: createCustomMentionItems(1, "provider-extra"),
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
		expect(totalWarnings[0]?.details.reasons).toEqual(["MAX_TOTAL_ITEMS"])

		const itemWarnings: MagicWidgetConfigWarning[] = []
		const itemOverflow = acceptMagicWidgetConfig(
			{
				panel: {
					customGroups: [
						{
							id: "provider-large-item-group",
							label: "Provider large item group",
							items: createCustomMentionItems(1, "provider-large", 32 * 1024),
						},
					],
				},
			},
			(warning) => itemWarnings.push(warning),
		)
		expect(itemOverflow.panel?.customGroups?.[0]?.items).toEqual([])
		expect(itemWarnings[0]?.details.reasons).toEqual(["MAX_ITEM_BYTES"])

		const payloadWarnings: MagicWidgetConfigWarning[] = []
		const payloadOverflow = acceptMagicWidgetConfig(
			{
				panel: {
					customGroups: [
						{
							id: "provider-payload-a",
							label: "Provider payload A",
							items: createCustomMentionItems(500, "provider-payload-a", 2_100),
						},
						{
							id: "provider-payload-b",
							label: "Provider payload B",
							items: createCustomMentionItems(500, "provider-payload-b", 2_100),
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
	})

	it("preserves safe HTTPS iconUrl for groups and items and rejects invalid ones", () => {
		const validConfig = {
			panel: {
				customGroups: [
					{
						id: "valid-group",
						label: "Valid Group",
						icon: "ts-doc-file",
						iconUrl: "https://example.com/icon.png",
						items: [
							{
								id: "item-1",
								type: "card",
								text: "Card 1",
								icon: "ts-api",
								iconUrl: "https://example.com/item.png",
							},
						],
					},
				],
			},
		}
		expect(acceptMagicWidgetConfig(validConfig)).toEqual(validConfig)

		// Reject HTTP URL
		expect(() =>
			acceptMagicWidgetConfig({
				panel: {
					customGroups: [
						{
							id: "http-group",
							label: "HTTP Group",
							iconUrl: "http://insecure.com/icon.png",
							items: [],
						},
					],
				},
			}),
		).toThrow(/https:/)

		// Reject javascript protocol
		expect(() =>
			acceptMagicWidgetConfig({
				panel: {
					customGroups: [
						{
							id: "js-group",
							label: "JS Group",
							items: [
								{
									id: "item-js",
									type: "card",
									text: "Card",
									iconUrl: "javascript:alert(1)",
								},
							],
						},
					],
				},
			}),
		).toThrow(/https:/)

		// Reject malformed URL with https prefix
		expect(() =>
			acceptMagicWidgetConfig({
				panel: {
					customGroups: [
						{
							id: "malformed-url-group",
							label: "Malformed URL Group",
							iconUrl: "https://[",
							items: [],
						},
					],
				},
			}),
		).toThrow(/valid HTTPS URL/)
	})

	it("validates and preserves custom Mention group placement in provider", () => {
		const configWithPlacement = {
			panel: {
				customGroups: [
					{
						id: "start-group",
						label: "Start Group",
						placement: "start" as const,
						items: [],
					},
					{
						id: "end-group",
						label: "End Group",
						placement: "end" as const,
						items: [],
					},
				],
			},
		}

		expect(acceptMagicWidgetConfig(configWithPlacement)).toEqual(configWithPlacement)

		// Rejects invalid placement
		expect(() =>
			acceptMagicWidgetConfig({
				panel: {
					customGroups: [
						{
							id: "invalid-placement-group",
							label: "Invalid Placement Group",
							// @ts-expect-error test invalid placement
							placement: "top",
							items: [],
						},
					],
				},
			}),
		).toThrow(/must be "start" or "end"/)
	})
})
