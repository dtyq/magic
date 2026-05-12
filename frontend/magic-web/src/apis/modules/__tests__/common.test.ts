import { describe, expect, it, vi } from "vitest"
import type { HttpClient } from "../../core/HttpClient"
import { generateCommonApi } from "../common"

describe("generateCommonApi", () => {
	it("passes skipAppInitWait to getPrivateLoginConfig request config", async () => {
		const post = vi.fn().mockResolvedValue({})
		const commonApi = generateCommonApi({
			post,
		} as unknown as HttpClient)

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
