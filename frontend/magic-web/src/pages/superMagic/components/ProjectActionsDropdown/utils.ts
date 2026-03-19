import { MenuProps } from "antd"
import { VisibleMenuItem } from "./types"
import { ItemType } from "antd/es/menu/interface"

export function normalizeVisibleMenuItems(
	items: VisibleMenuItem[],
): Exclude<MenuProps["items"], undefined> {
	return items.reduce(
		(result, currentItem) => {
			if (currentItem.visible === false) return result

			const isDivider = currentItem.type === "divider"

			if (isDivider) {
				result.needsDivider = true
				return result
			}

			if (result.needsDivider && result.items.length > 0) {
				result.items.push({ type: "divider" } as ItemType)
			}
			result.needsDivider = false

			const menuItem = { ...currentItem } as VisibleMenuItem
			delete menuItem.visible
			result.items.push(menuItem as ItemType)

			return result
		},
		{ items: [] as Exclude<MenuProps["items"], undefined>, needsDivider: false },
	).items
}
