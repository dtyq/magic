
import { ComponentType } from "@/common/constants"
import type { Expression } from "./expression"
import { EXPRESSION_VALUE, InputExpressionValue } from "@/MagicExpressionWidget/types"
import Schema from "@/MagicJsonSchemaEditor/types/Schema"

export namespace Common {
	/**
	 * 单个组件数据结构
	 * 表单组件 -------- Schema
	 * 控件组件 -------- ContainerField[]
	 * 条件组件 -------- Expression.LogicNode
	 * 接口组件 -------- COMMON_TYPES.API_SETTINGS
	 */
	export type Component<
		CompType extends ComponentType,
		CompContent extends
			| Schema
			| Expression.LogicNode
			| WidgetSchema
			| API_SETTINGS
	> = {
		id: string
		type: CompType // 组件类型
		version: string // 版本
		structure: CompContent
	}

	/** 表单组件类型 */
	export type FormComponent = Component<ComponentType.Form, Schema>

	/** 控件组件类型 */
	export type WidgetComponent = Component<ComponentType.Widget, WidgetSchema>

	/** 条件组件类型 */
	export type ConditionComponent = Component<ComponentType.Condition, Expression.LogicNode>

	/** 控件组件类型 */
	export type ApiComponent = Component<ComponentType.Api, API_SETTINGS>

	export type ComponentTypes = FormComponent | WidgetComponent | ConditionComponent | ApiComponent

	/** 数字输入框特有配置 */
	export type NumberExtraConfig = {
		max: number
		min: number
		step: number
	}

	/** 开关特有配置 */
	export type SwitchExtraConfig = {
		checked_text: string
		unchecked_text: string
	}

	export type Option = {
		label: string
		value: string
		children?: Option[]
	}

	/** 动态字段特有配置 */
	export type DataSourceConfig = {
		dynamic_fields: boolean
		data_source?: Option[]
		data_source_api?: ApiComponent
		multiple?: boolean
	}

	/** 时间选择器特有配置 */
	export type TimePickerConfig = {
		format: string
	}

	/** 携带哨兵的控件组件 */
	export interface WidgetSchema {
		key: string
		type: string
		sort?: number
		properties: {
			[key: string]: BaseWidgetSchema
		}
	}

	/** 控件组件的Schema */
	export interface BaseWidgetSchema extends Schema {
		key: string
		type: string
		sort?: number
		initial_value: InputExpressionValue | null
		display_config: {
			label: string
			tooltips: string
			required: boolean
			visible: boolean
			allow_expression: boolean
			disabled: boolean
			extra?:
				| NumberExtraConfig
				| SwitchExtraConfig
				| DataSourceConfig
				| TimePickerConfig
				| object

			web_config?: {
				/** linkage模式特殊数据 */
				linkage_data?: {
					label: string
					required: boolean
					/** 触发联动的key */
					trigger_key: string
					/** 被联动的key */
					action_key: string
				}
				// 是否可更改当前formItemType
				changeable?: boolean
				/** 容器属性 */
				wrapper_props?: {
					title?: string
				}
				before_widget?: BaseWidgetSchema
				before_form_type?: string
				/** 联动依赖项 */
				dependencies?: string[]
				/** 条件组件的特殊字段，第二个字段的特殊处理，是否隐藏第三个字段 */
				linkage_right_operands?: boolean
			}
		}
		properties?: {
			[key: string]: BaseWidgetSchema
		}
		items?: BaseWidgetSchema
	}

	// 入参配置(依赖接口配置)
	interface ARGS_SETTINGS {
		params_query: Common.FormComponent
		params_path: Common.FormComponent
		body_type: string
		body: Common.FormComponent
		headers: Common.FormComponent
	}

	// 接口配置
	export interface API_SETTINGS {
		method: string
		domain: string
		uri: EXPRESSION_VALUE
		url: string
		path: string
		request: ARGS_SETTINGS
		response_check: {}
		response_form: {}
	}

	export type Options = Array<Option>

}
