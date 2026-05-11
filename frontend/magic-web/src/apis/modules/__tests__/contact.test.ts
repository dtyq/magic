import { describe, expect, it, vi } from "vitest"
import type { HttpClient } from "../../core/HttpClient"
import { generateContactApi } from "../contact"

describe("generateContactApi", () => {
	it("passes skipAppInitWait to getUsersInfo request config", async () => {
		const post = vi.fn().mockResolvedValue({ items: [] })
		const contactApi = generateContactApi({
			post,
		} as unknown as HttpClient)

		await contactApi.getUsersInfo(
			{
				user_ids: ["user-1"],
				query_type: 2,
			},
			{
				skipAppInitWait: true,
			},
		)

		expect(post).toHaveBeenCalledWith(
			expect.any(String),
			{
				user_ids: ["user-1"],
				query_type: 2,
			},
			expect.objectContaining({
				enableRequestUnion: true,
				skipAppInitWait: true,
			}),
		)
	})
})
