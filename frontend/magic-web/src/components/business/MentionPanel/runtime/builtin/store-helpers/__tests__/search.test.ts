import { describe, expect, it } from "vitest"
import { MentionItemType, type MentionItem } from "../../../../types"
import { fuzzyMatch, matchesQuery, sortSearchResults } from "../search"

function createMentionItem(overrides: Partial<MentionItem>): MentionItem {
	return {
		id: overrides.id ?? "item-id",
		type: overrides.type ?? MentionItemType.PROJECT_FILE,
		name: overrides.name ?? "file.txt",
		hasChildren: false,
		isFolder: false,
		...overrides,
	}
}

describe("search helpers", () => {
	it("supports fuzzy matching", () => {
		expect(fuzzyMatch("component.tsx", "cmpnt")).toBe(true)
		expect(fuzzyMatch("hello world", "oleh")).toBe(false)
	})

	it("prefers includes match before fuzzy match", () => {
		expect(matchesQuery("component.tsx", "comp")).toBe(true)
		expect(matchesQuery("component.tsx", "cmpnt")).toBe(true)
		expect(matchesQuery("component.tsx", "xyz")).toBe(false)
	})

	it("sorts files before tools and prefers html files", () => {
		const results = sortSearchResults(
			[
				createMentionItem({
					id: "tool",
					type: MentionItemType.TOOL,
					name: "component tool",
				}),
				createMentionItem({
					id: "tsx",
					type: MentionItemType.PROJECT_FILE,
					name: "component.tsx",
					extension: "tsx",
				}),
				createMentionItem({
					id: "html",
					type: MentionItemType.PROJECT_FILE,
					name: "component.html",
					extension: "html",
				}),
			],
			"component",
		)

		expect(results.map((item) => item.id)).toEqual(["html", "tsx", "tool"])
	})
})
