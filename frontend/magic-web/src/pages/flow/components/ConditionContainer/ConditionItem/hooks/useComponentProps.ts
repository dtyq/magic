import { useMemo, useState } from "react"
import { Schema, type Sheet } from "@/types/sheet"
import type { Condition } from "../../types"
import {
	getColumnTargetType,
	getColumnType,
	getNotSupportedFilterColumns,
	getValueOptions,
	judgeIsMultiple,
} from "../../helpers"
import { AutomateFlowFieldGroup, ROW_ID_COLUMN_ID } from "../../constants"
import { getPlaceholder } from "@/pages/flow/utils/helpers"

type UseComponentProps = {
	condition: Condition
	columns: Sheet.Content["columns"]
	isSupportRowId: boolean
	sheetId: string
	dataTemplate: Record<string, Sheet.Detail>
}

export default function useComponentProps({
	condition,
	columns,
	isSupportRowId,
	sheetId,
	dataTemplate,
}: UseComponentProps) {
	const [notSupportedFilterColumns] = useState(() => getNotSupportedFilterColumns())

	// 当前使用的列类型，因为公式、查找引用最后是取它们值或者引用的类型
	const displayType = useMemo(() => {
		return getColumnTargetType(sheetId, condition?.column_id, dataTemplate)
	}, [condition?.column_id, dataTemplate, sheetId])

	// 左侧的字段可选列表
	const leftColumnOptions = useMemo(() => {
		const columnsOption = Object.keys(columns)
			.filter((columnId) => {
				return (
					!notSupportedFilterColumns.includes(columns[columnId]?.columnType) &&
					Reflect.has(AutomateFlowFieldGroup, columns[columnId]?.columnType)
				)
			})
			.map((columnId) => columns[columnId])

		if (isSupportRowId) {
			columnsOption.push({
				columnId: ROW_ID_COLUMN_ID,
				id: ROW_ID_COLUMN_ID,
				label: "行记录ID",
				columnType: Schema.ROW_ID,
				columnProps: {},
			})
		}
		return columnsOption
	}, [columns, isSupportRowId, notSupportedFilterColumns])

	/** 中间的条件可选列表 */
	const centerConditionOptions = useMemo(() => {
		const compareOption = AutomateFlowFieldGroup[displayType as Schema]?.conditions || []
		return compareOption
	}, [displayType])

	/** 右侧表达式组件的动态属性 */
	const rightExpressionProps = useMemo(() => {
		const column = columns[condition?.column_id] || {}
		// 列原类型
		const columnType = getColumnType(columns, condition?.column_id)
		const valueOptions = getValueOptions({
			columns,
			condition,
			dataTemplate,
		})
		const isMultiple = judgeIsMultiple(column, condition)
		const placeholder = getPlaceholder(column, displayType, true)
		return {
			options: valueOptions,
			isMultiple,
			placeholder,
			columnType,
		}
	}, [columns, condition, dataTemplate, displayType])

	return {
		leftColumnOptions,
		centerConditionOptions,
		rightExpressionProps,
	}
}
