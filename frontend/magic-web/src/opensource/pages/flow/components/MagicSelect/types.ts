import { ReactElement } from "react"

// 外部传入的事件处理函数类型
export interface SelectEventHandlers {
	onNodeSelected?: (nodeId?: string) => void
	onEdgeSelected?: (edgeId?: string) => void
	onCanvasClicked?: (position?: { x: number; y: number }) => void
}

// 下拉框渲染属性类型
export interface DropdownRenderProps {
	// 搜索框占位符
	placeholder?: string
	// 实际渲染组件
	component?: () => ReactElement
	// 是否显示搜索框
	showSearch?: boolean
	// Option的包裹层组件
	OptionWrapper?: React.FC<any>
	[key: string]: any
}

// MagicSelect 组件属性类型
export interface MagicSelectProps {
	className?: string
	suffixIcon?: React.ReactElement
	popupClassName?: string
	dropdownRenderProps?: DropdownRenderProps
	// 新增可选的关闭下拉菜单的外部事件处理函数
	eventHandlers?: SelectEventHandlers
	[key: string]: any
}

// 选项类型
export interface SelectOption {
	label: string
	value: string | number
	visible?: boolean
	[key: string]: any
}
