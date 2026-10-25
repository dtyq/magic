import { describe, expect, it } from "vitest"
import { isEditorInteractiveKeyboardTarget } from "../keyboard"

describe("isEditorInteractiveKeyboardTarget", () => {
	it("recognizes native and role-based interactive controls", () => {
		const button = document.createElement("button")
		const buttonLabel = document.createElement("span")
		button.append(buttonLabel)

		const roleButton = document.createElement("div")
		roleButton.setAttribute("role", "button")
		const editor = document.createElement("div")
		Object.defineProperty(editor, "isContentEditable", { value: true })

		expect(isEditorInteractiveKeyboardTarget(buttonLabel)).toBe(true)
		expect(isEditorInteractiveKeyboardTarget(document.createElement("input"))).toBe(true)
		expect(isEditorInteractiveKeyboardTarget(document.createElement("select"))).toBe(true)
		expect(isEditorInteractiveKeyboardTarget(roleButton)).toBe(true)
		expect(isEditorInteractiveKeyboardTarget(editor)).toBe(true)
	})

	it("allows canvas and non-interactive targets to use editor shortcuts", () => {
		expect(isEditorInteractiveKeyboardTarget(document.createElement("canvas"))).toBe(false)
		expect(isEditorInteractiveKeyboardTarget(document.createElement("div"))).toBe(false)
		expect(isEditorInteractiveKeyboardTarget(null)).toBe(false)
	})
})
