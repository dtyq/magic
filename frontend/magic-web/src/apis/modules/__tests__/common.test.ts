import { describe, expect, it, vi } from "vitest"
import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"
import { generateCommonApi } from "../common"

describe("generateCommonApi", () => {
	it("passes skipAppInitWait to getPrivateLoginConfig request config", async () => {
		const post = vi.fn().mockResolvedValue({})
		const commonApi = generateCommonApi({
			post,
		} as unknown as ServiceHttpClient)

		await commonApi.getPrivateLoginConfig(
			{
				organization_code: "org-1",
				platform_type: "wecom",
			},
			{
				skipAppInitWait: true,
			},
		)

		expect(post).toHaveBeenCalledWith(
			"/v4/user/pre-login",
			{
				data: {
					organization_code: "org-1",
					platform_type: "wecom",
				},
			},
			expect.objectContaining({
				skipAppInitWait: true,
			}),
		)
	})
})
