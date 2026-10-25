import { describe, expect, it } from "vitest"
import { getOperationResultListData } from "../toolDetailDisplay"

describe("getOperationResultListData", () => {
	it("keeps the list visible while one generation is still waiting for timing", () => {
		const data = getOperationResultListData({
			type: "operation_result_list",
			data: {
				items: [
					{
						label: "Ready",
						kind: "text",
						status: "success",
						message: "Generating",
						started_at: "2026-10-07T17:14:00+08:00",
						expected_finished_at: "2026-10-07T17:14:45+08:00",
						is_processing: true,
					},
					{
						label: "Waiting",
						kind: "text",
						status: "success",
						message: "Generating",
						started_at: null,
						expected_finished_at: null,
						is_processing: true,
					},
				],
			},
		})

		expect(data?.items).toHaveLength(2)
		expect(data?.items[1].started_at).toBeUndefined()
		expect(data?.items[1].expected_finished_at).toBeUndefined()
	})

	it("still rejects a malformed timing value", () => {
		expect(
			getOperationResultListData({
				type: "operation_result_list",
				data: {
					items: [
						{
							label: "Broken",
							kind: "text",
							status: "success",
							message: "Generating",
							started_at: 123,
						},
					],
				},
			}),
		).toBeUndefined()
	})
})
