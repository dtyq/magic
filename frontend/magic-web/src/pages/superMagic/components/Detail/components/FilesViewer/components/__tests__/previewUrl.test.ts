import { describe, expect, it } from "vitest"
import { resolveSafePreviewUrl } from "../previewUrl"

describe("resolveSafePreviewUrl", () => {
	it("allows https urls for embedded previews", () => {
		expect(resolveSafePreviewUrl("https://example.com/source")).toBe(
			"https://example.com/source",
		)
	})

	it("allows http urls for internal or development source links", () => {
		expect(resolveSafePreviewUrl("http://example.com/source")).toBe("http://example.com/source")
	})

	it("allows relative urls after resolving them against the current origin", () => {
		expect(resolveSafePreviewUrl("/api/files/source")).toBe(
			"http://localhost:3000/api/files/source",
		)
	})

	it.each([
		"javascript:alert(1)",
		"data:text/html,<script>alert(1)</script>",
		"file:///etc/passwd",
		"blob:https://example.com/id",
	])("rejects unsafe preview url %s", (url) => {
		expect(resolveSafePreviewUrl(url)).toBeNull()
	})
})
