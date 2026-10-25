import { describe, expect, it } from "vitest"
import { escapeCodeHtml, highlightCodeHtml } from "./search-highlights"

describe("code search highlights", () => {
	it("uses source offsets when syntax transformers remove annotation text", () => {
		const source = "const a = 1 // [!code highlight]\ntest"
		const output = document.createElement("div")
		output.innerHTML = highlightCodeHtml(
			"<pre><code>const a = 1\ntest</code></pre>",
			[{ from: source.indexOf("test"), to: source.length, className: "search-result" }],
			source,
		)
		expect(output.textContent).toBe(source)
		expect(output.querySelector(".search-result")?.textContent).toBe("test")
	})

	it("highlights across syntax tokens and lines without changing source text", () => {
		const html =
			'<pre><code>  <span style="color:red">te</span><span>st</span>\nnext test</code></pre>'
		const output = document.createElement("div")
		output.innerHTML = highlightCodeHtml(html, [
			{ from: 2, to: 6, className: "search-result search-result-current" },
			{ from: 12, to: 16, className: "search-result" },
		])
		expect(output.textContent).toBe("  test\nnext test")
		expect(
			Array.from(
				output.querySelectorAll(".search-result-current"),
				(el) => el.textContent,
			).join(""),
		).toBe("test")
		expect(output.querySelector('[style="color:red"]')?.textContent).toBe("te")
		expect(output.querySelectorAll(".search-result")).toHaveLength(3)
		expect(output.querySelectorAll(".search-result")[2].textContent).toBe("test")
		expect(highlightCodeHtml(html, [])).toBe(html)
	})

	it("keeps code markup as literal text even before syntax highlighting is ready", () => {
		const code = '<img src=x onerror="alert(1)"> & test'
		const output = document.createElement("div")
		output.innerHTML = highlightCodeHtml(`<pre><code>${escapeCodeHtml(code)}</code></pre>`, [
			{ from: code.indexOf("test"), to: code.length, className: "search-result" },
		])
		expect(output.querySelector("img")).toBeNull()
		expect(output.textContent).toBe(code)
		expect(output.querySelector(".search-result")?.textContent).toBe("test")
	})
})
