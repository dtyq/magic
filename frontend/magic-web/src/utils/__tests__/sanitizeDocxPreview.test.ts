import { sanitizeDocxPreviewLinks } from "../sanitizeDocxPreview"

describe("sanitizeDocxPreviewLinks", () => {
	it("keeps HTTP(S) and in-document links", () => {
		const container = document.createElement("div")
		container.innerHTML = `
			<a id="https" href="https://example.com">https</a>
			<a id="relative" href="/document">relative</a>
			<a id="fragment" href="#bookmark">fragment</a>
		`

		sanitizeDocxPreviewLinks(container)

		expect(container.querySelector("#https")?.getAttribute("href")).toBe("https://example.com")
		expect(container.querySelector("#relative")?.getAttribute("href")).toBe("/document")
		expect(container.querySelector("#fragment")?.getAttribute("href")).toBe("#bookmark")
	})

	it("removes executable and unsupported URL schemes", () => {
		const container = document.createElement("div")
		container.innerHTML = `
			<a id="javascript" href="javascript:alert(1)">javascript</a>
			<a id="data" href="data:text/html,<script>alert(1)</script>">data</a>
		`

		sanitizeDocxPreviewLinks(container)

		expect(container.querySelector("#javascript")?.hasAttribute("href")).toBe(false)
		expect(container.querySelector("#data")?.hasAttribute("href")).toBe(false)
	})
})
