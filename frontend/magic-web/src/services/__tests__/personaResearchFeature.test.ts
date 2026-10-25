import { afterEach, describe, expect, it, vi } from "vitest"
import { isPersonaResearchEnabled } from "../personaResearchFeature"

vi.mock("@/models/config/stores/cluster.store", () => ({
	clusterStore: { clusterConfig: null },
}))

describe("isPersonaResearchEnabled", () => {
	afterEach(() => vi.unstubAllEnvs())

	it("is open on SaaS", () => {
		vi.stubEnv("MAGIC_IS_PRIVATE_DEPLOY", "false")
		expect(isPersonaResearchEnabled()).toBe(true)
	})

	it("is closed on private deployments", () => {
		vi.stubEnv("MAGIC_IS_PRIVATE_DEPLOY", "true")
		expect(isPersonaResearchEnabled()).toBe(false)
	})
})
