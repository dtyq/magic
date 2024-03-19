import Schema from "@/MagicJsonSchemaEditor/types/Schema"
import SchemaDescription from "@/MagicJsonSchemaEditor/types/SchemaDescription"
import { useUpdateEffect } from "ahooks"
import _ from "lodash"
import type { PropsWithChildren } from "react"
import React, { useMemo, useState } from "react"

export const ExportFieldsContext = React.createContext({
	exportFields: new SchemaDescription(), // 需要导出的字段列表
	showExportCheckbox: false, // 是否显示导出列
	setShowExportCheckbox: (() => {}) as React.Dispatch<React.SetStateAction<boolean>>,
})

export const ExportFieldsProvider = ({
	defaultExportFields,
	children,
}: PropsWithChildren<{
	defaultExportFields: Schema
}>) => {
	const [exportFields, setExportFields] = useState(
		new SchemaDescription({...defaultExportFields}),
	)
	useUpdateEffect(() => {
		setExportFields(new SchemaDescription({ ...defaultExportFields }))
	}, [defaultExportFields])

	/** 是否需要打开导出选项 */
	const [showExportCheckbox, setShowExportCheckbox] = useState(false)

	// console.log("EXPORT_FEIDLS", JSON.parse(JSON.stringify(exportFields.schema)))

	const value = useMemo(() => {
		return {
			exportFields,
			showExportCheckbox,
			setShowExportCheckbox,
		}
	}, [exportFields, showExportCheckbox, setShowExportCheckbox])

	return <ExportFieldsContext.Provider value={value}>{children}</ExportFieldsContext.Provider>
}
