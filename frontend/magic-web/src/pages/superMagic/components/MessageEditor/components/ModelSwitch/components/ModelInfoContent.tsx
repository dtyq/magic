import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import type { ModelItem } from "../types"
import { hasBillingMultiplier, ModelBillingMultiplier } from "./ModelBillingMultiplier"

export function formatContextWindow(value?: number | null) {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 ? 1 : 0)}M`
	if (value >= 1_000) return `${Math.round(value / 1_000)}K`
	return String(value)
}

/** 模型介绍里是否有除名称之外的内容可展示。 */
export function hasModelInfo(model: ModelItem, description = model.model_description) {
	return (
		!!description ||
		formatContextWindow(model.max_context_tokens) !== null ||
		hasBillingMultiplier(model.billing_multiplier)
	)
}

interface ModelInfoContentProps {
	model: ModelItem
	description?: string
	/** card：桌面悬停卡的紧凑字号；sheet：移动端底部弹层，字号和间距放大一档。 */
	size?: "card" | "sheet"
}

/** 模型介绍正文：名称、描述、上下文窗口、消耗倍率。桌面悬停卡和移动端弹层共用。 */
export function ModelInfoContent({
	model,
	description = model.model_description,
	size = "card",
}: ModelInfoContentProps) {
	const { t } = useTranslation("super")
	const contextWindow = formatContextWindow(model.max_context_tokens)
	const showMultiplier = hasBillingMultiplier(model.billing_multiplier)
	const isSheet = size === "sheet"

	return (
		<div className={cn(isSheet ? "text-sm" : "text-xs")} data-testid="model-info-content">
			<div className={cn(isSheet ? "px-5 pb-3 pt-4" : "px-3.5 pb-3 pt-3.5")}>
				<div
					className={cn(
						"break-words font-medium text-foreground",
						isSheet ? "text-base leading-6" : "text-sm leading-5",
					)}
				>
					{model.model_name || model.model_id}
				</div>
				{description ? (
					<p
						className={cn(
							"break-words text-muted-foreground",
							isSheet ? "mt-1.5 leading-6" : "mt-1 leading-5",
						)}
					>
						{description}
					</p>
				) : null}
			</div>
			{contextWindow || showMultiplier ? (
				<dl
					className={cn(
						"flex flex-col border-t border-border/70",
						isSheet ? "gap-3 px-5 py-4" : "gap-2 px-3.5 py-3",
					)}
				>
					{contextWindow ? (
						<div className="flex items-center justify-between gap-3">
							<dt className="text-muted-foreground">
								{t("messageEditor.modelSwitch.contextWindow")}
							</dt>
							<dd className="tabular-nums text-foreground">{contextWindow}</dd>
						</div>
					) : null}
					{showMultiplier ? (
						<div className="flex flex-col gap-0.5">
							<div className="flex items-center justify-between gap-3">
								<dt className="text-muted-foreground">
									{t("messageEditor.modelSwitch.billingMultiplier")}
								</dt>
								<dd>
									<ModelBillingMultiplier
										value={model.billing_multiplier}
										className={cn(
											"text-foreground",
											isSheet ? "text-sm" : "text-xs",
										)}
									/>
								</dd>
							</div>
							<p
								className={cn(
									"text-muted-foreground/80",
									isSheet ? "text-xs leading-5" : "leading-4",
								)}
							>
								{t("messageEditor.modelSwitch.billingMultiplierHint")}
							</p>
						</div>
					) : null}
				</dl>
			) : null}
		</div>
	)
}
