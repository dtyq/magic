import { useRef } from "react"
import { cn } from "@/utils/cn"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import type { MessageEditorSize } from "../../types"
import { observer } from "mobx-react-lite"
import type { ContextInputBreakdown } from "@/pages/superMagic/stores/types"
import ContextUsageDetails from "./ContextUsageDetails"

/** Max token context window size */
const MAX_TOKEN_COUNT = 200_000

/** Threshold (percentage) above which the warning is shown */
const WARNING_THRESHOLD = 0.7
const RING_STROKE_WIDTH = 1.5

/** Size-aware trigger styles, aligned with other top-bar buttons */
const TRIGGER_STYLE_MAP: Record<
	MessageEditorSize,
	{ padding: string; gap: string; text: string; ring: number }
> = {
	small: {
		padding: "p-[3px]",
		gap: "gap-0.5",
		text: "text-[10px] leading-[14px]",
		ring: 12,
	},
	default: {
		padding: "p-1",
		gap: "gap-1",
		text: "text-[10px] leading-[14px]",
		ring: 14,
	},
	mobile: {
		padding: "p-1.5",
		gap: "gap-1",
		text: "text-xs leading-4",
		ring: 16,
	},
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
			data-testid="token-usage-button-svg"
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
	inputBreakdown?: ContextInputBreakdown
	tokenUsed: number
	/** Max context window token count; falls back to built-in default when not provided */
	maxContextTokens?: number
	/** 后端已解析的自动整理阈值；缺少时不在前端推导。 */
	compactionThresholdTokens?: number
	/** Ring diameter in px; overrides size-derived default when provided */
	iconSize?: number
	size?: MessageEditorSize
	className?: string
	/** Called when the user clicks "Compress Context" */
	onCompressContext?: () => void
}

/** Token usage indicator button with popover detail panel */
function TokenUsageButton({
	tokenUsed,
	inputBreakdown,
	maxContextTokens,
	compactionThresholdTokens,
	iconSize,
	size = "default",
	className,
	onCompressContext,
}: TokenUsageButtonProps) {
	const compressButtonRef = useRef<HTMLButtonElement>(null)

	const effectiveMaxTokens = maxContextTokens ?? MAX_TOKEN_COUNT
	const ratio = Math.min(Math.max(tokenUsed / effectiveMaxTokens, 0), 1)
	const isHighUsage = ratio >= WARNING_THRESHOLD
	const percentageLabel = formatPercentage(ratio)
	const threshold =
		compactionThresholdTokens !== undefined &&
		Number.isFinite(compactionThresholdTokens) &&
		compactionThresholdTokens > 0
			? compactionThresholdTokens
			: undefined

	const triggerStyle = TRIGGER_STYLE_MAP[size]
	const ringSize = iconSize ?? triggerStyle.ring

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex cursor-pointer items-center rounded-md border border-border bg-background transition-all",
						"hover:bg-fill active:bg-fill-secondary",
						"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
						triggerStyle.padding,
						triggerStyle.gap,
						className,
					)}
					data-testid="token-usage-button"
				>
					<span className={cn("text-foreground", triggerStyle.text)}>
						{percentageLabel}
					</span>
					<TokenUsageRing ratio={ratio} size={ringSize} isHighUsage={isHighUsage} />
				</button>
			</PopoverTrigger>

			<PopoverContent
				className="w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[20px] p-0"
				align="end"
				side="top"
				sideOffset={8}
				onOpenAutoFocus={(event) => {
					// 保持原来聚焦手动操作的行为，避免新增问号在浮层打开时自动弹出简介遮挡正文。
					event.preventDefault()
					compressButtonRef.current?.focus()
				}}
			>
				<ContextUsageDetails
					tokenUsed={tokenUsed}
					maxTokens={effectiveMaxTokens}
					ratio={ratio}
					percentage={percentageLabel}
					threshold={threshold}
					inputBreakdown={inputBreakdown}
					isHighUsage={isHighUsage}
					compressButtonRef={compressButtonRef}
					onCompressContext={onCompressContext}
				/>
			</PopoverContent>
		</Popover>
	)
}

export default observer(TokenUsageButton)
