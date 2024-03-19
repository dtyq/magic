import { MenuProps } from "antd"
import type { ActionDrawerProps } from "@/opensource/components/shadcn-composed/action-drawer"

// 组件属性接口 - 泛型支持
export interface SuperMagicDropdownProps<T = any> {
	width?: number
	getMenuItems?: (itemData: T) => MenuProps["items"]
	autoAdjustPlacement?: boolean // 是否启用智能 placement 调整，默认 true
	preferredPlacements?: ("bottom-left" | "bottom-right" | "top-left" | "top-right")[] // 首选的 placement 顺序
	fallbackToAnyPlacement?: boolean // 是否在首选 placement 都不可用时回退到任意可用的 placement，默认 true
	fixedWidth?: boolean // 是否跳过 DOM 测量，直接使用配置的 width，默认 false
	mobileProps?: Partial<Omit<ActionDrawerProps, "open" | "onOpenChange" | "children">> // 移动端 ActionDrawer 配置
	onOpenChange?: (open: boolean, itemData: T | null) => void // 菜单开关状态变化回调
}

// 事件委托扩展内容接口 - 泛型支持
export interface DropdownDelegateProps<T = any> {
	onDropdownActionClick?: (event: React.MouseEvent<HTMLDivElement>, itemData: T) => void
	onDropdownContextMenuClick?: (event: React.MouseEvent<HTMLDivElement>, itemData: T) => void
}

// Hook 返回值接口 - 泛型支持，包含扩展内容
export interface UseSuperMagicDropdownReturn<T = any> {
	open: boolean
	dropdownContent: React.ReactElement
	// 事件委托扩展内容
	delegateProps: DropdownDelegateProps<T>
}
