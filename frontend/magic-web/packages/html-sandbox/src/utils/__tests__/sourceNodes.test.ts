import { describe, expect, it } from "vitest"
import {
	markSourceNode,
	markSourceSubtree,
	markSourceNodes,
	removeRuntimeNodes,
	SOURCE_NODE_ATTRIBUTE,
} from "../sourceNodes"

describe("sourceNodes", () => {
	it("keeps editor-inserted subtrees when runtime nodes are removed", () => {
		document.body.innerHTML = "<section><p>Fixed</p></section>"
		markSourceNodes(document)

		const inserted = document.createElement("div")
		inserted.innerHTML = "<img src='./images/inserted.png' />"
		document.querySelector("section")?.appendChild(inserted)
		markSourceSubtree(inserted)

		removeRuntimeNodes(document)

		expect(document.querySelector("img")).toBe(inserted.firstElementChild)
		expect(inserted.hasAttribute(SOURCE_NODE_ATTRIBUTE)).toBe(true)
		expect(inserted.firstElementChild?.hasAttribute(SOURCE_NODE_ATTRIBUTE)).toBe(true)
	})

	it("does not promote runtime descendants when marking an existing source node", () => {
		document.body.innerHTML = "<section><p>Fixed</p></section>"
		markSourceNodes(document)

		const section = document.querySelector("section") as HTMLElement
		const dynamic = document.createElement("span")
		dynamic.textContent = "Dynamic"
		section.appendChild(dynamic)

		markSourceNode(section)

		expect(section.hasAttribute(SOURCE_NODE_ATTRIBUTE)).toBe(true)
		expect(dynamic.hasAttribute(SOURCE_NODE_ATTRIBUTE)).toBe(false)

		removeRuntimeNodes(document)

		expect(document.querySelector("section")?.textContent).toBe("Fixed")
	})
})
