import type { MobileSettingsFeedbackPrefill } from "../components/feedbackShared"

/** Known feedback category ids — must match useMobileSettingsFeedbackCategories. */
export const MOBILE_FEEDBACK_CATEGORY_IDS = {
	functionUsage: "functionUsageFeedback",
	creditDeduct: "creditDeductRelated",
	creditRecharge: "creditRechargeRelated",
	order: "orderRelated",
} as const

/** Scenarios supported by buildMobileFeedbackPrefill. Extend when adding new entry points. */
export type MobileFeedbackPrefillScenario =
	| "conversation"
	| "claw"
	| "pointsChange"
	| "subscriptionBill"
	| "plain"

export interface ConversationFeedbackPrefillContext {
	topicId: string
	topicName: string
}

export interface ClawFeedbackPrefillContext {
	clawId: string
	clawName: string
}

export interface PointsChangeFeedbackPrefillContext {
	recordId: string
	direction: "income" | "expense"
}

export interface SubscriptionBillFeedbackPrefillContext {
	/** User-visible order number (platform order id preferred). */
	orderId: string
}

export type BuildMobileFeedbackPrefillParams =
	| {
			scenario: "conversation"
			context: ConversationFeedbackPrefillContext
	  }
	| {
			scenario: "claw"
			context: ClawFeedbackPrefillContext
	  }
	| {
			scenario: "pointsChange"
			context: PointsChangeFeedbackPrefillContext
	  }
	| {
			scenario: "subscriptionBill"
			context: SubscriptionBillFeedbackPrefillContext
	  }
	| {
			scenario: "plain"
	  }

export type MobileFeedbackPrefillBuilder = () => MobileSettingsFeedbackPrefill | undefined
