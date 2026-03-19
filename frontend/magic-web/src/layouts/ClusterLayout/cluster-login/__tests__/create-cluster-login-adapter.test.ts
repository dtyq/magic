import { describe, expect, it, vi } from "vitest"
import { createClusterLoginAdapter } from "../create-cluster-login-adapter"
import type { ClusterLoginSession } from "../types"

describe("createClusterLoginAdapter", () => {
	it("should call openModal with the same params", () => {
		const openModal = vi.fn()
		const adapter = createClusterLoginAdapter({ openModal })
		const params = {
			clusterCode: "prod",
			source: "cluster-layout" as const,
		}

		adapter.open(params)

		expect(openModal).toHaveBeenCalledTimes(1)
		expect(openModal).toHaveBeenCalledWith(params)
	})

	it("should return session from openModal", () => {
		const session: ClusterLoginSession = {
			close: vi.fn(),
		}
		const openModal = vi.fn(() => session)
		const adapter = createClusterLoginAdapter({ openModal })

		const result = adapter.open({})

		expect(result).toBe(session)
	})
})
