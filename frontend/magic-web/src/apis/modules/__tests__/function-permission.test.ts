import { describe, expect, it, vi } from "vitest"
import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"
import { generateFunctionPermissionApi } from "../function-permission"

describe("generateFunctionPermissionApi", () => {
	it("loads function permissions and permission groups from their dedicated endpoints", async () => {
		const get = vi.fn().mockResolvedValue({})
		const api = generateFunctionPermissionApi({ get } as unknown as ServiceHttpClient)

		await api.getMe()
		await api.getPermissionGroups()

		expect(get).toHaveBeenNthCalledWith(1, "/api/v1/function-permissions/me")
		expect(get).toHaveBeenNthCalledWith(2, "/api/v1/permissions/me")
	})
})
