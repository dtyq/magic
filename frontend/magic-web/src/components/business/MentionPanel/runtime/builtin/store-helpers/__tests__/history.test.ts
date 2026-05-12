import { describe, expect, it, vi } from "vitest"
import { MentionItemType, type MentionItem } from "../../../../types"
import { convertMentionListItemToMentionItem, mergeSmartRecommendations } from "../history"

vi.mock("../../../../tiptap-plugin/types", () => ({
	getMentionUniqueId: vi.fn(
		(attrs: { type: string; data?: { id?: string } }) =>
			`${attrs.type}:${attrs.data?.id ?? "missing"}`,
	),
	getMentionDisplayName: vi.fn(() => "mock-name"),
	getMentionIcon: vi.fn(() => "mock-icon"),
	getMentionDescription: vi.fn(() => "mock-description"),
}))

function createMentionItem(overrides: Partial<MentionItem>): MentionItem {
	return {
		id: overrides.id ?? "item-id",
		type: overrides.type ?? MentionItemType.PROJECT_FILE,
		name: overrides.name ?? "item-name",
		hasChildren: false,
		isFolder: false,
		...overrides,
	}
}

describe("history helpers", () => {
	it("deduplicates smart recommendations by mention unique id", () => {
		const tabsItems = [
			createMentionItem({
				id: "tab-1",
				type: MentionItemType.PROJECT_FILE,
				data: { id: "same-id" } as never,
			}),
		]
		const historyItems = [
			createMentionItem({
				id: "history-1",
				type: MentionItemType.PROJECT_FILE,
				data: { id: "same-id" } as never,
			}),
			createMentionItem({
				id: "history-2",
				type: MentionItemType.PROJECT_FILE,
				data: { id: "other-id" } as never,
			}),
		]

		const results = mergeSmartRecommendations(tabsItems, historyItems)

		expect(results.map((item) => item.id)).toEqual(["tab-1", "history-2"])
	})

	it("converts mention list items to mention items", () => {
		const result = convertMentionListItemToMentionItem({
			attrs: {
				type: MentionItemType.PROJECT_FILE,
				data: { id: "file-1" },
			},
		} as never)

		expect(result).toEqual({
			id: `${MentionItemType.PROJECT_FILE}:file-1`,
			name: "mock-name",
			icon: "mock-icon",
			description: "mock-description",
			type: MentionItemType.PROJECT_FILE,
			data: { id: "file-1" },
			hasChildren: false,
			isFolder: false,
		})
	})
})
