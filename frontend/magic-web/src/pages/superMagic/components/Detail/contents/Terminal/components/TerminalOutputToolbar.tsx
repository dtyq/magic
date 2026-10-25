import { ArrowDownToLine, ChevronDown, ChevronUp, Search, WrapText } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import { cn } from "@/utils/cn"

export type TerminalOutputToolbarVariant = "default" | "embedded"

interface TerminalOutputToolbarProps {
	variant?: TerminalOutputToolbarVariant
	query: string
	onQueryChange: (query: string) => void
	count: number
	index: number
	onFind: (direction: 1 | -1) => void
	wrap: boolean
	onWrapChange: () => void
	onScrollToEnd: () => void
}

export function TerminalOutputToolbar({
	variant = "default",
	query,
	onQueryChange,
	count,
	index,
	onFind,
	wrap,
	onWrapChange,
	onScrollToEnd,
}: TerminalOutputToolbarProps) {
	const { t } = useTranslation("super")
	const embedded = variant === "embedded"
	return (
		<div
			className={cn(
				"flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 font-normal text-foreground",
				embedded
					? "border-b border-border px-3 py-1.5 text-[13px]"
					: "border-t border-border px-4 py-2.5 text-sm",
			)}
		>
			{!embedded && <span className="shrink-0 font-medium">{t("terminal.output")}</span>}
			{/* 宽屏保留紧凑的搜索组；窄详情容器自然换行，不靠缩小文字容纳操作。 */}
			<div
				className={cn(
					"flex min-w-0 max-w-full flex-[0_1_368px] items-center gap-1",
					!embedded && "ml-auto",
				)}
			>
				<Search size={16} aria-hidden className="shrink-0 text-muted-foreground" />
				<Input
					value={query}
					onChange={(event) => onQueryChange(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.nativeEvent.isComposing) {
							event.preventDefault()
							onFind(event.shiftKey ? -1 : 1)
						}
					}}
					type="search"
					placeholder={t("terminal.searchOutput")}
					aria-label={t("terminal.searchOutput")}
					className={cn(
						"h-8 min-w-[80px] max-w-[280px] flex-1 px-2.5 py-1.5 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:text-base",
						embedded ? "text-[13px] md:text-[13px]" : "text-sm md:text-sm",
					)}
				/>
				{query && (
					<span
						className="shrink-0 whitespace-nowrap text-xs text-muted-foreground"
						role="status"
					>
						{count
							? t("terminal.searchMatches", { current: index + 1, count })
							: t("terminal.noMatches")}
					</span>
				)}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon-sm"
							className="size-8 shrink-0 [@media(pointer:coarse)]:size-11"
							aria-label={t("terminal.previousMatch")}
							disabled={!count}
							onClick={() => onFind(-1)}
						>
							<ChevronUp size={16} aria-hidden />
						</Button>
					</TooltipTrigger>
					<TooltipContent>{t("terminal.previousMatch")}</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon-sm"
							className="size-8 shrink-0 [@media(pointer:coarse)]:size-11"
							aria-label={t("terminal.nextMatch")}
							disabled={!count}
							onClick={() => onFind(1)}
						>
							<ChevronDown size={16} aria-hidden />
						</Button>
					</TooltipTrigger>
					<TooltipContent>{t("terminal.nextMatch")}</TooltipContent>
				</Tooltip>
			</div>
			<div className={cn("flex min-w-0 flex-wrap items-center gap-1", embedded && "ml-auto")}>
				<Button
					variant="ghost"
					size="sm"
					className={cn(
						"h-8 gap-1.5 px-2 font-normal aria-pressed:bg-muted aria-pressed:text-blue-600 dark:aria-pressed:text-blue-400 [@media(pointer:coarse)]:min-h-11",
						embedded ? "text-[13px]" : "text-sm",
					)}
					aria-pressed={wrap}
					onClick={onWrapChange}
				>
					<WrapText size={16} aria-hidden />
					{t("terminal.wrap")}
				</Button>
				<Button
					variant="ghost"
					size="sm"
					className={cn(
						"h-8 gap-1.5 px-2 font-normal [@media(pointer:coarse)]:min-h-11",
						embedded ? "text-[13px]" : "text-sm",
					)}
					onClick={onScrollToEnd}
				>
					<ArrowDownToLine size={16} aria-hidden />
					{t("terminal.scrollToEnd")}
				</Button>
			</div>
		</div>
	)
}
