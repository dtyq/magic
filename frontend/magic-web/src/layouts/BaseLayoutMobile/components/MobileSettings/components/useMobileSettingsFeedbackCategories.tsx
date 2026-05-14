import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import {
	BadgeHelp,
	CreditCard,
	Crown,
	MessageCircleMore,
	ShieldCheck,
	Sparkles,
	WalletCards,
	WalletMinimal,
} from "lucide-react"

import type { MobileSettingsFeedbackCategoryOption } from "./feedbackShared"

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
				Icon: WalletCards,
				iconClassName: "text-yellow-600",
				iconBoxClassName: "bg-yellow-50 dark:bg-yellow-500/10",
				label: t("onlineFeedback.creditRechargeRelated"),
			},
			{
				id: "creditDeductRelated",
				submitValue: "积分扣除问题",
				Icon: WalletMinimal,
				iconClassName: "text-orange-600",
				iconBoxClassName: "bg-orange-50 dark:bg-orange-500/10",
				label: t("onlineFeedback.creditDeductRelated"),
			},
			{
				id: "orderRelated",
				submitValue: "订单问题",
				Icon: CreditCard,
				iconClassName: "text-indigo-600",
				iconBoxClassName: "bg-indigo-50 dark:bg-indigo-500/10",
				label: t("onlineFeedback.orderRelated"),
			},
			{
				id: "refundApplication",
				submitValue: "退款申请",
				Icon: BadgeHelp,
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
				Icon: MessageCircleMore,
				iconClassName: "text-muted-foreground",
				iconBoxClassName: "bg-muted",
				label: t("onlineFeedback.other"),
			},
		],
		[t],
	)
}
