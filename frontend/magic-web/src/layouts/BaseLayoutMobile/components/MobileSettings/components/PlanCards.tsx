import { ChevronRight, Sparkles } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"

import dayjs from "@/lib/dayjs"
import { userStore } from "@/models/user"

/** Format subscription end_date for plan card subtitle (prototype: YYYY-MM-DD only). */
function formatPlanCardRenewalDate(endDate?: string): string | undefined {
	if (!endDate) return undefined

	const parsed = dayjs(endDate)
	if (!parsed.isValid()) return undefined

	return parsed.format("YYYY-MM-DD")
}

/** 免费版卡片按原型保留"升级能力"视觉，突出单一 CTA。 */
export const MobileSettingsFreePlanCard = observer(function MobileSettingsFreePlanCard(props: {
	onUpgrade: () => void
}) {
	const { onUpgrade } = props
	const { t } = useTranslation("interface")
	const { isAdmin, isPersonalOrganization } = userStore.user
	const canOperate = isAdmin || isPersonalOrganization

	return (
		<div className="relative my-1 w-full rounded-xl border border-primary/20 bg-card px-4 py-3.5 text-left shadow-sm ring-1 ring-primary/10">
			<Sparkles className="absolute right-5 top-5 h-5 w-5 text-foreground/70" />
			<div className="pr-10">
				<div className="text-sm font-semibold leading-5 text-foreground">
					{t("setting.planCard.freeTitle")}
				</div>
				<div className="mt-1.5 text-sm leading-5 text-muted-foreground">
					{t("setting.planCard.freeDescription")}
				</div>
			</div>
			{canOperate && (
				<button
					type="button"
					onClick={onUpgrade}
					className="mt-3 flex h-9 w-full items-center justify-center rounded-full bg-foreground text-sm font-medium text-background transition-opacity active:opacity-90"
				>
					{t("setting.planCard.upgradeNow")}
				</button>
			)}
		</div>
	)
})

/** 付费版卡片展示当前套餐与续费信息，样式对齐原型的深色订阅卡。 */
export const MobileSettingsPaidPlanCard = observer(function MobileSettingsPaidPlanCard(props: {
	onUpgrade: () => void
}) {
	const { onUpgrade } = props
	const { t } = useTranslation("interface")
	const subscriptionInfo = userStore.user.organizationSubscriptionInfo
	const { isAdmin, isPersonalOrganization } = userStore.user
	const canOperate = isAdmin || isPersonalOrganization
	const planName = subscriptionInfo?.name || t("bonusPointsModal.personalVersion")
	const renewalDate = formatPlanCardRenewalDate(subscriptionInfo?.end_date)

	return (
		<div className="relative w-full overflow-hidden rounded-xl bg-zinc-950 px-4 py-3.5 text-left text-white shadow-lg shadow-black/10">
			{/* Background flowing lines: vectorEffect keeps stroke width under non-uniform scale;
			    stroke-dashoffset animation creates a particle-flow along each curve. */}
			<svg
				viewBox="0 0 400 160"
				preserveAspectRatio="none"
				className="pointer-events-none absolute inset-0 h-full w-full"
				fill="none"
				aria-hidden="true"
			>
				<path
					d="M -40,40 C 80,10 180,80 260,40 S 380,30 460,70"
					stroke="#ffffff"
					strokeOpacity={0.28}
					strokeWidth={1.25}
					strokeLinecap="round"
					strokeDasharray="1 6 2 8 4 10 7 12 12 16"
					vectorEffect="non-scaling-stroke"
					className="plan-card-line plan-card-line-1"
				/>
				<path
					d="M -40,90 C 90,140 180,60 280,110 S 380,140 460,100"
					stroke="#ffffff"
					strokeOpacity={0.22}
					strokeWidth={1.25}
					strokeLinecap="round"
					strokeDasharray="1 8 3 10 5 14 9 18"
					vectorEffect="non-scaling-stroke"
					className="plan-card-line plan-card-line-2"
				/>
				<path
					d="M -40,130 C 100,110 200,150 300,120 S 400,130 460,140"
					stroke="#ffffff"
					strokeOpacity={0.18}
					strokeWidth={1}
					strokeLinecap="round"
					strokeDasharray="1 5 2 7 4 9 8 14 14 20"
					vectorEffect="non-scaling-stroke"
					className="plan-card-line plan-card-line-3"
				/>
				<path
					d="M -40,20 C 120,60 220,0 320,50 S 400,20 460,30"
					stroke="#ffffff"
					strokeOpacity={0.16}
					strokeWidth={1}
					strokeLinecap="round"
					strokeDasharray="1 10 2 12 5 16 11 22"
					vectorEffect="non-scaling-stroke"
					className="plan-card-line plan-card-line-4"
				/>
			</svg>
			<div className="relative flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="truncate text-lg font-semibold leading-6 tracking-tight">
						{planName}
					</div>
					<div className="mt-0.5 text-xs leading-4 text-white/70">
						{t("setting.planCard.currentPlan")}
						{renewalDate
							? ` · ${t("setting.planCard.renewOn", { date: renewalDate })}`
							: ""}
					</div>
				</div>
				{canOperate && (
					<button
						type="button"
						onClick={onUpgrade}
						className="mt-0.5 flex shrink-0 items-center gap-1 text-sm font-medium transition-opacity active:opacity-90"
					>
						<span>{t("setting.planCard.manage")}</span>
						<ChevronRight className="h-4 w-4" />
					</button>
				)}
			</div>
		</div>
	)
})
