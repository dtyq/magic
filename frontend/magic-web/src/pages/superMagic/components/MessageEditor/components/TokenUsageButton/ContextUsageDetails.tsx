import { Sparkles, TriangleAlert, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { RefObject } from "react"
import MagicTooltip from "@/components/base/MagicTooltip"
import { Button } from "@/components/shadcn-ui/button"
import { Close as PopoverClose } from "@radix-ui/react-popover"
import type { ContextInputBreakdown } from "@/pages/superMagic/stores/types"
import ContextUsageHelp from "./ContextUsageHelp"
import { useContextUsageCategories } from "./context-usage-categories"
import { formatTokenCount } from "./utils"

interface ContextUsageDetailsProps {
	tokenUsed: number
	maxTokens: number
	ratio: number
	percentage: string
	threshold?: number
	inputBreakdown?: ContextInputBreakdown
	isHighUsage: boolean
	compressButtonRef: RefObject<HTMLButtonElement>
	onCompressContext?: () => void
}

function formatInputTokens(count: number): string {
	return count >= 1_000 && count < 1_000_000
		? `${Math.round(count / 100) / 10}K`
		: formatTokenCount(count)
}

export default function ContextUsageDetails({
	tokenUsed,
	maxTokens,
	ratio,
	percentage,
	threshold,
	inputBreakdown,
	isHighUsage,
	compressButtonRef,
	onCompressContext,
}: ContextUsageDetailsProps) {
	const { t } = useTranslation("super")
	const categories = useContextUsageCategories().map((category) => ({
		...category,
		tokens: inputBreakdown?.[category.field] ?? 0,
	}))
	const total = categories.reduce((sum, category) => sum + category.tokens, 0)
	const hasBreakdown =
		inputBreakdown?.source === "text_estimate" &&
		categories.every(({ tokens }) => Number.isFinite(tokens) && tokens >= 0)
	return (
		<>
			<div className="px-[22px] pb-4 pt-[18px]">
				<div className="flex items-center gap-1 text-foreground">
					<span className="flex-1 text-sm font-medium">
						{t("ui.tokenUsage.contextUsage")}
					</span>
					<ContextUsageHelp />
					<MagicTooltip title={t("ui.tokenUsage.closeCard")}>
						<PopoverClose asChild>
							<Button
								variant="ghost"
								size="icon"
								className="size-7"
								aria-label={t("ui.tokenUsage.closeCard")}
							>
								<X size={16} aria-hidden />
							</Button>
						</PopoverClose>
					</MagicTooltip>
				</div>
				<div className="mb-1.5 mt-3 text-4xl font-semibold tabular-nums tracking-tight">
					{percentage}
				</div>
				<p className="text-xs tabular-nums text-muted-foreground">
					{t("ui.tokenUsage.tokenCount", {
						used: formatTokenCount(tokenUsed),
						max: formatTokenCount(maxTokens),
					})}
				</p>
				<div className="relative mb-2 mt-[18px]">
					<div
						className="flex h-2 overflow-hidden rounded-full bg-muted"
						role="meter"
						aria-label={t("ui.tokenUsage.contextUsage")}
						aria-valuemin={0}
						aria-valuemax={maxTokens}
						aria-valuenow={Math.min(Math.max(tokenUsed, 0), maxTokens)}
					>
						{hasBreakdown && total > 0 ? (
							categories.map(
								({ field, tokens, color }) =>
									tokens > 0 && (
										<span
											key={field}
											className="shrink-0"
											style={{
												width: `${(ratio * 100 * tokens) / total}%`,
												background: color,
											}}
										/>
									),
							)
						) : (
							<span
								className="shrink-0 bg-foreground"
								style={{ width: `${ratio * 100}%` }}
							/>
						)}
					</div>
					{threshold !== undefined && threshold <= maxTokens && (
						<span
							className="absolute top-[-3px] h-3.5 w-0.5 rounded bg-foreground/45"
							style={{ left: `${(threshold / maxTokens) * 100}%` }}
							aria-hidden
						/>
					)}
				</div>
				<div className="flex justify-between gap-3 text-[10px] text-muted-foreground">
					<span>{t("ui.tokenUsage.currentUsage")}</span>
					<span>
						{threshold !== undefined
							? t("ui.tokenUsage.thresholdMarker", {
									threshold: formatTokenCount(threshold),
								})
							: t("ui.tokenUsage.automatic")}
					</span>
				</div>
				{hasBreakdown && (
					<div className="mt-4">
						<div className="mb-3 flex justify-between gap-2 text-[10px] text-muted-foreground">
							<span>{t("ui.tokenUsage.breakdownTitle")}</span>
							<span>
								{t("ui.tokenUsage.approximate", {
									count: formatInputTokens(total),
								})}
							</span>
						</div>
						<div className="grid grid-cols-2 gap-x-6 gap-y-3">
							{categories.map(({ field, label, tokens, color }) => (
								<div
									key={field}
									className="flex min-w-0 items-center gap-1.5 text-xs"
								>
									<span
										className="size-[7px] shrink-0 rounded-full"
										style={{ background: color }}
										aria-hidden
									/>
									<span>{label}</span>
									<span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
										≈{formatInputTokens(tokens)}
									</span>
								</div>
							))}
						</div>
						<p className="mt-2.5 text-[10px] leading-relaxed text-muted-foreground">
							{t("ui.tokenUsage.breakdownNote")}
							{inputBreakdown?.partial_attribution &&
								` ${t("ui.tokenUsage.mixedNote")}`}
							{inputBreakdown?.contains_non_text_content &&
								` ${t("ui.tokenUsage.nonTextNote")}`}
						</p>
					</div>
				)}
			</div>
			<div className="border-t bg-muted/25 px-[22px] pb-5 pt-4">
				<div className="flex items-center gap-1.5 text-xs font-medium">
					<Sparkles
						size={16}
						className="text-emerald-600 dark:text-emerald-400"
						aria-hidden
					/>
					<span>{t("ui.tokenUsage.automatic")}</span>
					<span className="ml-auto text-[10px] font-normal text-muted-foreground">
						{t("ui.tokenUsage.noActionNeeded")}
					</span>
				</div>
				<p className="mb-3 mt-1.5 text-xs leading-relaxed text-muted-foreground">
					{t("ui.tokenUsage.contextUsageDescription")}
				</p>
				{isHighUsage && (
					<p className="mb-3 flex gap-1.5 text-xs leading-relaxed text-orange-600 dark:text-orange-400">
						<TriangleAlert size={16} className="shrink-0" aria-hidden />
						{t("ui.tokenUsage.highContextWarning")}
					</p>
				)}
				<div className="flex items-center justify-between gap-3">
					<span className="text-[10px] text-muted-foreground">
						{t("ui.tokenUsage.manualNote")}
					</span>
					<Button
						ref={compressButtonRef}
						variant="outline"
						size="sm"
						onClick={onCompressContext}
					>
						{t("ui.tokenUsage.compressContext")}
					</Button>
				</div>
			</div>
		</>
	)
}
