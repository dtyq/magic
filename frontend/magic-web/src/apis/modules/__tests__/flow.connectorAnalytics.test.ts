import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"
import { generateFlowApi } from "../flow"

const { track } = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock("@/services/analytics", () => ({ analyticsService: { report: track } }))

describe("FlowApi connector attempt analytics", () => {
	beforeEach(() => track.mockReset())

	it("reports before creation and therefore also survives request failure", async () => {
		const post = vi.fn().mockRejectedValue(new Error("request failed"))
		const api = generateFlowApi({ post } as unknown as ServiceHttpClient)
		await expect(api.saveMcp({ type: "external_stdio" })).rejects.toThrow("request failed")
		expect(track).toHaveBeenCalledWith("connector_create_attempted", {
			connector_type: "external_stdio",
		})
	})

	it("does not report edits", async () => {
		const post = vi.fn().mockResolvedValue({ id: "connector-existing" })
		const api = generateFlowApi({ post } as unknown as ServiceHttpClient)
		await api.saveMcp({ id: "connector-existing", type: "external_sse" })
		expect(track).not.toHaveBeenCalled()
	})
})
