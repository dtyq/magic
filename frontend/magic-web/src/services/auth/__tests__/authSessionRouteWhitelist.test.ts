import { describe, expect, it } from "vitest"
import { isSessionInvalidationExemptRoute } from "../authSessionRouteWhitelist"

describe("isSessionInvalidationExemptRoute", () => {
	it("skips public share routes", () => {
		expect(isSessionInvalidationExemptRoute("/share/files/1")).toBe(true)
		expect(isSessionInvalidationExemptRoute("/share/topic/1")).toBe(true)
		expect(isSessionInvalidationExemptRoute("/share/topic-1/file/file-1")).toBe(true)
		expect(isSessionInvalidationExemptRoute("/micro-app/1")).toBe(true)
		expect(isSessionInvalidationExemptRoute("/magic-share/project-1/topic-1")).toBe(true)
	})

	it("keeps authenticated workspace routes subject to session invalidation", () => {
		expect(isSessionInvalidationExemptRoute("/global/super/1/2")).toBe(false)
		expect(isSessionInvalidationExemptRoute("/super/micro-app/1")).toBe(false)
		expect(isSessionInvalidationExemptRoute("/super/shared-workspace")).toBe(false)
		expect(isSessionInvalidationExemptRoute("")).toBe(false)
	})
})
