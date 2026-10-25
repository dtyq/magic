import dayjs, { type Dayjs } from "dayjs"
import type { NotificationItemData } from "./types"

export type NotificationDateGroup = "today" | "yesterday" | "earlier"

export function getNotificationDateGroup(iso: string, now: Dayjs = dayjs()): NotificationDateGroup {
	const time = dayjs(iso)
	if (time.isSame(now, "day")) return "today"
	if (time.isSame(now.subtract(1, "day"), "day")) return "yesterday"
	return "earlier"
}

export function groupNotifications(messages: NotificationItemData[], now: Dayjs = dayjs()) {
	const buckets: Record<NotificationDateGroup, NotificationItemData[]> = {
		today: [],
		yesterday: [],
		earlier: [],
	}

	messages.forEach((message) => {
		buckets[getNotificationDateGroup(message.created_at, now)].push(message)
	})

	return (["today", "yesterday", "earlier"] as const)
		.map((key) => ({ key, messages: buckets[key] }))
		.filter((group) => group.messages.length > 0)
}
