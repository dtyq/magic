import { describe, expect, it, vi } from "vitest"
import { MentionItemType, type MentionItem } from "../../../../types"
import type { MentionPanelPluginHost } from "../../registry-types"

const { pluginSearch } = vi.hoisted(() => ({
	pluginSearch: vi.fn(() => []),
}))

vi.mock("../../registry", () => ({
	mentionPanelSearchPlugins: [{ id: "capture-query", search: pluginSearch }],
}))

import { fuzzyMatch, matchesQuery, searchBuiltinMentionItems, sortSearchResults } from "../search"

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

	it("matches skill identifiers across display-name separators", () => {
		expect(matchesQuery("Skill Creator", "skill-cre")).toBe(true)
	})

	it("preserves separators in the query passed to search plugins", async () => {
		pluginSearch.mockClear()
		const pluginHost = {} as MentionPanelPluginHost

		await searchBuiltinMentionItems({
			query: "  Foo_Bar  ",
			pluginHost,
		})

		expect(pluginSearch).toHaveBeenCalledWith({
			store: pluginHost,
			query: "Foo_Bar",
			normalizedQuery: "foo_bar",
		})
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

	it("ranks a package-name match before description-only matches", () => {
		const results = sortSearchResults(
			[
				createMentionItem({
					id: "canvas",
					type: MentionItemType.SKILL,
					name: "Canvas Designer",
					description: "Core canvas design skill with a critical marker.",
				}),
				createMentionItem({
					id: "skill-creator",
					type: MentionItemType.SKILL,
					name: "Skill Creator",
					package_name: "skill-creator",
				}),
			],
			"skill-cre",
		)

		expect(results.map((item) => item.id)).toEqual(["skill-creator", "canvas"])
	})
})
