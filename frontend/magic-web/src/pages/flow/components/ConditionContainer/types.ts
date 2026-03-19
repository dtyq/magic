import type { Schema, Sheet } from "@/types/sheet"
import type { WidgetExpressionValue } from "@dtyq/magic-flow/dist/common/BaseUI/MagicExpressionWrap"

export enum Time {
	TODAY = "today",
	TOMORROW = "tomorrow",
	YESTERDAY = "yesterday",
	THIS_WEEK = "this_week",
	LAST_WEEK = "last_week",
	THIS_MONTH = "this_month",
	LAST_MONTH = "last_month",
	PAST_SEVEN_DAYS = "past_seven_days",
	NEXT_SEVEN_DAYS = "next_seven_days",
	PAST_THIRTY_DAYS = "past_thirty_days",
	NEXT_THIRTY_DAYS = "next_thirty_days",
	DESIGNATION = "designation",
	CURRENT = "current",
	TRIGGER_TIME = "trigger_time",
}

export enum Operators {
	EQUAL = "=",
	NOT_EQUAL = "<>",
	GREATER_THAN = ">",
	GREATER_THAN_OR_EQUAL = "≥",
	LESS_THAN = "<",
	LESS_THAN_OR_EQUAL = "≤",
	CONTAIN = "%%",
	NOT_CONTAIN = "!%%",
	EMPTY = "is_null",
	NOT_EMPTY = "is_not_null",
}

interface Operator {
	id: Operators
	label: string
}

interface ValueOption {
	id: Time
	label: string
}

interface ExtraInfo {
	showNumberFormat?: boolean
	showMultAddOption?: boolean
	showDate?: boolean
	showCheckboxOption?: boolean
	showCreateTime?: boolean
	showUpdateTime?: boolean
}

export interface AutomateFlowField {
	icon: string
	title: string
	id: Schema
	extraInfo?: ExtraInfo
	conditions: Operator[]
	valueOptions: ValueOption[]
}

export interface Condition {
	column_id: string
	column_type?: string
	operator: Operators | null
	value: WidgetExpressionValue | undefined
}

export type ConditionContainerProps = {
	value?: Condition[]
	onChange?: (val: Condition[]) => void
	addButtonText?: string
	isEnableDel?: boolean
	isSupportRowId?: boolean
	columns: Sheet.Content["columns"]
	sheetId: string
	dataTemplate: Record<string, Sheet.Detail>
}
