import { ChevronRight, Gift, MessageCircle } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"

import {
	formatPointsRecordAmount,
	getPointsRecordDirection,
	getPointsRecordListTime,
	getPointsRecordListTitle,
} from "../pointsRecordDisplay"
import type { PointsRecordItem } from "../types"

/** 列表行左内边距 + 图标 + 间距，供组内分割线起始位置与文案对齐。 */
const POINTS_RECORD_ROW_TEXT_OFFSET_CLASSNAME = "ml-[calc(14px+2.25rem+0.75rem)]"

const DIRECTION_ICON_CELL = {
	income: {
		box: "bg-icon-app-bookmarks/10",
		icon: "text-icon-app-bookmarks",
		Icon: Gift,
	},
	expense: {
		box: "bg-icon-chat/10",
		icon: "text-icon-chat",
		Icon: MessageCircle,
	},
} as const

/** 列表行装饰图标：按收入/支出区分配色，不改变老页字段语义。 */
function PointsRecordDirectionIcon(props: { amount: number }) {
	const direction = getPointsRecordDirection(props.amount)
	const cell = DIRECTION_ICON_CELL[direction]
	const Icon = cell.Icon

	return (
		<div
			className={cn(
				"flex size-9 shrink-0 items-center justify-center rounded-[10px]",
				cell.box,
			)}
			aria-hidden
		>
			<Icon className={cn("h-5 w-5", cell.icon)} strokeWidth={1.75} />
		</div>
	)
}

/**
 * 单条积分记录行：信息架构对齐 /global/profile/points-list renderItem，
 * 布局与间距对齐 PointsHistorySheet 原型（三列：图标 / 文案 / 金额）。
 */
export function MobileSettingsPointsRecordRow(props: {
	item: PointsRecordItem
	showDivider: boolean
	onClick: () => void
}) {
	const { item, showDivider, onClick } = props
	const { t } = useTranslation(["interface", "super"])

	const listTitle = getPointsRecordListTitle(
		item.description,
		t("topic.unnamedTopic", { ns: "super" }),
	)
	const listTime = getPointsRecordListTime(item.updatedAt)
	const formattedAmount = formatPointsRecordAmount(item.amount)

	return (
		<>
			<button
				type="button"
				onClick={onClick}
				className="flex w-full items-start gap-3 px-3.5 py-[10px] text-left transition-opacity active:opacity-60"
				data-testid={`mobile-settings-points-record-row-${item.id}`}
			>
				<PointsRecordDirectionIcon amount={item.amount} />

				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<div className="truncate text-[15px] font-medium leading-5 text-foreground">
						{listTitle}
					</div>
					<div className="text-[12px] leading-4 text-muted-foreground">{listTime}</div>
				</div>

				<div className="flex shrink-0 flex-col items-end gap-0.5 pt-0.5">
					<div className="text-[15px] font-medium tabular-nums leading-5 text-foreground">
						{formattedAmount}
					</div>
					<ChevronRight className="h-4 w-4 text-muted-foreground/70" />
				</div>
			</button>
			{showDivider ? (
				<div
					className={cn("h-px bg-border", POINTS_RECORD_ROW_TEXT_OFFSET_CLASSNAME)}
					aria-hidden
				/>
			) : null}
		</>
	)
}
