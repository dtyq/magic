import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/models/config", () => ({
	configStore: {
		cluster: {
			clusterCode: "",
		},
	},
}))

vi.mock("@/utils/env", () => ({
	env: vi.fn((key: string, _isCurrentEnv?: boolean, clusterCode?: string) => {
		if (clusterCode) return `https://${clusterCode}.${key.toLowerCase()}.test`
		return `https://saas.${key.toLowerCase()}.test`
	}),
}))

import { configStore } from "@/models/config"
import { env } from "@/utils/env"
import { resolveClusterScopedBaseURL } from "../resolve-cluster-base-url"

describe("resolveClusterScopedBaseURL", () => {
	beforeEach(() => {
		configStore.cluster.clusterCode = ""
		vi.mocked(env).mockClear()
	})

	it("keeps the current client baseURL before global cluster sync", () => {
		const result = resolveClusterScopedBaseURL({
			baseURL: "https://private.keewood.test",
			envKey: "MAGIC_SERVICE_KEEWOOD_BASE_URL",
		})

		expect(result).toBe("https://private.keewood.test")
		expect(env).not.toHaveBeenCalled()
	})

	it("falls back to saas baseURL when no client baseURL exists", () => {
		const result = resolveClusterScopedBaseURL({
			envKey: "MAGIC_SERVICE_TEAMSHARE_BASE_URL",
		})

		expect(result).toBe("https://saas.magic_service_teamshare_base_url.test")
		expect(env).toHaveBeenCalledWith("MAGIC_SERVICE_TEAMSHARE_BASE_URL")
	})

	it("uses the cluster-scoped env when global cluster is ready", () => {
		configStore.cluster.clusterCode = "private-demo"

		const result = resolveClusterScopedBaseURL({
			baseURL: "https://stale.keewood.test",
			envKey: "MAGIC_SERVICE_KEEWOOD_BASE_URL",
		})

		expect(result).toBe("https://private-demo.magic_service_keewood_base_url.test")
		expect(env).toHaveBeenCalledWith("MAGIC_SERVICE_KEEWOOD_BASE_URL", false, "private-demo")
	})
})
