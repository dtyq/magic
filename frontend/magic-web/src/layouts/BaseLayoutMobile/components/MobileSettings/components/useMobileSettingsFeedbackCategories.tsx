import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import {
	CircleMinus,
	Coins,
	Crown,
	MessageSquare,
	Receipt,
	ShieldCheck,
	Sparkles,
	Undo2,
} from "lucide-react"

import type { MobileSettingsFeedbackCategoryOption } from "./feedbackShared"

/** Build feedback category options with lucide icons aligned to the mobile feedback picker prototype. */
export function useMobileSettingsFeedbackCategories(): MobileSettingsFeedbackCategoryOption[] {
	const { t } = useTranslation("super")

	return useMemo(
		() => [
			{
				id: "functionUsageFeedback",
				submitValue: "功能使用反馈",
				Icon: Sparkles,
				iconClassName: "text-foreground",
				iconBoxClassName: "bg-muted",
				label: t("onlineFeedback.functionUsageFeedback"),
			},
			{
				id: "paidPackageRelated",
				submitValue: "付费套餐相关",
				Icon: Crown,
				iconClassName: "text-amber-600",
				iconBoxClassName: "bg-amber-50 dark:bg-amber-500/10",
				label: t("onlineFeedback.paidPackageRelated"),
			},
			{
				id: "creditRechargeRelated",
				submitValue: "积分充值/使用相关",
				Icon: Coins,
				iconClassName: "text-yellow-600",
				iconBoxClassName: "bg-yellow-50 dark:bg-yellow-500/10",
				label: t("onlineFeedback.creditRechargeRelated"),
			},
			{
				id: "creditDeductRelated",
				submitValue: "积分扣除问题",
				Icon: CircleMinus,
				iconClassName: "text-red-600",
				iconBoxClassName: "bg-red-50 dark:bg-red-500/10",
				label: t("onlineFeedback.creditDeductRelated"),
			},
			{
				id: "orderRelated",
				submitValue: "订单问题",
				Icon: Receipt,
				iconClassName: "text-indigo-600",
				iconBoxClassName: "bg-indigo-50 dark:bg-indigo-500/10",
				label: t("onlineFeedback.orderRelated"),
			},
			{
				id: "refundApplication",
				submitValue: "退款申请",
				Icon: Undo2,
				iconClassName: "text-red-600",
				iconBoxClassName: "bg-red-50 dark:bg-red-500/10",
				label: t("onlineFeedback.refundApplication"),
			},
			{
				id: "accountAndSecurity",
				submitValue: "账户与安全问题",
				Icon: ShieldCheck,
				iconClassName: "text-emerald-600",
				iconBoxClassName: "bg-emerald-50 dark:bg-emerald-500/10",
				label: t("onlineFeedback.accountAndSecurity"),
			},
			{
				id: "other",
				submitValue: "其他",
				Icon: MessageSquare,
				iconClassName: "text-muted-foreground",
				iconBoxClassName: "bg-muted",
				label: t("onlineFeedback.other"),
			},
		],
		[t],
	)
}
