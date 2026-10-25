import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/utils/env", () => ({
	env: vi.fn((key: string, _isCurrentEnv?: boolean, clusterCode?: string) => {
		if (clusterCode) return `https://${clusterCode}.${key.toLowerCase()}.test`
		return `https://saas.${key.toLowerCase()}.test`
	}),
}))

import { env } from "@/utils/env"
import {
	getClusterServiceUrls,
	getKeewoodServiceUrl,
	getTeamshareServiceUrl,
} from "../cluster-service-url"

describe("cluster-service-url", () => {
	beforeEach(() => {
		vi.mocked(env).mockClear()
	})

	it("falls back to saas env when clusterCode is missing", () => {
		expect(getKeewoodServiceUrl()).toBe("https://saas.magic_service_keewood_base_url.test")
		expect(getTeamshareServiceUrl(null)).toBe(
			"https://saas.magic_service_teamshare_base_url.test",
		)
		expect(env).toHaveBeenCalledWith("MAGIC_SERVICE_KEEWOOD_BASE_URL", false, undefined)
		expect(env).toHaveBeenCalledWith("MAGIC_SERVICE_TEAMSHARE_BASE_URL", false, undefined)
	})

	it("resolves cluster-scoped service urls", () => {
		expect(getKeewoodServiceUrl("private-demo")).toBe(
			"https://private-demo.magic_service_keewood_base_url.test",
		)
		expect(getTeamshareServiceUrl("private-demo")).toBe(
			"https://private-demo.magic_service_teamshare_base_url.test",
		)
		expect(env).toHaveBeenCalledWith("MAGIC_SERVICE_KEEWOOD_BASE_URL", false, "private-demo")
		expect(env).toHaveBeenCalledWith("MAGIC_SERVICE_TEAMSHARE_BASE_URL", false, "private-demo")
	})

	it("returns both service urls together", () => {
		expect(getClusterServiceUrls("private-demo")).toEqual({
			keewood: "https://private-demo.magic_service_keewood_base_url.test",
			teamshare: "https://private-demo.magic_service_teamshare_base_url.test",
		})
	})
})
