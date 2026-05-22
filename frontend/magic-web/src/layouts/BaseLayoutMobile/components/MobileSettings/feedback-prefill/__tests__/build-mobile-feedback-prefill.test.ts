import { beforeEach, describe, expect, it, vi } from "vitest"

import { MOBILE_FEEDBACK_CATEGORY_IDS } from "../types"
import { buildMobileFeedbackPrefill } from "../build-mobile-feedback-prefill"

const getFixedTMock = vi.hoisted(() =>
	vi.fn((key: string, options?: Record<string, string>) => {
		if (key === "onlineFeedback.conversationFeedbackTitle") {
			return `对话「${options?.topicName}」反馈`
		}
		if (key === "onlineFeedback.conversationFeedbackDescription") {
			return `对话ID：${options?.topicId}\n请描述对话中遇到的问题或希望改进的地方：`
		}
		if (key === "onlineFeedback.clawFeedbackTitle") {
			return `对话「${options?.clawName}」反馈`
		}
		if (key === "onlineFeedback.clawFeedbackDescription") {
			return `龙虾ID：${options?.clawId}\n请描述对话中遇到的问题或希望改进的地方：`
		}
		if (key === "onlineFeedback.pointsDeductProblemDescription") {
			return `流水 ID：${options?.id}\n积分疑问`
		}
		if (key === "onlineFeedback.pointsTopUpProblemDescription") {
			return `流水 ID：${options?.id}\n充值疑问`
		}
		if (key === "onlineFeedback.orderProblemDescription") {
			return `订单编号：${options?.id}\n补充描述：`
		}
		if (key === "onlineFeedback.orderFeedbackTitle") {
			return `订单 ${options?.orderNo} 相关问题`
		}
		return key
	}),
)

vi.mock("i18next", () => ({
	default: {
		language: "zh_CN",
		getFixedT: () => getFixedTMock,
	},
}))

describe("buildMobileFeedbackPrefill", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("builds conversation prefill with topic id and related context", () => {
		const result = buildMobileFeedbackPrefill({
			scenario: "conversation",
			context: {
				topicId: "topic-1",
				topicName: "Brand Strategy Review",
			},
		})

		expect(result.categoryId).toBe(MOBILE_FEEDBACK_CATEGORY_IDS.functionUsage)
		expect(result.title).toBe("对话「Brand Strategy Review」反馈")
		expect(result.description).toBe("对话ID：topic-1\n请描述对话中遇到的问题或希望改进的地方：")
	})

	it("builds claw prefill with claw id label", () => {
		const result = buildMobileFeedbackPrefill({
			scenario: "claw",
			context: {
				clawId: "claw-code-9",
				clawName: "Research Claw",
			},
		})

		expect(result.categoryId).toBe(MOBILE_FEEDBACK_CATEGORY_IDS.functionUsage)
		expect(result.title).toBe("对话「Research Claw」反馈")
		expect(result.description).toContain("龙虾ID：claw-code-9")
	})

	it("builds points expense prefill with credit deduct category", () => {
		const result = buildMobileFeedbackPrefill({
			scenario: "pointsChange",
			context: { recordId: "record-99", direction: "expense" },
		})

		expect(result.categoryId).toBe(MOBILE_FEEDBACK_CATEGORY_IDS.creditDeduct)
		expect(result.description).toContain("record-99")
	})

	it("builds points income prefill with credit recharge category", () => {
		const result = buildMobileFeedbackPrefill({
			scenario: "pointsChange",
			context: { recordId: "record-88", direction: "income" },
		})

		expect(result.categoryId).toBe(MOBILE_FEEDBACK_CATEGORY_IDS.creditRecharge)
		expect(result.description).toContain("充值疑问")
	})

	it("builds subscription-bill prefill with order category and title", () => {
		const result = buildMobileFeedbackPrefill({
			scenario: "subscriptionBill",
			context: { orderId: "OD-20260418-001" },
		})

		expect(result.categoryId).toBe(MOBILE_FEEDBACK_CATEGORY_IDS.order)
		expect(result.title).toBe("订单 OD-20260418-001 相关问题")
		expect(result.description).toContain("OD-20260418-001")
	})

	it("returns empty prefill for plain scenario", () => {
		expect(buildMobileFeedbackPrefill({ scenario: "plain" })).toEqual({})
	})
})
