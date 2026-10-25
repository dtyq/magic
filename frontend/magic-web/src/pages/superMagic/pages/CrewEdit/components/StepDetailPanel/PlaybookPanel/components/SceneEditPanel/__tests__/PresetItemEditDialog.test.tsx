import { describe, expect, it } from "vitest"
import { reorderOptionItems } from "../components/PresetItemEditDialog"

describe("PresetItemEditDialog option ordering", () => {
	it("moves the dragged option to the position of the target option", () => {
		const options = [
			{ _key: "first", value: "First" },
			{ _key: "second", value: "Second" },
			{ _key: "third", value: "Third" },
		]

		expect(reorderOptionItems(options, "first", "third")).toEqual([
			options[1],
			options[2],
			options[0],
		])
	})
})
