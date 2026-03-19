import { type LucideProps } from "lucide-react"
import { type ToolType } from "../../canvas/types"

export interface ToolOptionItem {
	label: string
	icon?: React.ComponentType<LucideProps>
	value?: ToolType
	shortcut?: string[]
	children?: ToolOptionItem[]
}
