import { describe, expect, it } from "vitest"
import { getAvatarUrl } from "../avatar"

describe("getAvatarUrl", () => {
	it("preserves existing query parameters when optimizing a public TOS avatar", () => {
		expect(
			getAvatarUrl("https://example.tos-cn-beijing.volces.com/avatar.png?tenant=magic", 32),
		).toContain(
			"tenant=magic&x-tos-process=image%2Fresize%2Ch_64%2Fformat%2Cwebp%2Fquality%2CQ_85",
		)
	})

	it("normalizes an existing simple thumbnail without duplicate process parameters", () => {
		const url =
			"https://example.tos-cn-beijing.volces.com/avatar.png?x-tos-process=image/resize,h_64"
		const result = getAvatarUrl(url, 32)
		expect(new URL(result).searchParams.getAll("x-tos-process")).toEqual([
			"image/resize,h_64/format,webp/quality,Q_85",
		])
		expect(getAvatarUrl(result, 32)).toBe(result)
	})

	it("keeps signed avatars unchanged", () => {
		const url = "https://example.tos-cn-beijing.volces.com/avatar.png?X-Tos-Signature=secret"
		expect(getAvatarUrl(url, 32)).toBe(url)
	})
})
