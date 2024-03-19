import { TriangleAlert } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/opensource/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/opensource/components/shadcn-ui/popover"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Separator } from "@/opensource/components/shadcn-ui/separator"
import type { MessageEditorSize } from "../../types"
import { observer } from "mobx-react-lite"

/** Max token context window size */
const MAX_TOKEN_COUNT = 200_000

/** Threshold (percentage) above which the warning is shown */
const WARNING_THRESHOLD = 0.7
const RING_STROKE_WIDTH = 1.5

function formatTokenCount(count: number): string {
	if (count >= 1_000) return `${Math.round(count / 1_000)}K`
	return String(count)
}

function formatPercentage(ratio: number): string {
	const pct = ratio * 100
	// Show one decimal place only when < 10%
	return pct < 10 ? `${pct.toFixed(1)}%` : `${Math.round(pct)}%`
}

interface TokenUsageRingProps {
	ratio: number
	size: number
	isHighUsage: boolean
}

function TokenUsageRing({ ratio, size, isHighUsage }: TokenUsageRingProps) {
	const normalizedSize = Math.max(size, RING_STROKE_WIDTH * 2 + 2)
	const center = normalizedSize / 2
	const radius = (normalizedSize - RING_STROKE_WIDTH) / 2
	const circumference = 2 * Math.PI * radius
	const dashOffset = circumference * (1 - ratio)

	return (
		<svg
			width={normalizedSize}
			height={normalizedSize}
			viewBox={`0 0 ${normalizedSize} ${normalizedSize}`}
			className="shrink-0"
			aria-hidden="true"
		>
			<circle
				cx={center}
				cy={center}
				r={radius}
				fill="none"
				strokeWidth={RING_STROKE_WIDTH}
				className="stroke-border/80"
			/>
			<circle
				cx={center}
				cy={center}
				r={radius}
				fill="none"
				strokeWidth={RING_STROKE_WIDTH}
				strokeLinecap="round"
				strokeDasharray={circumference}
				strokeDashoffset={dashOffset}
				transform={`rotate(-90 ${center} ${center})`}
				className={cn(
					"stroke-foreground transition-[stroke-dashoffset] duration-200 ease-out",
					isHighUsage && "stroke-orange-500",
				)}
			/>
		</svg>
	)
}

interface TokenUsageButtonProps {
	tokenUsed: number
	iconSize?: number
	size?: MessageEditorSize
	className?: string
	/** Called when the user clicks "Compress Context" */
	onCompressContext?: () => void
}

/** Token usage indicator button with popover detail panel */
function TokenUsageButton({
	tokenUsed,
	iconSize = 14,
	size = "default",
	className,
	onCompressContext,
}: TokenUsageButtonProps) {
	const { t } = useTranslation("super")

	const ratio = Math.min(tokenUsed / MAX_TOKEN_COUNT, 1)
	const isHighUsage = ratio >= WARNING_THRESHOLD
	const percentageLabel = formatPercentage(ratio)
	const usedLabel = formatTokenCount(tokenUsed)
	const maxLabel = formatTokenCount(MAX_TOKEN_COUNT)

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex cursor-pointer items-center rounded-md border border-border bg-background transition-all",
						size === "small" ? "gap-0.5" : "gap-1",
						"hover:bg-fill active:bg-fill-secondary",
						"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
						// getButtonPaddingClass(size),
						"p-1",
						className,
					)}
					data-testid="token-usage-button"
				>
					<span className="text-[10px] leading-[12px] text-foreground">
						{percentageLabel}
					</span>
					<TokenUsageRing ratio={ratio} size={iconSize} isHighUsage={isHighUsage} />
				</button>
			</PopoverTrigger>

			<PopoverContent
				className="w-[240px] overflow-hidden p-0"
				align="end"
				side="top"
				sideOffset={8}
			>
				{/* Usage section */}
				<div className="flex flex-col gap-1.5 p-2">
					{/* Header row */}
					<div className="flex items-center gap-1.5 text-xs leading-4 text-foreground">
						<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-normal">
							{t("ui.tokenUsage.contextUsage")}
						</span>
						<span className="shrink-0 font-semibold">{percentageLabel}</span>
					</div>

					{/* Progress bar */}
					<div className="relative h-2 w-full overflow-hidden rounded-full bg-fill-secondary">
						<div
							className={cn(
								"absolute left-0 top-0 h-full rounded-full transition-all",
								isHighUsage ? "bg-orange-500" : "bg-foreground",
							)}
							style={{ width: `${ratio * 100}%` }}
						/>
					</div>

					{/* Token count label */}
					<span className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-4 text-muted-foreground">
						{t("ui.tokenUsage.tokenCount", {
							used: usedLabel,
							max: maxLabel,
						})}
					</span>
				</div>

				{/* Warning section — only shown when usage >= 70% */}
				{isHighUsage && (
					<>
						<Separator />
						<div className="flex flex-col gap-1.5 p-2">
							{/* Warning message */}
							<div className="flex items-start gap-1 rounded-md bg-orange-500/10 p-1 dark:bg-orange-500/20">
								<TriangleAlert
									size={16}
									className="mt-0.5 shrink-0 text-orange-500 dark:text-orange-400"
								/>
								<p className="flex-1 whitespace-pre-wrap text-xs leading-4 text-orange-500 dark:text-orange-400">
									{t("ui.tokenUsage.highContextWarning")}
								</p>
							</div>

							{/* Compress context button */}
							<Button
								size="sm"
								className="h-8 w-full text-xs"
								onClick={onCompressContext}
							>
								{t("ui.tokenUsage.compressContext")}
							</Button>
						</div>
					</>
				)}
			</PopoverContent>
		</Popover>
	)
}

export default observer(TokenUsageButton)
