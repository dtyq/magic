import { describe, expect, it, vi } from "vitest"
import { clusterLoginAdapter } from "../cluster-login-adapter"
import openAccountModal from "@/opensource/pages/login/AccountModal"

vi.mock("@/opensource/pages/login/AccountModal", () => {
	return {
		default: vi.fn(() => ({
			close: vi.fn(),
		})),
	}
})

describe("opensource clusterLoginAdapter", () => {
	it("should forward params to opensource openAccountModal", () => {
		const params = {
			clusterCode: "dev",
			source: "cluster-layout" as const,
		}

		clusterLoginAdapter.open(params)

		expect(openAccountModal).toHaveBeenCalledTimes(1)
		expect(openAccountModal).toHaveBeenCalledWith(params)
	})
})
