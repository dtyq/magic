import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"

/** 只有明确下发的非负有限倍率才算有效；零倍率有效，缺失值不显示占位数字。 */
export function hasBillingMultiplier(value?: number | null): value is number {
	return typeof value === "number" && Number.isFinite(value) && value >= 0
}

export function ModelBillingMultiplier({
	value,
	className,
}: {
	value?: number | null
	className?: string
}) {
	const { t } = useTranslation("super")
	if (!hasBillingMultiplier(value)) return null
	const display = value > 0 && value < 0.01 ? "<0.01" : value.toFixed(2)
	return (
		<span
			className={cn(
				"shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground",
				className,
			)}
			aria-label={t("messageEditor.modelSwitch.billingMultiplierValue", { value: display })}
		>
			{/* 用乘号而不是字母 x，与数字同一文本节点，便于复制和测试匹配。 */}
			{display}×
		</span>
	)
}
