/* eslint-disable no-unused-vars */
import { DataSourceOption } from "@/common/BaseUI/DropdownRenderer/Reference"
import React from "react"
import { ExpressionMode } from "../../constant"
import { ExpressionSource } from "../../types"
import type { GlobalContextProviderProps } from "./Provider"

export const GlobalContext = React.createContext({
	dataSource: [] as ExpressionSource,
	allowExpression: true,
	setAllowExpressionGlobal: (() => {}) as React.Dispatch<React.SetStateAction<boolean>>,
	mode: ExpressionMode.Common,
	disabled: false,
	dataSourceMap: {} as Record<string, DataSourceOption>,
	showMultipleLine: true,
	isInFlow: true,
} as GlobalContextProviderProps)
