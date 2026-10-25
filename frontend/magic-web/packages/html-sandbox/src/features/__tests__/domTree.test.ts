import { afterEach, describe, expect, it } from "vitest"
import { buildDomTree, resetEditorNodeIds } from "../domTree"
import { markSourceNodes } from "../../utils/sourceNodes"

describe("domTree", () => {
	afterEach(() => {
		resetEditorNodeIds(document.body)
		document.body.replaceChildren()
		document.documentElement.removeAttribute("data-magic-source-node")
	})

	it("omits JavaScript-created nodes from the editable structure", () => {
		document.body.innerHTML = "<section><p>Fixed</p></section>"
		markSourceNodes(document)
		const dynamic = document.createElement("p")
		dynamic.textContent = "Dynamic"
		document.querySelector("section")?.appendChild(dynamic)

		const tree = buildDomTree()
		expect(tree.root.children[0].children).toHaveLength(1)
		expect(tree.root.children[0].children[0].textContent).toBe("Fixed")
	})

	it("only exposes text previews for leaf elements", () => {
		document.body.innerHTML = `
			<section class="card">
				<div class="content">
					<p>Final text</p>
				</div>
			</section>
		`

		const tree = buildDomTree()
		const section = tree.root.children[0]
		const container = section.children[0]
		const paragraph = container.children[0]

		expect(section.textContent).toBeUndefined()
		expect(container.textContent).toBeUndefined()
		expect(paragraph.textContent).toBe("Final text")
	})

	it("ignores injected children when collecting direct text", () => {
		document.body.innerHTML = `
			<p>
				Visible text
				<span data-injected="true">Editor control</span>
			</p>
		`

		const tree = buildDomTree()
		const paragraph = tree.root.children[0]

		expect(paragraph.children).toHaveLength(0)
		expect(paragraph.textContent).toBe("Visible text")
	})

	it("keeps direct text visible for containers with element children", () => {
		document.body.innerHTML = `
			<div class="mixed">
				Prefix
				<strong>emphasis</strong>
				Suffix
			</div>
		`

		const tree = buildDomTree()
		const mixed = tree.root.children[0]

		expect(mixed.textContent).toBe("Prefix Suffix")
		expect(mixed.children[0].textContent).toBe("emphasis")
	})

	it("keeps the body selectable while root structure operations stay disabled", () => {
		const tree = buildDomTree()

		expect(tree.root.tagName).toBe("body")
		expect(tree.root.canSelect).toBe(true)
		expect(tree.root.editable).toBe(false)
		expect(tree.root.canMove).toBe(false)
		expect(tree.root.canDelete).toBe(false)
	})

	it("shows the original relative path for replaced image resources", () => {
		document.body.innerHTML = `
			<img
				src="https://cdn.example.com/project/assets/chart.png?signature=temporary"
				data-original-path="../assets/chart.png"
			/>
		`

		const tree = buildDomTree()

		expect(tree.root.children[0].resource).toBe("../assets/chart.png")
	})

	it("falls back to the current resource path when no original path is available", () => {
		document.body.innerHTML = '<img src="images/chart.png" />'

		const tree = buildDomTree()

		expect(tree.root.children[0].resource).toBe("images/chart.png")
	})

	it("resolves image sources for thumbnails without replacing the original resource path", () => {
		document.body.innerHTML = `
			<img
				src="https://cdn.example.com/project/assets/chart.png?signature=temporary"
				data-original-path="../assets/chart.png"
			/>
		`

		const tree = buildDomTree()
		const image = tree.root.children[0]

		expect(image.resource).toBe("../assets/chart.png")
		expect(image.thumbnailUrl).toBe(
			"https://cdn.example.com/project/assets/chart.png?signature=temporary",
		)
	})

	it("uses a background image for the node without duplicating descendant image thumbnails", () => {
		document.body.innerHTML = `
			<section class="hero" style="background: url('/images/hero.webp') center / cover no-repeat">
				<div class="content"><img src="images/chart.png" /></div>
			</section>
		`

		const tree = buildDomTree()
		const hero = tree.root.children[0]
		const content = hero.children[0]

		expect(hero.thumbnailUrl).toBe("http://localhost:3000/images/hero.webp")
		expect(content.thumbnailUrl).toBeUndefined()
		expect(content.children[0].thumbnailUrl).toBe("http://localhost:3000/images/chart.png")
	})

	it("does not treat a plain image container as an image-backed node", () => {
		document.body.innerHTML = `
			<div class="image-container"><img src="images/chart.png" /></div>
		`

		const tree = buildDomTree()
		const container = tree.root.children[0]

		expect(container.tagName).toBe("div")
		expect(container.thumbnailUrl).toBeUndefined()
		expect(container.children[0].tagName).toBe("img")
		expect(container.children[0].thumbnailUrl).toBe("http://localhost:3000/images/chart.png")
	})

	it("keeps duplicate ids non-editable without per-node document queries", () => {
		document.body.innerHTML = `
			<section id="duplicate">First</section>
			<section id="duplicate">Second</section>
		`

		const tree = buildDomTree()

		expect(tree.root.children[0].editable).toBe(false)
		expect(tree.root.children[1].editable).toBe(false)
		expect(tree.root.children[0].disabledReason).toBe("节点定位不唯一")
	})

	it("builds deeply nested documents without recursive tree traversal", () => {
		const depth = 300
		document.body.innerHTML = `${"<section>".repeat(depth)}leaf${"</section>".repeat(depth)}`

		const tree = buildDomTree()
		let current = tree.root
		for (let index = 0; index < depth; index += 1) {
			expect(current.children).toHaveLength(1)
			current = current.children[0]
		}

		expect(current.tagName).toBe("section")
		expect(current.textContent).toBe("leaf")
	})
})
