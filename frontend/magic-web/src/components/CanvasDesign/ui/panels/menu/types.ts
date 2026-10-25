import type { ComponentType, ReactNode, ReactElement } from "react"
import type { LucideProps } from "lucide-react"
import type { ShortcutDisplay } from "../../../public/props"
import type { ShortcutModifier } from "../../../runtime/interaction/shortcuts/types"

// 菜单项配置
export interface MenuOption {
	id: string
	label: string | ReactNode
	description?: string
	help?: string
	variant?: "default" | "destructive"
	icon: ComponentType<LucideProps> | ReactElement
	shortcut?:
		| ShortcutDisplay
		| {
				key?: string
				modifiers?: ShortcutModifier[]
		  }
		| null
	rightContentRender?: () => ReactNode
	onClick?: () => void
	disabled?: () => boolean
	visible?: () => boolean
	children?: (MenuOption | MenuSeparator)[]
}

// 菜单分隔符
export interface MenuSeparator {
	type: "separator"
}

// 菜单项或分隔符
export type MenuItem = MenuOption | MenuSeparator

// 菜单来源
export type MenuSource = "canvas" | "layers"

// Context 值类型
export interface ElementMenuContextValue {
	openMenu: (event: React.MouseEvent, elementId: string, source?: MenuSource) => void
	/** Open the element menu at screen coordinates (e.g. layers batch actions). */
	openMenuAt: (elementId: string, x: number, y: number, source?: MenuSource) => void
}
