import { describe, expect, it } from "vitest"
import { UpdateTextContentCommand } from "../commands"

describe("UpdateTextContentCommand", () => {
	it("keeps image nodes when updating mixed container text", () => {
		const element = document.createElement("div")
		const image = document.createElement("img")
		image.src = "icon.png"
		element.append(image, "Original title")
		document.body.append(element)

		const command = new UpdateTextContentCommand("cmd-1", element, "Updated title")
		command.execute()

		expect(element.querySelector("img")).toBe(image)
		expect(element.textContent).toBe("Updated title")

		command.undo()
		expect(element.querySelector("img")).toBe(image)
		expect(element.textContent).toBe("Original title")

		element.remove()
	})
})
