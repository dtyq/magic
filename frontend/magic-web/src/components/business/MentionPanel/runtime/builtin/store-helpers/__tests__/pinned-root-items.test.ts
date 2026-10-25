import { describe, expect, it, vi } from "vitest"
import { MentionItemType, type MentionItem } from "../../../../types"
import { prependPinnedRootItems } from "../pinned-root-items"

vi.mock("../../../../tiptap-plugin/types", () => ({
	getMentionUniqueId: vi.fn((attrs: { type: string; data?: { app_id?: string } }) =>
		attrs.type === "micro_app" ? `micro-app:${attrs.data?.app_id ?? ""}` : attrs.type,
	),
}))

function createItem(overrides: Partial<MentionItem>): MentionItem {
	return {
		id: overrides.id ?? "item",
		type: overrides.type ?? MentionItemType.FOLDER,
		name: overrides.name ?? "item",
		hasChildren: false,
		isFolder: false,
		...overrides,
	}
}

describe("prependPinnedRootItems", () => {
	it("returns the original list when nothing is pinned", () => {
		const items = [createItem({ id: "project-files" })]
		expect(prependPinnedRootItems(items, [])).toBe(items)
	})

	it("puts pinned apps first and drops matching later items", () => {
		const pinned = [
			createItem({
				id: "app-1",
				type: MentionItemType.MICRO_APP,
				name: "Todo App",
				data: { app_id: "app-1", app_name: "Todo App" } as never,
			}),
		]
		const items = [
			createItem({ id: "smart-recommendations", type: MentionItemType.TITLE }),
			createItem({
				id: "history-app",
				type: MentionItemType.MICRO_APP,
				name: "Todo App",
				data: { app_id: "app-1", app_name: "Todo App" } as never,
			}),
			createItem({ id: "project-files" }),
		]

		expect(prependPinnedRootItems(items, pinned).map((item) => item.id)).toEqual([
			"app-1",
			"smart-recommendations",
			"project-files",
		])
	})
})
