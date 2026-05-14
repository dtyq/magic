import { Coins } from "lucide-react"

import dayjs from "@/lib/dayjs"

import { MobileSettingsSheetContainer } from "./SheetContainer"
import type { PointsRecordItem } from "../types"

/** 统一格式化详情态显示时间，避免接口缺失字段时直接把非法时间暴露给用户。 */
function formatPointsRecordDetailTime(value: string, timezone: string) {
	if (!value) return "--"

	const parsedTime = dayjs(value)
	if (!parsedTime.isValid()) return "--"

	return parsedTime.tz(timezone).format("YYYY-MM-DD HH:mm")
}

/** 详情字段行统一左右分栏，保持和原型卡片信息区一致的阅读节奏。 */
function DetailFieldRow(props: { label: string; value: string; showDivider?: boolean }) {
	const { label, value, showDivider = false } = props

	return (
		<>
			<div className="flex items-start gap-3 px-[14px] py-[10px]">
				<div className="w-[64px] shrink-0 text-[14px] leading-5 text-muted-foreground">
					{label}
				</div>
				<div className="min-w-0 flex-1 break-words text-right text-[15px] leading-5 text-foreground">
					{value}
				</div>
			</div>
			{showDivider ? <div className="ml-[14px] h-px w-full bg-border" /> : null}
		</>
	)
}

/** 积分记录详情使用二级 sheet 承载，只消费当前接口已有字段，避免发明未落地的数据语义。 */
export function MobileSettingsPointsRecordDetailSheet(props: {
	item: PointsRecordItem | null
	open: boolean
	onClose: () => void
	timezone: string
	recordIdLabel: string
	timeLabel: string
}) {
	const { item, open, onClose, timezone, recordIdLabel, timeLabel } = props
	if (!item) return null

	const heroTitle = item.description || item.label || recordIdLabel
	const detailTime = formatPointsRecordDetailTime(item.updatedAt || item.createdAt, timezone)
	const isPositive = item.amount >= 0

	return (
		<MobileSettingsSheetContainer
			open={open}
			title={heroTitle}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose()
			}}
			contentClassName="gap-2.5 px-[10px] pb-[calc(var(--safe-area-inset-bottom)+1rem)] pt-2"
			dataTestId="mobile-settings-points-record-detail-sheet"
		>
			<div className="flex flex-col items-center gap-3 rounded-lg bg-card px-4 pb-4 pt-6 text-center">
				<div
					className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
					aria-hidden
				>
					<Coins className="h-6 w-6" />
				</div>
				<div className="max-w-full text-[14px] leading-5 text-muted-foreground">
					{heroTitle}
				</div>
				<div className="text-[28px] font-semibold tabular-nums leading-8 text-foreground">
					{isPositive ? "+" : ""}
					{new Intl.NumberFormat().format(item.amount)}
				</div>
				<div className="flex flex-wrap items-center justify-center gap-2">
					{item.label ? (
						<div className="inline-flex h-6 items-center rounded-full border border-border bg-background px-2 text-[12px] leading-4 text-foreground">
							{item.label}
						</div>
					) : null}
					<div className="text-[13px] leading-4 text-muted-foreground">{detailTime}</div>
				</div>
			</div>

			<div className="overflow-hidden rounded-lg bg-card">
				<DetailFieldRow label={recordIdLabel} value={item.id} showDivider />
				<DetailFieldRow label={timeLabel} value={detailTime} />
			</div>
		</MobileSettingsSheetContainer>
	)
}
