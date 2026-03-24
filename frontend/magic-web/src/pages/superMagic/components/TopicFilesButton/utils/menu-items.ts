import type { MenuProps } from "antd"

export type TopicFilesMenuItem = NonNullable<MenuProps["items"]>[number]

export function normalizeMenuItems(items: TopicFilesMenuItem[]): TopicFilesMenuItem[] {
	return items.filter((item, index) => {
		if (!item) return false
		if (item.type !== "divider") return true

		const previousItem = items[index - 1]
		const nextItem = items[index + 1]

		if (!previousItem || !nextItem) return false
		if (previousItem.type === "divider" || nextItem.type === "divider") return false

		return true
	})
}
