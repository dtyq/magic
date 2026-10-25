import type { MenuProps } from "antd"

export type BeforeAction = () => boolean | Promise<boolean>

/** Wait for an optional confirmation before running a toolbar action. */
export async function runGuardedAction(
	beforeAction: BeforeAction | undefined,
	action: () => void | Promise<void>,
): Promise<boolean> {
	if (beforeAction && !(await beforeAction())) return false
	await action()
	return true
}

/** Wrap an Ant Design menu callback with the same optional action guard. */
export function guardMenuClick(
	beforeAction: BeforeAction | undefined,
	onClick: MenuProps["onClick"],
): MenuProps["onClick"] {
	if (!beforeAction || !onClick) return onClick

	return (info) => {
		void runGuardedAction(beforeAction, () => onClick(info))
	}
}

/** Recursively guard menu item actions while preserving the original menu shape. */
export function guardMenuItems(
	items: MenuProps["items"],
	beforeAction: BeforeAction | undefined,
): MenuProps["items"] {
	if (!items || !beforeAction) return items

	return items.map((item) => {
		if (!item || item.type === "divider") return item

		const onClick = "onClick" in item ? item.onClick : undefined
		const children = "children" in item ? item.children : undefined

		return {
			...item,
			...(onClick
				? {
						onClick: (info: Parameters<NonNullable<MenuProps["onClick"]>>[0]) => {
							void runGuardedAction(beforeAction, () => onClick(info))
						},
					}
				: {}),
			...(children ? { children: guardMenuItems(children, beforeAction) } : {}),
		} as NonNullable<MenuProps["items"]>[number]
	})
}
