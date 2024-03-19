/* eslint-disable @typescript-eslint/naming-convention */
import { Common } from "./common"
import { EXPRESSION_ITEM_TYPE } from "@/MagicJsonSchemaEditor/types/Schema"
import { RELATION_COMP_TYPE, RELATION_LOGICS_MAP } from "../constants"
import { InputExpressionValue } from "@/MagicExpressionWidget/types"

export namespace Expression {
	// 表达式某一项具体值类型
	export interface EXPRESSION_ITEM {
		type: EXPRESSION_ITEM_TYPE
		value: string
		uniqueId: string
		name?: string
	}

	// 条件编辑组件，右侧具体对比项(type=compare时)
	export interface CompareNode {
		type: RELATION_COMP_TYPE
		left_operands: InputExpressionValue
		condition: string
		right_operands: InputExpressionValue
	}

	// 条件编辑组件，右侧具体对比项(type=operation时)
	export interface OperationNode {
		type: RELATION_COMP_TYPE
		operands: InputExpressionValue
	}

	// 条件编辑组件，整体的类型
	export interface LogicNode {
		ops: RELATION_LOGICS_MAP
		children: Condition[]
	}

	// 条件编辑组件，单个项的类型
	export type Condition = LogicNode | CompareNode

	export interface ConditionSourceItem {
		key: string
		text: string // 选择的显示名
		value: string // 选择的实际value
		have_children: boolean
		children?: ConditionSourceItem[]
	}

	export type ConditionSource = ConditionSourceItem[]
}
