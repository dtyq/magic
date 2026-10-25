import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { runInNewContext } from "node:vm"
import { afterEach, describe, expect, it } from "vitest"

const source = readFileSync(
	resolve(
		process.cwd(),
		"../../backend/super-magic/app/tools/persona_research/embed_persona_portraits.py",
	),
	"utf8",
)
const script = source.match(/PORTRAIT_SCRIPT = """([\s\S]*?)"""/)?.[1]
if (!script) throw new Error("Report avatar script is missing")

function run(assets: { id: string; name: string; src: string }[]) {
	const manifest = document.createElement("script")
	manifest.id = "persona-portrait-assets"
	manifest.textContent = JSON.stringify(assets)
	document.body.appendChild(manifest)
	const created: HTMLImageElement[] = []
	function Image() {
		const image = document.createElement("img")
		created.push(image)
		return image
	}
	runInNewContext(script, { document, Image })
	return created
}

afterEach(() => {
	document.body.innerHTML = ""
})

describe("portable report avatar overlay", () => {
	it("uses the same bound image for every occurrence of the persona ID", () => {
		document.body.innerHTML =
			'<span data-persona="One" data-persona-id="p1"><svg></svg></span><span data-persona="One" data-persona-id="p1"><svg></svg></span>'
		const images = run([{ id: "p1", name: "One", src: "data:image/webp;base64,AA==" }])
		expect(images).toHaveLength(2)
		expect(images[0].src).toBe(images[1].src)
		images.forEach((image) => image.dispatchEvent(new Event("load")))
		expect(document.querySelectorAll("[data-persona] img")).toHaveLength(2)
		expect(document.querySelectorAll("svg")).toHaveLength(2)
	})

	it("keeps SVGs on failure and never guesses between namesakes", () => {
		document.body.innerHTML =
			'<span data-persona="Same"><svg></svg></span><span data-persona="Same" data-persona-id="p1"><svg></svg></span>'
		const images = run([
			{ id: "p1", name: "Same", src: "data:image/webp;base64,AA==" },
			{ id: "p2", name: "Same", src: "" },
		])
		expect(images).toHaveLength(1)
		images[0].dispatchEvent(new Event("error"))
		expect(document.querySelectorAll("[data-persona] img")).toHaveLength(0)
		expect(document.querySelectorAll("svg")).toHaveLength(2)
	})
})
