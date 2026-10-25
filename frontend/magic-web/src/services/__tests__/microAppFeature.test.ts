import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isMicroAppEnabled } from "../microAppFeature"

vi.mock("@/models/config/stores/cluster.store", () => ({
	clusterStore: { clusterConfig: null },
}))

describe("isMicroAppEnabled", () => {
	const originalConfig = window.CONFIG

	beforeEach(() => {
		window.CONFIG = { DEV: false }
		vi.stubEnv("MAGIC_MICRO_APP_ENABLED", undefined)
		vi.stubEnv("MAGIC_IS_PRIVATE_DEPLOY", "false")
	})

	afterEach(() => {
		window.CONFIG = originalConfig
		vi.unstubAllEnvs()
	})

	it.each(["true", "false"])(
		"explicit values override %s private deployment",
		(privateDeploy) => {
			vi.stubEnv("MAGIC_IS_PRIVATE_DEPLOY", privateDeploy)
			vi.stubEnv("MAGIC_MICRO_APP_ENABLED", "true")
			expect(isMicroAppEnabled()).toBe(true)

			vi.stubEnv("MAGIC_MICRO_APP_ENABLED", "false")
			expect(isMicroAppEnabled()).toBe(false)
		},
	)

	it.each([undefined, "", "invalid", "TRUE", "1"])(
		"preserves deployment defaults for %s",
		(enabled) => {
			vi.stubEnv("MAGIC_MICRO_APP_ENABLED", enabled)
			expect(isMicroAppEnabled()).toBe(true)

			vi.stubEnv("MAGIC_IS_PRIVATE_DEPLOY", "true")
			expect(isMicroAppEnabled()).toBe(false)
		},
	)

	it.each([
		["true", "false", false],
		["false", "true", true],
	] as const)("build %s is overridden by runtime %s", (buildValue, runtimeValue, expected) => {
		vi.stubEnv("MAGIC_MICRO_APP_ENABLED", buildValue)
		window.CONFIG.MAGIC_MICRO_APP_ENABLED = runtimeValue
		expect(isMicroAppEnabled()).toBe(expected)
	})

	it("uses the runtime deployment default when the override is empty", () => {
		vi.stubEnv("MAGIC_MICRO_APP_ENABLED", "true")
		window.CONFIG = {
			DEV: false,
			MAGIC_MICRO_APP_ENABLED: "" as ImportMetaEnv["MAGIC_MICRO_APP_ENABLED"],
			MAGIC_IS_PRIVATE_DEPLOY: "true",
		}
		expect(isMicroAppEnabled()).toBe(false)
	})
})
