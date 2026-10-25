import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import type {
	SelfMediaOpsMetricDrillDown,
	SelfMediaOpsMetricKey,
	SelfMediaOpsMetricMotionState,
} from "../services/selfMediaOpsOverviewPresentation"

interface SelfMediaOpsMetricFlipCardProps {
	metricKey: SelfMediaOpsMetricKey
	icon: ReactNode
	label: string
	value: string
	accent: string
	statusLabel: string
	motionState: SelfMediaOpsMetricMotionState
	testId: string
	detail: SelfMediaOpsMetricDrillDown
	flipped: boolean
	comfortable?: boolean
	onToggle: () => void
}

function SelfMediaOpsMetricFlipCard({
	metricKey,
	icon,
	label,
	value,
	accent,
	statusLabel,
	motionState,
	testId,
	detail,
	flipped,
	comfortable = false,
	onToggle,
}: SelfMediaOpsMetricFlipCardProps) {
	const { t } = useTranslation("super")
	return (
		<button
			type="button"
			aria-label={`${label}，点击查看${detail.title}`}
			aria-pressed={flipped}
			data-flipped={flipped ? "true" : "false"}
			data-motion={motionState}
			data-testid={testId}
			className={cn(
				"group/metric relative min-h-[136px] w-full min-w-0 max-w-full overflow-hidden rounded-[22px] text-left [perspective:900px] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#18181b]/15",
				comfortable && "min-h-[156px]",
				motionState === "active" && "self-media-ops-metric-flow",
			)}
			onClick={onToggle}
		>
			<div
				className={cn(
					"absolute inset-0 rounded-[22px] transition-transform duration-500 [transform-style:preserve-3d]",
					flipped ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]",
				)}
			>
				<div className="group-hover/metric:bg-white/78 absolute inset-0 overflow-hidden rounded-[22px] border border-white/70 bg-white/55 px-4 pb-5 pt-4 shadow-[inset_0_1px_rgba(255,255,255,0.8),0_12px_32px_rgba(47,43,36,0.06)] backdrop-blur transition-[border-color,box-shadow,transform,background] duration-300 [backface-visibility:hidden] group-hover/metric:-translate-y-0.5 group-hover/metric:border-[#ffd637]/70 group-hover/metric:shadow-[inset_0_1px_rgba(255,255,255,0.88),0_18px_42px_rgba(47,43,36,0.1)]">
					<div className="flex items-center gap-2 text-[12px] font-[650] text-[#71717a]">
						{icon}
						<span>{label}</span>
					</div>
					<div
						className={cn(
							"mt-3 truncate text-[28px] font-[820] leading-none",
							comfortable && "text-[34px]",
							accent,
						)}
					>
						{value}
					</div>
					<div className="self-media-ops-metric-line mt-3 h-1.5 overflow-hidden rounded-full bg-[#18181b]/10">
						<div className="h-full w-2/3 rounded-full bg-[#ffd637] transition-all duration-300 group-hover/metric:w-full" />
					</div>
					<div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-[680] leading-[1.2] text-[#71717a]">
						<span>{statusLabel}</span>
						<span className="text-[#18181b]">{t("selfMedia.opsViewBreakdown")}</span>
					</div>
				</div>
				<div
					className="absolute inset-0 flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#18181b]/10 bg-[#18181b] p-4 text-white shadow-[inset_0_1px_rgba(255,255,255,0.16),0_18px_42px_rgba(24,24,27,0.18)] [backface-visibility:hidden] [transform:rotateY(180deg)]"
					data-testid={`self-media-home-ops-metric-detail-${metricKey}`}
				>
					<div className="text-[13px] font-[820] text-[#ffd637]">{detail.title}</div>
					<div className="text-white/62 mt-1 line-clamp-2 text-[11px] font-[600] leading-[1.35]">
						{detail.subtitle}
					</div>
					<div className="mt-2 grid min-w-0 gap-2">
						{detail.rows.map((row) => (
							<div
								key={`${row.label}-${row.value}`}
								className="grid min-w-0 grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-3 text-[11px] leading-[1.35]"
							>
								<span className="min-w-0 truncate text-white/55">{row.label}</span>
								<span className="min-w-0 justify-self-end truncate text-right font-[760] text-white">
									{row.value}
								</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</button>
	)
}

export default SelfMediaOpsMetricFlipCard
