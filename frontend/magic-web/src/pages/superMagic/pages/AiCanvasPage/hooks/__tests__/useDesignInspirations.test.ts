import { describe, expect, it, vi } from "vitest"
import type { PlaybookItem } from "@/apis/modules/crew"
import { collectInspirationGroups } from "../useDesignInspirations"

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({ default: {} }))
vi.mock("@/pages/superMagic/components/MainInputContainer/stores/SceneConfigStore", () => ({
	sceneConfigStore: {},
}))

function playbook(scenesConfig: unknown): PlaybookItem {
	return { config: { scenes_config: scenesConfig } } as unknown as PlaybookItem
}

describe("collectInspirationGroups", () => {
	it("returns nothing for a missing or empty playbook config", () => {
		expect(collectInspirationGroups("p1", undefined)).toEqual([])
		expect(collectInspirationGroups("p1", { config: null } as unknown as PlaybookItem)).toEqual(
			[],
		)
	})

	it("keeps only demo panels with usable items and namespaces group keys", () => {
		const groups = collectInspirationGroups(
			"p1",
			playbook({
				quick_start: { type: "guide" },
				inspiration: {
					type: "demo",
					demo: {
						groups: [
							{
								group_key: "poster",
								group_name: "Poster",
								children: [
									{ value: "Cat poster", prompt: "Draw a cat poster" },
									{ value: "" },
								],
							},
							{ group_key: "empty", group_name: "Empty", children: [] },
						],
					},
				},
			}),
		)

		expect(groups).toEqual([
			{
				key: "p1:poster",
				name: "Poster",
				items: [{ value: "Cat poster", prompt: "Draw a cat poster" }],
			},
		])
	})
})
