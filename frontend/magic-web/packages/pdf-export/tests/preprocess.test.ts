import { describe, expect, it } from "vitest"
import { preprocessString } from "../src/preprocess/stringLevel"

describe("string preprocess", () => {
	it("eager-loads lazy images and injects intersection observer patch", () => {
		const html = "<html><head></head><body><img loading=\"lazy\" data-src=\"a.png\"></body></html>"
		const result = preprocessString(html)

		expect(result).toContain("loading=\"eager\"")
		expect(result).toContain("src=\"a.png\"")
		expect(result).toContain("data-pdf-export-intersection-observer-patch")
	})

	it("does not add duplicate src when data-src image already has src", () => {
		const html = "<img src=\"original.png\" data-src=\"lazy.png\">"
		const result = preprocessString(html)

		expect(result).toContain("src=\"original.png\"")
		expect(result.match(/\ssrc="/g)).toHaveLength(1)
	})
})
