import { ChevronRight, Coins } from "lucide-react"

import dayjs from "@/lib/dayjs"
import { cn } from "@/lib/utils"

import type { PointsRecordItem } from "../types"

/** 单条积分记录拆成独立展示组件，避免分组列表在 map 中混入过多模板结构。 */
export function MobileSettingsPointsRecordRow(props: {
	item: PointsRecordItem
	timezone: string
	showDivider: boolean
	onClick: () => void
}) {
	const { item, timezone, showDivider, onClick } = props
	const isPositive = item.amount >= 0
	const formattedTime = dayjs(item.createdAt).isValid()
		? dayjs(item.createdAt).tz(timezone).format("MM-DD HH:mm")
		: "--"

	return (
		<>
			<button
				type="button"
				onClick={onClick}
				className="flex w-full items-start gap-3 px-[14px] py-[10px] text-left transition-opacity active:opacity-60"
			>
				<div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
					<Coins className="h-5 w-5" />
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<div className="truncate text-[15px] font-medium leading-5 text-foreground">
						{item.label}
					</div>
					{item.description ? (
						<div className="truncate text-[12px] leading-4 text-muted-foreground">
							{item.description}
						</div>
					) : null}
					<div className="text-[12px] leading-4 text-muted-foreground">
						{formattedTime}
					</div>
				</div>
				<div className="flex shrink-0 flex-col items-end gap-0.5 pt-0.5">
					<div
						className={cn(
							"text-[15px] font-medium tabular-nums leading-5",
							isPositive
								? "text-emerald-600 dark:text-emerald-400"
								: "text-foreground",
						)}
					>
						{isPositive ? "+" : ""}
						{new Intl.NumberFormat().format(item.amount)}
					</div>
					<ChevronRight className="h-4 w-4 text-muted-foreground/70" />
				</div>
			</button>
			{showDivider ? <div className="ml-[14px] h-px w-full bg-border" /> : null}
		</>
	)
}
