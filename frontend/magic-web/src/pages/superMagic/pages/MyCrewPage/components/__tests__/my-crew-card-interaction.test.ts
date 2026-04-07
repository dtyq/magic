import { isInsideMyCrewCardInteractiveTarget } from "../my-crew-card-interaction"

describe("isInsideMyCrewCardInteractiveTarget", () => {
	it("treats svg icons inside menu items as interactive targets", () => {
		const menuItem = document.createElement("div")
		menuItem.setAttribute("role", "menuitem")

		const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg")
		menuItem.appendChild(icon)

		expect(isInsideMyCrewCardInteractiveTarget(icon)).toBe(true)
	})

	it("returns false for non-interactive content", () => {
		const content = document.createElement("div")

		expect(isInsideMyCrewCardInteractiveTarget(content)).toBe(false)
	})
})
