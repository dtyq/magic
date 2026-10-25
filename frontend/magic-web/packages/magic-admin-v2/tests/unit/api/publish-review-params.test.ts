import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
	countActiveReviewFilters,
	createDefaultFilterDraft,
	createReviewPayload,
	toAgentReviewParams,
	toSkillReviewParams,
} from "../../../src/features/platform-publish-review/params.ts"

describe("publish review request parameters", () => {
	it("does not count the default skill source type as an active filter", () => {
		assert.equal(countActiveReviewFilters(createDefaultFilterDraft("skill"), "skill"), 0)
	})

	it("builds employee review params from the selected search field", () => {
		const draft = {
			...createDefaultFilterDraft("employee"),
			search_field: "organization_code" as const,
			search_value: "  ORG-001 ",
			review_status: "UNDER_REVIEW",
		}
		assert.deepEqual(toAgentReviewParams(draft, 2), {
			page: 2,
			page_size: 20,
			order_by: "desc",
			organization_code: "ORG-001",
			review_status: "UNDER_REVIEW",
		})
	})

	it("builds skill review params without sending select-all values", () => {
		const draft = {
			...createDefaultFilterDraft("skill", "internal"),
			search_field: "skill_name" as const,
			search_value: "  summarize ",
			source_type: "SYSTEM",
			version: " 1.2.0 ",
		}
		assert.deepEqual(toSkillReviewParams(draft, 1), {
			page: 1,
			page_size: 20,
			order_by: "desc",
			skill_name: "summarize",
			source_type: "SYSTEM",
			version: "1.2.0",
		})
	})

	it("requires a trimmed rejection remark only for internal review", () => {
		assert.deepEqual(createReviewPayload({ action: "REJECTED", reviewRemark: "  bad  " }, "internal"), {
			action: "REJECTED",
			review_remark: "bad",
		})
		assert.deepEqual(createReviewPayload({ action: "REJECTED", reviewRemark: "   " }, "internal"), {
			action: "REJECTED",
			review_remark: null,
		})
		assert.deepEqual(createReviewPayload({ action: "APPROVED", publisherType: "OFFICIAL" }, "platform"), {
			action: "APPROVED",
			publisher_type: "OFFICIAL",
		})
	})
})
