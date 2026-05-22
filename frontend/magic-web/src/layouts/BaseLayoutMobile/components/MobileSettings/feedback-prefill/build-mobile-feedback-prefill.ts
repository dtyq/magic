import i18next from "i18next"

import type { MobileSettingsFeedbackPrefill } from "../components/feedbackShared"
import { MOBILE_FEEDBACK_CATEGORY_IDS, type BuildMobileFeedbackPrefillParams } from "./types"

/**
 * Build MobileSettingsFeedbackSheet prefill for any supported scenario.
 * Centralizes i18n templates so chat, claw, settings, points, orders, etc. share one contract.
 */
export function buildMobileFeedbackPrefill(
	params: BuildMobileFeedbackPrefillParams,
): MobileSettingsFeedbackPrefill {
	const t = i18next.getFixedT(i18next.language, "super")

	if (params.scenario === "plain") {
		return {}
	}

	if (params.scenario === "conversation") {
		const { topicId, topicName } = params.context
		return {
			categoryId: MOBILE_FEEDBACK_CATEGORY_IDS.functionUsage,
			title: t("onlineFeedback.conversationFeedbackTitle", { topicName }),
			description: t("onlineFeedback.conversationFeedbackDescription", { topicId }),
		}
	}

	if (params.scenario === "claw") {
		const { clawId, clawName } = params.context
		return {
			categoryId: MOBILE_FEEDBACK_CATEGORY_IDS.functionUsage,
			title: t("onlineFeedback.clawFeedbackTitle", { clawName }),
			description: t("onlineFeedback.clawFeedbackDescription", { clawId }),
		}
	}

	if (params.scenario === "pointsChange") {
		const { recordId, direction } = params.context
		const isExpense = direction === "expense"

		return {
			categoryId: isExpense
				? MOBILE_FEEDBACK_CATEGORY_IDS.creditDeduct
				: MOBILE_FEEDBACK_CATEGORY_IDS.creditRecharge,
			title: isExpense ? t("onlineFeedback.pointsDeductFeedbackTitle") : undefined,
			description: isExpense
				? t("onlineFeedback.pointsDeductProblemDescription", { id: recordId })
				: t("onlineFeedback.pointsTopUpProblemDescription", { id: recordId }),
		}
	}

	if (params.scenario === "subscriptionBill") {
		const { orderId } = params.context

		return {
			categoryId: MOBILE_FEEDBACK_CATEGORY_IDS.order,
			title: t("onlineFeedback.orderFeedbackTitle", { orderNo: orderId }),
			description: t("onlineFeedback.orderProblemDescription", { id: orderId }),
		}
	}

	const _exhaustive: never = params
	return _exhaustive
}
