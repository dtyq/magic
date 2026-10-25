import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"

import { MobileSettingsSheetContainer } from "./SheetContainer"
import { getMobileSettingsPointsOverview } from "../utils"

/** Render the prototype's circular quota indicator with a clamped percentage. */
function PersonalQuotaRing(props: { percent: number; centerLabel: string }) {
	const size = 168
	const strokeWidth = 13.5
	const center = size / 2
	const radius = center - strokeWidth / 2 - 3
	const circumference = 2 * Math.PI * radius
	const clampedPercent = Math.min(100, Math.max(0, props.percent))
	const dashLength = (clampedPercent / 100) * circumference

	return (
		<div className="relative mx-auto h-[168px] w-[168px] shrink-0">
			<svg width={size} height={size} className="block" aria-hidden="true">
				<circle
					cx={center}
					cy={center}
					r={radius}
					fill="none"
					strokeWidth={strokeWidth}
					className="stroke-border"
				/>
				<circle
					cx={center}
					cy={center}
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth={strokeWidth}
					strokeLinecap="round"
					strokeDasharray={`${dashLength} ${circumference}`}
					className="text-foreground"
					transform={`rotate(-90 ${center} ${center})`}
				/>
			</svg>
			<div className="pointer-events-none absolute inset-0 flex items-center justify-center px-2">
				<span className="text-center text-[30px] font-semibold tabular-nums leading-none tracking-tight text-foreground">
					{props.centerLabel}
				</span>
			</div>
		</div>
	)
}

/** Show a team member's personal quota using the prototype's ring-based sheet layout. */
export const MobileSettingsPersonalQuotaSheet = observer(
	function MobileSettingsPersonalQuotaSheet(props: { open: boolean; onClose: () => void }) {
		const { open, onClose } = props
		const { t } = useTranslation("interface")
		const quota = getMobileSettingsPointsOverview().personalQuota
		const numberFormatter = new Intl.NumberFormat()
		const safeUsed = quota ? Math.max(0, quota.used) : 0
		const safeTotal = quota ? Math.max(0, quota.total) : 0
		const rawPercent = safeTotal === 0 ? 0 : (safeUsed / safeTotal) * 100
		const percent = Math.min(100, Math.max(0, Math.round(rawPercent)))
		const usageFraction = quota
			? `${numberFormatter.format(safeUsed)}/${numberFormatter.format(safeTotal)}`
			: "--"

		return (
			<MobileSettingsSheetContainer
				open={open}
				title={t("setting.personalQuota")}
				sheetClassName="rounded-t-[14px] border-0 bg-muted p-0"
				contentClassName="gap-5 px-[14px] pb-[calc(var(--safe-area-inset-bottom)+1.25rem)] pt-2"
				onOpenChange={(nextOpen) => {
					if (!nextOpen) onClose()
				}}
				dataTestId="mobile-settings-personal-quota-sheet"
			>
				<div className="flex flex-col items-center gap-2">
					{quota ? (
						<PersonalQuotaRing percent={percent} centerLabel={`${percent}%`} />
					) : (
						<div className="flex h-[168px] w-[168px] items-center justify-center text-2xl text-muted-foreground">
							--
						</div>
					)}
					<p className="text-center text-[15px] font-medium tabular-nums leading-5 text-muted-foreground">
						{quota
							? t("setting.personalQuotaSheet.usageFraction", {
									used: numberFormatter.format(safeUsed),
									total: numberFormatter.format(safeTotal),
								})
							: usageFraction}
					</p>
				</div>
				<p className="px-1 text-center text-sm leading-5 text-muted-foreground">
					{quota?.total === 0
						? t("setting.personalQuotaZeroDescription")
						: t("setting.personalQuotaSheet.hint")}
				</p>
				<button
					type="button"
					onClick={onClose}
					className="h-12 w-full shrink-0 rounded-xl bg-primary text-base font-medium text-primary-foreground transition-opacity active:opacity-90"
				>
					{t("setting.personalQuotaSheet.cta")}
				</button>
			</MobileSettingsSheetContainer>
		)
	},
)
