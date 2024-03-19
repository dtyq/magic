import { DataSourceOption } from "@/common/BaseUI/DropdownRenderer/Reference"
import type { PropsWithChildren } from "react"
import React, { useMemo } from "react"
import { ExpressionMode } from "../../constant"
import { ExpressionSource, InputExpressionProps, RenderConfig } from "../../types"
import { GlobalContext } from "./Context"

export type GlobalContextProviderProps = {
	dataSource: ExpressionSource
	allowExpression: boolean
	setAllowExpressionGlobal: React.Dispatch<React.SetStateAction<boolean>>
	mode: ExpressionMode
	dataSourceMap: Record<string, DataSourceOption>
	showMultipleLine: boolean
	disabled: boolean
	zoom: number
	renderConfig?: RenderConfig
	encryption: boolean
	hasEncryptionValue: boolean
	rawProps: InputExpressionProps
	selectPanelOpen: boolean
	isInFlow: boolean
}

export const GlobalProvider = ({
	dataSource,
	allowExpression,
	setAllowExpressionGlobal,
	mode,
	dataSourceMap,
	showMultipleLine,
	disabled,
	zoom,
	renderConfig,
	encryption,
	hasEncryptionValue,
	rawProps,
	selectPanelOpen,
	isInFlow,
	children,
}: PropsWithChildren<GlobalContextProviderProps>) => {
	const value = useMemo(() => {
		return {
			dataSource,
			allowExpression,
			setAllowExpressionGlobal,
			dataSourceMap,
			showMultipleLine,
			disabled,
			mode,
			zoom,
			renderConfig,
			encryption,
			hasEncryptionValue,
			rawProps,
			selectPanelOpen,
			isInFlow,
		}
	}, [
		dataSource,
		allowExpression,
		setAllowExpressionGlobal,
		mode,
		showMultipleLine,
		disabled,
		zoom,
		renderConfig,
		encryption,
		hasEncryptionValue,
		rawProps,
		selectPanelOpen,
		isInFlow,
	])

	return <GlobalContext.Provider value={value}>{children}</GlobalContext.Provider>
}
