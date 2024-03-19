import { ExpressionSource } from "@/MagicExpressionWidget/types"
import { CustomFieldsConfig } from "@/MagicJsonSchemaEditor/types/Schema"
import type { PropsWithChildren } from "react"
import React, { useMemo } from "react"
import { AppendPosition, ShowColumns } from "../../constants"
import { Common } from "../../types/Common"
import { GlobalContext } from "./Context"

export type GlobalContextProviderProps = {
	allowOperation: boolean
	allowAdd?: boolean
	showAdd?: boolean
	disableFields: string[]
	relativeAppendPosition: AppendPosition
	innerExpressionSourceMap: Record<string, Common.Options>
	allowSourceInjectBySelf: boolean
	contextExpressionSource?: ExpressionSource
	uniqueFormId?: string
	displayColumns?: ShowColumns[]
	columnNames: Record<Partial<ShowColumns>, string>
	customFieldsConfig?: CustomFieldsConfig
	onlyExpression?: boolean
	showImport?: boolean
	showTopRow?: boolean
	showOperation?: boolean
}

export const GlobalProvider = ({
	allowOperation,
	disableFields,
	allowAdd,
	showAdd,
	relativeAppendPosition,
	innerExpressionSourceMap,
	allowSourceInjectBySelf,
	contextExpressionSource,
	uniqueFormId,
	displayColumns,
	columnNames,
	customFieldsConfig,
	onlyExpression,
	showImport,
	showTopRow,
	showOperation,
	children,
}: PropsWithChildren<GlobalContextProviderProps>) => {
	const value = useMemo(() => {
		return {
			allowOperation,
			disableFields,
			allowAdd,
			showAdd,
			relativeAppendPosition,
			innerExpressionSourceMap,
			allowSourceInjectBySelf,
			contextExpressionSource,
			uniqueFormId,
			displayColumns,
			columnNames,
			customFieldsConfig,
			onlyExpression,
			showImport,
			showTopRow,
			showOperation,
		}
	}, [
		allowOperation,
		disableFields,
		allowAdd,
		showAdd,
		relativeAppendPosition,
		innerExpressionSourceMap,
		allowSourceInjectBySelf,
		contextExpressionSource,
		uniqueFormId,
		displayColumns,
		columnNames,
		customFieldsConfig,
		onlyExpression,
		showImport,
		showTopRow,
		showOperation,
	])

	return <GlobalContext.Provider value={value}>{children}</GlobalContext.Provider>
}
