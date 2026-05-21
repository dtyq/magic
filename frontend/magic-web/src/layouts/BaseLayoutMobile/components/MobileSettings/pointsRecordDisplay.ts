import { splitNumber } from "@/utils/number"

import type { PointsRecordItem } from "./types"

/** 列表/详情主标题：与 /global/profile/points-list 一致，优先 description。 */
export function getPointsRecordListTitle(description: string, unnamedTopicLabel: string): string {
	const trimmedDescription = description.trim()
	if (trimmedDescription) return trimmedDescription

	return unnamedTopicLabel
}

/** 列表时间：沿用接口 updated_at 原串，与老页 renderItem 一致。 */
export function getPointsRecordListTime(updatedAt: string): string {
	const trimmedTime = updatedAt.trim()
	if (!trimmedTime) return "--"

	return trimmedTime
}

/** 金额展示：± 前缀 + 千分位绝对值，与老页 splitNumber 规则一致。 */
export function formatPointsRecordAmount(amount: number): string {
	const amountNumber = Number(amount)
	if (!Number.isFinite(amountNumber)) return "0"

	const isPositive = amountNumber > 0
	const sign = isPositive ? "+ " : "- "

	return `${sign}${splitNumber(Math.abs(amountNumber))}`
}

/** 判断积分变动方向，供列表装饰图标使用。 */
export function getPointsRecordDirection(amount: number): "income" | "expense" {
	return Number(amount) > 0 ? "income" : "expense"
}

export interface PointsRecordDetailMetaRow {
	key: string
	text: string
}

/** 详情区次要信息行：label、记录 ID、时间，有值才返回。 */
export function getPointsRecordDetailMetaRows(
	item: PointsRecordItem,
	labels: {
		recordId: string
		time: string
	},
): PointsRecordDetailMetaRow[] {
	const rows: PointsRecordDetailMetaRow[] = []

	if (item.label.trim()) {
		rows.push({ key: "label", text: item.label.trim() })
	}

	if (item.id.trim()) {
		rows.push({
			key: "recordId",
			text: `${labels.recordId}: ${item.id.trim()}`,
		})
	}

	const timeText = getPointsRecordListTime(item.updatedAt)
	rows.push({
		key: "time",
		text: `${labels.time}: ${timeText}`,
	})

	return rows
}
