import { describe, expect, it } from "vitest"
import {
	collectPrecacheAssetUrlsFromAssetFilenames,
	isPrecacheableStaticAssetPath,
} from "../collect-precache-asset-urls"

describe("collectPrecacheAssetUrls", () => {
	it("accepts hashed js and css under /assets", () => {
		expect(isPrecacheableStaticAssetPath("/assets/main-abc123_.js")).toBe(true)
		expect(isPrecacheableStaticAssetPath("/assets/index-Ab12Cd34.css")).toBe(true)
	})

	it("rejects html, config, and short hash segments", () => {
		expect(isPrecacheableStaticAssetPath("/index.html")).toBe(false)
		expect(isPrecacheableStaticAssetPath("/assets/main.js")).toBe(false)
		expect(isPrecacheableStaticAssetPath("/config.js")).toBe(false)
	})

	it("collects and deduplicates filenames from dist/assets", () => {
		const urls = collectPrecacheAssetUrlsFromAssetFilenames([
			"main-abc12345.js",
			"SuperMagic-xyz98765.js",
			"index-def45678.css",
			"main-abc12345.js",
			"logo.png",
			"plain.js",
		])

		expect(urls).toEqual([
			"/assets/SuperMagic-xyz98765.js",
			"/assets/index-def45678.css",
			"/assets/main-abc12345.js",
		])
	})
})
