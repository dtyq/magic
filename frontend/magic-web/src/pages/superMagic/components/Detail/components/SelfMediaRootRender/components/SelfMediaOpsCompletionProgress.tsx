import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import type { SelfMediaOpsOverview } from "../services/selfMediaOpsOverview"

const PROGRESS_ANIMATION_MS = 620

const completionItemKeys: Array<{
	key: keyof SelfMediaOpsOverview["completion"]
	labelKey:
		| "selfMedia.opsPublished"
		| "selfMedia.opsSynced"
		| "selfMedia.opsCommentsHandled"
		| "selfMedia.opsReviewDone"
	tone: string
}> = [
	{ key: "source", labelKey: "selfMedia.opsPublished", tone: "bg-[#ff776c]" },
	{ key: "metrics", labelKey: "selfMedia.opsSynced", tone: "bg-[#ffd637]" },
	{ key: "comments", labelKey: "selfMedia.opsCommentsHandled", tone: "bg-[#59b981]" },
	{ key: "review", labelKey: "selfMedia.opsReviewDone", tone: "bg-[#18181b]" },
]

interface SelfMediaOpsCompletionProgressProps {
	completion: SelfMediaOpsOverview["completion"]
	dense?: boolean
}

function SelfMediaOpsCompletionProgress({
	completion,
	dense = false,
}: SelfMediaOpsCompletionProgressProps) {
	const { t } = useTranslation("super")
	const completed = completionItemKeys.every((item) => {
		const value = completion[item.key]
		return value.done >= value.total
	})
	if (completed) return null

	return (
		<div
			className={cn(
				"rounded-[22px] border border-white/65 bg-white/45 shadow-[inset_0_1px_rgba(255,255,255,0.72),0_14px_38px_rgba(47,43,36,0.06)] backdrop-blur",
				dense ? "p-3" : "p-4",
			)}
			data-testid="self-media-home-ops-completion"
		>
			<div
				className={cn("flex items-center justify-between gap-3", dense ? "mb-2.5" : "mb-4")}
			>
				<span className="text-[13px] font-[800] text-[#18181b]">
					{t("selfMedia.opsProgressTitle")}
				</span>
				<span className="text-[11px] font-[680] text-[#71717a]">
					{t("selfMedia.opsProgressHint")}
				</span>
			</div>
			<div className={cn(dense ? "grid grid-cols-2 gap-x-4 gap-y-2" : "space-y-3")}>
				{completionItemKeys.map((item) => {
					const value = completion[item.key]
					return (
						<CompletionProgressRow
							key={item.key}
							item={{ ...item, label: t(item.labelKey) }}
							done={value.done}
							total={value.total}
							dense={dense}
						/>
					)
				})}
			</div>
		</div>
	)
}

function CompletionProgressRow({
	item,
	done,
	total,
	dense,
}: {
	item: {
		key: keyof SelfMediaOpsOverview["completion"]
		label: string
		tone: string
	}
	done: number
	total: number
	dense: boolean
}) {
	const progress = total > 0 ? Math.round((done / total) * 100) : 0
	const animatedProgress = useAnimatedProgressValue(progress)

	return (
		<div
			className={cn(
				"grid items-center font-[600] text-[#52525b]",
				dense
					? "grid-cols-[5rem_minmax(0,1fr)_2.5rem] gap-2 text-[11px]"
					: "grid-cols-[5rem_minmax(0,1fr)_3.5rem] gap-3 text-[12px]",
			)}
		>
			<span className="flex items-center gap-2">
				<i className={cn("rounded-full", dense ? "h-1.5 w-4" : "h-2 w-5", item.tone)} />
				<span>{item.label}</span>
			</span>
			<div
				className={cn("overflow-hidden rounded-full bg-white/70", dense ? "h-1.5" : "h-2")}
			>
				<div
					className={cn("h-full rounded-full", item.tone)}
					style={{ width: `${Math.round(animatedProgress)}%` }}
					data-testid={`self-media-home-ops-progress-${item.key}`}
				/>
			</div>
			<span className="text-right text-[#18181b]">
				{done}/{total}
			</span>
		</div>
	)
}

function useAnimatedProgressValue(target: number) {
	const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0))

	useEffect(() => {
		if (prefersReducedMotion() || target === 0) {
			setValue(target)
			return undefined
		}

		setValue(0)
		const startedAt = Date.now()
		const timer = window.setInterval(() => {
			const elapsed = Date.now() - startedAt
			const progress = Math.min(1, Math.max(0, elapsed / PROGRESS_ANIMATION_MS))
			setValue(target * (1 - Math.pow(1 - progress, 3)))
			if (progress >= 1) window.clearInterval(timer)
		}, 16)

		return () => window.clearInterval(timer)
	}, [target])

	return value
}

function prefersReducedMotion() {
	return (
		typeof window !== "undefined" &&
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	)
}

export default SelfMediaOpsCompletionProgress
