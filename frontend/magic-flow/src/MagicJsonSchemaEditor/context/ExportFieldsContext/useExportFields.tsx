import React from "react"
import { ExportFieldsContext } from "./Provider"

export const useExportFields = () => {
	return React.useContext(ExportFieldsContext)
}
