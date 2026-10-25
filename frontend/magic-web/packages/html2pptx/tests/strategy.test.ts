import { describe, expect, it } from "vitest"
import { resolveStreamingMediaPolicyMode } from "../src/api/strategy"

describe("resolveStreamingMediaPolicyMode", () => {
	it("direct-streams auto media when the pipeline does not replay pages", () => {
		expect(resolveStreamingMediaPolicyMode({ mode: "auto" })).toBe("direct-stream")
		expect(resolveStreamingMediaPolicyMode(undefined)).toBe("direct-stream")
	})

	it("rolling-stages auto media when a second pass or expiring URL requires replay", () => {
		expect(resolveStreamingMediaPolicyMode({ mode: "auto" }, { requiresReplay: true })).toBe(
			"rolling-stage",
		)
		expect(resolveStreamingMediaPolicyMode(undefined, { hasExpiringUrls: true })).toBe(
			"rolling-stage",
		)
	})

	it("preserves every explicit media policy", () => {
		expect(
			resolveStreamingMediaPolicyMode({ mode: "direct-stream" }, { requiresReplay: true }),
		).toBe("direct-stream")
		expect(resolveStreamingMediaPolicyMode({ mode: "rolling-stage" })).toBe("rolling-stage")
		expect(resolveStreamingMediaPolicyMode({ mode: "full-stage" })).toBe("full-stage")
	})
})
