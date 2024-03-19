import type { StructureItem, StructureUserItem } from "@/opensource/types/organization"
import type { FormHTMLAttributes, ReactNode } from "react"
import type { DepartmentSelectItem, OrganizationSelectItem, UserSelectItem } from "./originTypes"

export type OrganizationPanelSelectItem = DepartmentSelectItem | UserSelectItem

export type CheckboxOptions = {
	checked?: Array<OrganizationSelectItem>
	onChange?: (checked: Array<OrganizationSelectItem>) => void
	disabled?: Array<OrganizationSelectItem>
}

export type OrganizationPanelProps = FormHTMLAttributes<HTMLDivElement> & {
	defaultSelectedPath?: { id: string; name: string }[]
	selectedPath?: { id: string; name: string }[]
	onChangeSelectedPath?: (path: { id: string; name: string }[]) => void
	/** 处理点击子项 */
	onItemClick?: (node: OrganizationSelectItem, toNextDepartmentLevel: () => void) => void
	/** 子项箭头区域 - 自定义渲染 */
	itemArrow?: boolean | ((item: StructureItem) => ReactNode)
	/** 尾部区域 */
	footer?: ReactNode
	/** 搜索栏右侧 */
	topRight?: ReactNode
	/** 是否显示成员 */
	showMember?: boolean
	/** 成员节点扩展区域 */
	memberExtra?: (node: StructureUserItem) => ReactNode
	/** 面包屑右侧节点 */
	breadcrumbRightNode?: ReactNode
	checkboxOptions?: CheckboxOptions
	/** 成员节点包装器 */
	memberNodeWrapper?: (node: ReactNode, member: StructureUserItem) => ReactNode
	listClassName?: string
}
