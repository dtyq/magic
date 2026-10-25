import { useTranslation } from "react-i18next"

/** 右侧金额为只读结果，明确区分编辑预览与后端已保存数据。 */
export function MultiplierReferencePreview({
	amount,
	editing,
}: {
	amount: string | null
	editing: boolean
}) {
	const { t } = useTranslation()
	return (
		<aside
			className="min-w-0 rounded-lg border bg-muted/20 p-5"
			aria-label={t("platformInfo.multiplier.referenceAmount")}
		>
			<h4 className="text-sm font-medium">{t("platformInfo.multiplier.referenceAmount")}</h4>
			<div className="mt-2 flex flex-wrap items-baseline gap-2">
				<output
					data-testid="multiplier-reference-amount"
					className="break-all text-2xl font-semibold tabular-nums"
					aria-live="polite"
				>
					{amount ?? t("common.emptyValue")}
				</output>
				<span className="text-xs text-muted-foreground">
					{t("platformInfo.multiplier.cny")}
				</span>
			</div>
			<div className="mt-5 space-y-2 border-t pt-4">
				<h4 className="text-sm font-medium">
					{t("platformInfo.multiplier.referenceTitle")}
				</h4>
				<div className="flex flex-wrap justify-between gap-2 text-sm">
					<span>{t("platformInfo.multiplier.inputUsage")}</span>
					<span>10,000 token</span>
				</div>
				<div className="flex flex-wrap justify-between gap-2 text-sm">
					<span>{t("platformInfo.multiplier.outputUsage")}</span>
					<span>1,000 token</span>
				</div>
				<p className="text-xs text-muted-foreground">
					{t("platformInfo.multiplier.noCache")}
				</p>
			</div>
			<p className="mt-4 border-t pt-4 text-sm leading-6 text-muted-foreground">
				{t("platformInfo.multiplier.shortFormula")}
			</p>
			{editing ? (
				<p className="mt-3 text-xs leading-5 text-muted-foreground">
					{t("platformInfo.multiplier.previewHint")}
				</p>
			) : null}
		</aside>
	)
}

/** 规则始终展开，预览和编辑使用同一份说明。 */
export function MultiplierReferenceRules() {
	const { t } = useTranslation()
	const rules = [
		[
			t("platformInfo.multiplier.usageRuleTitle"),
			t("platformInfo.multiplier.usageRuleDescription"),
		],
		[
			t("platformInfo.multiplier.averageRuleTitle"),
			t("platformInfo.multiplier.calculationSteps"),
		],
		[
			t("platformInfo.multiplier.missingPriceTitle"),
			t("platformInfo.multiplier.missingPriceDescription"),
		],
		[
			t("platformInfo.multiplier.priceScopeTitle"),
			t("platformInfo.multiplier.priceScopeDescription"),
		],
		[
			t("platformInfo.multiplier.dynamicModelTitle"),
			t("platformInfo.multiplier.dynamicModelDescription"),
		],
		[
			t("platformInfo.multiplier.refreshTitle"),
			t("platformInfo.multiplier.refreshDescription"),
		],
	]
	return (
		<section
			className="rounded-lg border bg-muted/20 p-5"
			data-testid="model-multiplier-explanation"
			aria-label={t("platformInfo.multiplier.rulesTitle")}
		>
			<h4 className="text-sm font-medium">{t("platformInfo.multiplier.rulesTitle")}</h4>
			<dl className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
				{rules.map(([title, description]) => (
					<div key={title}>
						<dt className="text-sm font-medium">{title}</dt>
						<dd className="mt-1 text-sm leading-6 text-muted-foreground">
							{description}
						</dd>
					</div>
				))}
			</dl>
		</section>
	)
}
