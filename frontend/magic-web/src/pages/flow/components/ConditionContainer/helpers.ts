import { Schema, type Sheet } from "@/types/sheet"
import { get } from "lodash-es"
import i18next from "i18next"
import { AutomateFlowFieldGroup, getDefaultConstValue, ROW_ID_COLUMN_ID } from "./constants"
import type { Condition } from "./types"
import { Operators } from "./types"

export const PRESENT_TYPES = {
	VALUE: "VALUE",
	UNIQ_VALUE: "UNIQ_VALUE",
	SUM: "SUM",
	COUNT: "COUNT",
	UNIQ_COUNT: "UNIQ_COUNT",
	MEAN: "MEAN",
	MAX: "MAX",
	MIN: "MIN",
}

export const LOOKUP_ERROR = {
	NONE: "NONE",
	CIRCLE: "#CYCLE!",
	INVALID_VALUE: "#VALUE!",
	DIVISION_BY_ZERO: "#DIV/0!",
	INVALID_NAME: "#NAME?",
	INVALID_NUMBER: "#NUM!",
	INVALID_REF: "#REF!",
	UNKNOWN: "#ERROR!",
	VALUE_NOT_AVAILABLE: "#N/A",
	STATISTICS: i18next.t("common.computing", { ns: "flow" }),
}

export const NOT_SUPPORTED_FILTER_COLUMNS = [
	Schema.LINK,
	Schema.ROW_ID,
	Schema.LOOKUP,
	Schema.BUTTON,

	// Schema.FORMULA
]

export const judgeIsMultiple = (column: Sheet.Column, condition: Condition) => {
	if ([Schema.MULTIPLE, Schema.TEXT].includes(column?.columnType)) return true

	if (
		condition?.operator &&
		[Operators.CONTAIN, Operators.NOT_CONTAIN].includes(condition.operator)
	) {
		return true
	}

	if (
		[Schema.QUOTE_RELATION, Schema.MUTUAL_RELATION, Schema.MEMBER].includes(
			column?.columnType,
		) &&
		get(column, ["columnProps", "multiple"], false)
	) {
		return true
	}

	return false
}

export const getColumnType = (columns: Sheet.Content["columns"], columnId: string) => {
	let columnType = columns[columnId]?.columnType
	if (columnId === ROW_ID_COLUMN_ID) columnType = Schema.ROW_ID
	return columnType
}

export const getNotSupportedFilterColumns = () => {
	return NOT_SUPPORTED_FILTER_COLUMNS
}

export const filterSupportColumnType = (supportFieldTypes = []) => {
	const notSupportType = [] as Schema[]
	return supportFieldTypes.filter((fieldType) => !notSupportType.includes(fieldType))
}

// 获取单向/双向关联的目标类型
function getRelationTargetType({
	sheetId,
	columnId,
	dataTemplate,
}: {
	sheetId: string
	columnId: string
	dataTemplate: Record<string, Sheet.Detail>
}) {
	const column = get(dataTemplate, [sheetId, "content", "columns", columnId], null)
	const targetSheetId = get(column, ["columnProps", "sheetId"], null)
	const targetSheet = get(dataTemplate, [targetSheetId], null)
	const primaryKey = targetSheet?.content?.primaryKey
	const targetColumn = primaryKey ? get(targetSheet, ["columns", primaryKey], null) : null

	if (!column || !targetSheet || !targetColumn) {
		return {
			type: Schema.NUMBER,
			column: null,
			error: LOOKUP_ERROR.INVALID_REF,
		}
	}

	return {
		type: targetColumn.columnType,
		column: targetColumn,
		error: LOOKUP_ERROR.NONE,
	}
}

function getActualTypeByPresentType(columnType: Schema, presentType: Schema) {
	if ([PRESENT_TYPES.VALUE, PRESENT_TYPES.UNIQ_VALUE].includes(presentType)) {
		return columnType
	}

	if ([PRESENT_TYPES.COUNT, PRESENT_TYPES.UNIQ_COUNT].includes(presentType)) {
		return Schema.NUMBER
	}

	if (
		[Schema.DATE, Schema.TODO_FINISHED_AT, Schema.CREATE_AT, Schema.UPDATE_AT].includes(
			columnType,
		)
	) {
		return Schema.DATE
	}

	return Schema.NUMBER
}

// 获取列类型 包括公式、查找引用、单双向关联的目标类型
export function getTargetType({
	sheetId,
	columnId,
	dataTemplate,
	path = [], // 加入路径，用于检测是否产生循环引用
}: {
	sheetId: string
	columnId: string
	dataTemplate: Record<string, Sheet.Detail>
	path?: string[]
}): {
	type: Schema
	column: Sheet.Column | null
	error: string
} {
	const column = get(dataTemplate, [sheetId, "content", "columns", columnId], null)
	if (!column) {
		return {
			type: Schema.NUMBER,
			column: null,
			error: LOOKUP_ERROR.INVALID_REF,
		}
	}

	if (column.columnType !== Schema.LOOKUP) {
		if ([Schema.QUOTE_RELATION, Schema.MUTUAL_RELATION].includes(column.columnType)) {
			return getRelationTargetType({
				sheetId,
				columnId,
				dataTemplate,
			})
		}
		if (column.columnType === Schema.FORMULA) {
			return {
				// type: getFormulaTargetType({
				// 	sheetId,
				// 	columnId,
				// 	dataTemplate
				// }).type,
				// TODO 计算公式实际类型
				type: Schema.TEXT,
				column,
				error: LOOKUP_ERROR.NONE,
			}
		}
		return {
			type: column.columnType,
			column,
			error: LOOKUP_ERROR.NONE,
		}
	}

	const {
		presentType = PRESENT_TYPES.VALUE,
		targetColumnId = "",
		targetSheetId = "",
	} = column?.columnProps || {}
	const targetColumn = get(
		dataTemplate,
		[targetSheetId, "content", "columns", targetColumnId],
		null,
	)

	if (path.includes(columnId)) {
		const targetColumnType = targetColumn?.columnType ?? Schema.NUMBER
		return {
			type: getActualTypeByPresentType(targetColumnType, presentType),
			column: targetColumn,
			error: LOOKUP_ERROR.CIRCLE,
		}
	}
	path.push(columnId) // 加入路径，用于检测是否产生循环引用

	const result = getTargetType({
		sheetId: targetSheetId,
		columnId: targetColumnId,
		dataTemplate,
		path: [...path],
	})
	return {
		...result,
		type: getActualTypeByPresentType(result.type, presentType),
	}
}

export const getValueOptions = ({
	columns,
	condition,
	dataTemplate,
}: {
	columns: Sheet.Content["columns"]
	condition: Condition
	dataTemplate: Record<string, Sheet.Detail>
}): Array<{ id: string; label: string }> => {
	if (
		condition?.operator &&
		[Operators.EMPTY, Operators.NOT_EMPTY].includes(condition.operator)
	) {
		return []
	}

	const getOptions = (
		cols: Sheet.Content["columns"],
		colId: string,
		type?: Schema,
	): Array<{ id: string; label: string }> => {
		let columnType = type
		let column = {} as Sheet.Column
		if (cols && colId) {
			columnType = cols[colId]?.columnType
			column = cols[colId]
		}

		switch (columnType) {
			case Schema.TEXT:
			case Schema.NUMBER: {
				return []
			}
			case Schema.DATE:
			case Schema.CREATE_AT:
			case Schema.UPDATE_AT:
			case Schema.TODO_FINISHED_AT:
				return AutomateFlowFieldGroup[columnType].valueOptions
			case Schema.SELECT:
			case Schema.MULTIPLE:
				return column.columnProps.options as Array<{ id: string; label: string }>
			// case Schema.QUOTE_RELATION:
			// case Schema.MUTUAL_RELATION: {
			// 	const { sheetId: targetSheetId } = get(cols, [ condition.columnId, "columnProps" ])
			// 	const primaryKey = get(dataTemplate, [ targetSheetId, "primaryKey" ])
			// 	const targetColumn = get(dataTemplate, [ targetSheetId, "columns", primaryKey ])

			// 	const targetRecords = Object.values(dataSource)
			// 		.filter(record => record.sheetId === targetSheetId)

			// 	return targetRecords.reduce((arr, item) => {
			// 		const renderText = parseRenderText(item[primaryKey], targetColumn, item)
			// 		arr.push({
			// 			label: renderText === "" || !renderText ? i18n.t("UNNAMED_RECORD") : renderText,
			// 			id: item.id
			// 		})
			// 		return arr
			// 	}, [])
			// }
			case Schema.LOOKUP: {
				const { targetColumnId, targetSheetId } = get(column, ["columnProps"]) || {}
				if (!targetColumnId || !targetSheetId) return []
				const columnList = get(dataTemplate, [targetSheetId, "columns"])
				if (!columnList) return []
				return getOptions(columnList, targetColumnId)
			}
			// case Schema.FORMULA: {
			// 	const value = getFormulaTargetType({
			// 		sheetId,
			// 		columnId: colId,
			// 		DataManager: {
			// 			dataSource,
			// 			dataTemplate
			// 		}
			// 	})
			// 	const { column: col, type: colType } = value
			// 	if (!col) return getOptions(null, null, colType)
			// 	return getOptions({[col.id]: col}, col.id)
			// }
			default:
				return []
		}
	}
	return getOptions(columns, condition?.column_id)
}

export const getColumnTargetType = (
	sheetId: string,
	columnId: string,
	dataTemplate: Record<string, Sheet.Detail>,
) => {
	const columns = dataTemplate[sheetId]?.content?.columns || {}

	// 这里如果是行ID的那个列，这一列不是真实存在的是定义了一个特殊的列ID
	// 只要是这个列ID 直接就是行ID{i18n.t("TYPE")}
	if (columnId === ROW_ID_COLUMN_ID) return Schema.ROW_ID
	let columnType = columns?.[columnId]?.columnType

	if ([Schema.LOOKUP, Schema.FORMULA].includes(columnType)) {
		columnType = getTargetType({
			sheetId,
			columnId,
			dataTemplate,
		})?.type
	}
	return columnType
}

/**
 *
 * @param {Object} dataTemplate 文件数据模板
 * @param {String} sheetId 子表id
 * @param {Array} notSupportType 不支持的列类型
 * @returns {
 * 	columnId,
 * 	operator,
 * 	value
 * }
 */
export const addCondition = (
	dataTemplate: Record<string, Sheet.Detail>,
	sheetId: string,
	notSupportType = [] as Schema[],
) => {
	const columns = dataTemplate[sheetId]?.content?.columns
	if (!columns) return null
	const columnIds = Object.keys(columns)

	let columnId = dataTemplate[sheetId]?.content?.primaryKey
	let columnType = columns?.[columnId].columnType
	let displayType = getColumnTargetType(sheetId, columnId, dataTemplate)
	if (notSupportType.includes(columnType)) {
		let len = 0
		while (len < columnIds.length) {
			columnType = columns[columnIds[len]].columnType
			displayType = getColumnTargetType(sheetId, columnIds[len], dataTemplate)
			if (notSupportType.includes(columnType)) len += 1
			else {
				columnId = columnIds[len]
				len = columnIds.length
			}
		}
	}
	const condition = {
		column_id: columnId,
		column_type: columnType,
		operator: AutomateFlowFieldGroup[displayType]?.conditions[0]?.id,
		value: getDefaultConstValue(),
	}
	return condition
}
