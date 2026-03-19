import type { WidgetValue } from "../../common/Output"

/**
 * 选中的工具数据结构
 */
export type ToolSelectedItem = {
	tool_id: string
	tool_set_id: string
	async: boolean
	custom_system_input: WidgetValue["value"]
	name?: string
	description?: string
}
