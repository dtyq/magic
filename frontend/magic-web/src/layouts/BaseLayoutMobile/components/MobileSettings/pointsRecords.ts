import dayjs from "@/lib/dayjs"
import { userStore } from "@/models/user"

import type { Admin } from "@/types/admin"
import type { PointsRecordGroup, PointsRecordItem } from "./types"

const POINTS_GROUP_ORDER = ["today", "yesterday", "thisWeek", "earlier"] as const
type PointsRecordSourceItem = Admin.OrganizationPointsChangeListItem | Record<string, unknown>
type PointsRecordsResponse =
	| Admin.WithPage<Admin.OrganizationPointsChangeListItem[]>
	| {
			list?: Array<Record<string, unknown>>
			data?: {
				list?: Array<Record<string, unknown>>
			}
	  }
	| Array<Record<string, unknown>>
	| undefined

/** 兼容不同积分明细接口包装层，并统一转成设置页视图可消费的数据结构。 */
export function normalizePointsRecords(response: PointsRecordsResponse, fallbackLabel: string) {
	const rawList: PointsRecordSourceItem[] = Array.isArray(response)
		? response
		: Array.isArray(response?.list)
			? (response.list as PointsRecordSourceItem[])
			: response && "data" in response && Array.isArray(response.data?.list)
				? response.data.list
				: []

	return rawList.map(
		(item: PointsRecordSourceItem, index: number): PointsRecordItem => ({
			id: String(item.id ?? index),
			amount: Number(
				item.amount ??
					(item as Record<string, unknown>)["point_amount"] ??
					(item as Record<string, unknown>)["points"] ??
					0,
			),
			label: String(
				item.label ??
					(item as Record<string, unknown>)["title"] ??
					(item as Record<string, unknown>)["reason"] ??
					fallbackLabel,
			),
			description: String(
				item.description ?? (item as Record<string, unknown>)["remark"] ?? "",
			),
			// 缺失时间时保留空串，让后续分组逻辑统一落入更早分组，避免误归到今天。
			createdAt: String(
				item.created_at ?? (item as Record<string, unknown>)["createdAt"] ?? "",
			),
			// 详情态优先展示服务端返回的更新时间，没有时回退到创建时间。
			updatedAt: String(
				item.updated_at ??
					(item as Record<string, unknown>)["updatedAt"] ??
					item.created_at ??
					(item as Record<string, unknown>)["createdAt"] ??
					"",
			),
		}),
	)
}

/** 统一读取积分购买页展示态，优先复用已有订阅信息字段而不是在 UI 中重新拼业务判断。 */
export function getMobileSettingsPointsPurchaseState() {
	const subscriptionInfo = userStore.user.organizationSubscriptionInfo

	return {
		points: userStore.user.organizationPoints || 0,
		isPaidPlan: Boolean(subscriptionInfo?.is_paid_plan),
		canRecharge: Boolean(subscriptionInfo?.is_recharge_points),
	}
}

/** 统一把积分记录解析成用户时区下的时间对象，非法时间返回 null 供调用方兜底。 */
function parsePointsRecordTime(createdAt: string, timezone: string) {
	if (!createdAt) return null

	const parsedTime = dayjs(createdAt).tz(timezone)
	return parsedTime.isValid() ? parsedTime : null
}

/** 在分组前先按更新时间倒序排序，与列表展示的 updated_at 口径一致。 */
function sortPointsRecordsByUpdatedAt(records: PointsRecordItem[], timezone: string) {
	return [...records].sort((left, right) => {
		const leftTime = parsePointsRecordTime(left.updatedAt || left.createdAt, timezone)
		const rightTime = parsePointsRecordTime(right.updatedAt || right.createdAt, timezone)

		if (!leftTime && !rightTime) return 0
		if (!leftTime) return 1
		if (!rightTime) return -1

		return rightTime.valueOf() - leftTime.valueOf()
	})
}

/**
 * 按日历天计算分组键，与 points-list 老页及原型一致（非 startOf('week')）。
 * diffDays：0 今天，1 昨天，2-7 本周，其余为更早。
 */
export function getPointsRecordGroupKey(timestamp: string, timezone: string) {
	const recordTime = parsePointsRecordTime(timestamp, timezone)
	if (!recordTime) return "earlier" as const

	const now = dayjs().tz(timezone)
	const diffDays = now.startOf("day").diff(recordTime.startOf("day"), "day")

	if (diffDays <= 0) return "today" as const
	if (diffDays === 1) return "yesterday" as const
	if (diffDays <= 7) return "thisWeek" as const

	return "earlier" as const
}

/** 按用户时区把积分记录分组，保证浮层里的时间分段与用户设置一致。 */
export function groupPointsRecords(
	records: PointsRecordItem[],
	timezone: string,
	t: (key: string) => string,
) {
	const groups = new Map<string, PointsRecordItem[]>()
	const sortedRecords = sortPointsRecordsByUpdatedAt(records, timezone)

	for (const item of sortedRecords) {
		const groupKey = getPointsRecordGroupKey(item.updatedAt || item.createdAt, timezone)
		const prev = groups.get(groupKey) ?? []
		prev.push(item)
		groups.set(groupKey, prev)
	}

	return POINTS_GROUP_ORDER.filter((key) => (groups.get(key)?.length ?? 0) > 0).map(
		(key): PointsRecordGroup => ({
			label: t(`setting.pointsGroups.${key}`),
			items: groups.get(key) ?? [],
		}),
	)
}
