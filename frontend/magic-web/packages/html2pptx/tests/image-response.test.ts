import { describe, expect, it } from "vitest"
import { detectImageContentType, validateImageBlobResponse } from "../src/media/image-response"

describe("image response validation", () => {
	it.each([
		["png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"],
		["jpeg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"],
		["gif", new TextEncoder().encode("GIF89a"), "image/gif"],
		["webp", new TextEncoder().encode("RIFFxxxxWEBP"), "image/webp"],
		["svg", new TextEncoder().encode("<?xml version=\"1.0\"?><svg></svg>"), "image/svg+xml"],
	] as const)("detects %s from payload bytes", (_name, bytes, expected) => {
		expect(detectImageContentType(bytes)).toBe(expected)
	})

	it("rejects a successful HTML response even when the URL ends in .png", async () => {
		const html = new Blob(["<!doctype html><html>login</html>"], { type: "text/html" })
		await expect(
			validateImageBlobResponse(html, "https://example.test/image.png", "text/html", "image/png"),
		).rejects.toThrow(/HTML instead of an image/)
	})

	it("uses the payload signature when the server omits a useful MIME type", async () => {
		const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])])
		const result = await validateImageBlobResponse(png, "https://example.test/image", "")
		expect(result.type).toBe("image/png")
	})
})
