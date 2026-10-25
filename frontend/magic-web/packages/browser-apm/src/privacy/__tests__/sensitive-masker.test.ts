import { afterEach, describe, expect, it } from "vitest"
import { SensitiveMasker } from ".."

const originalConfig = SensitiveMasker.config
afterEach(() => {
	SensitiveMasker.config = originalConfig
})

describe("APM payload masking", () => {
	it("masks nested sensitive keys without mutating the original payload", () => {
		const payload = {
			Authorization: "abcdefghijklmnop",
			entries: [{ password: "short", status: 200 }],
			nested: { email: "user@example.com" },
		}
		const result = SensitiveMasker.sanitize(payload)
		expect(result).toEqual({
			Authorization: "abcd********mnop",
			entries: [{ password: "*****", status: 200 }],
			nested: { email: "user********.com" },
		})
		expect(payload.Authorization).toBe("abcdefghijklmnop")
		expect(payload.entries[0].password).toBe("short")
		expect(result).not.toBe(payload)
	})
	it("preserves ordinary values and substitutes function values", () => {
		expect(SensitiveMasker.sanitize([null, undefined, 42, false, "plain", () => 1])).toEqual([
			null,
			undefined,
			42,
			false,
			"plain",
			"[FUNCTION]",
		])
	})
	it("keeps URL metadata while masking sensitive query values on repeated reports", () => {
		const url = "https://example.test/path?token=abcdefghijklmnop&page=2"
		for (let i = 0; i < 3; i++) {
			expect(SensitiveMasker.sanitize(url)).toBe(
				"https://example.test/path?token=abcd********mnop&page=2",
			)
		}
	})
	it("preserves JSON-string masking behavior, including object-valued sensitive keys", () => {
		expect(
			SensitiveMasker.sanitize(
				JSON.stringify({
					password: "abcdefghijklmnop",
					token: { raw: "value" },
					status: 200,
				}),
			),
		).toBe(
			JSON.stringify({ password: "abcd********mnop", token: "[MASKED OBJECT]", status: 200 }),
		)
	})
	it("applies updated masking configuration to default URL rules", () => {
		SensitiveMasker.config = {
			...originalConfig,
			keys: ["credential"],
			useFixedReplacement: true,
			replacement: "hidden",
		}
		expect(
			SensitiveMasker.sanitize("https://example.test/?credential=secret&token=visible"),
		).toBe("https://example.test/?credential=hidden&token=visible")
	})
	it("retains custom string and callback replacement rules", () => {
		SensitiveMasker.config = {
			...originalConfig,
			patterns: [
				{ pattern: /secret/g, replacement: "hidden" },
				{ pattern: /id=(\d+)/g, replacement: (_match, id) => `id:${id}` },
			],
		}
		expect(SensitiveMasker.sanitize("secret id=123")).toBe("hidden id:123")
	})
})
