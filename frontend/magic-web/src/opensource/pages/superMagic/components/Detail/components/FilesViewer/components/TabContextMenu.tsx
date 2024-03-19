import { Dropdown } from "antd"
import type { TabContextMenuState } from "../hooks/useTabContextMenu"
import type { MenuProps } from "antd"

export interface TabContextMenuProps {
	contextMenuState: TabContextMenuState
	getContextMenuItems: (tabId: string) => MenuProps["items"]
	onClose: () => void
}

export function TabContextMenu({
	contextMenuState,
	getContextMenuItems,
	onClose,
}: TabContextMenuProps) {
	if (!contextMenuState.visible || !contextMenuState.tabId) {
		return null
	}

	return (
		<Dropdown
			key={`${contextMenuState.tabId}-${contextMenuState.position.x}-${contextMenuState.position.y}`}
			open={contextMenuState.visible}
			onOpenChange={onClose}
			menu={{
				items: getContextMenuItems(contextMenuState.tabId),
			}}
			trigger={[]}
			getPopupContainer={() => document.body}
			destroyPopupOnHide
		>
			<div
				style={{
					position: "fixed",
					left: contextMenuState.position.x,
					top: contextMenuState.position.y,
					width: 1,
					height: 1,
					pointerEvents: "none",
				}}
			/>
		</Dropdown>
	)
}
