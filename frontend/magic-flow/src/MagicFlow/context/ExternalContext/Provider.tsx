/**
 * 业务组件传入相关的自定义props
 */
import React, { useMemo } from "react"
import {
	ExternalContext,
	ExternalCtx,
	ExternalUIContext,
	ExternalConfigContext,
	ExternalRefContext,
} from "./Context"

export const ExternalProvider = ({
	header,
	nodeToolbar,
	materialHeader,
	paramsName,
	onlyRenderVisibleElements,
	layoutOnMount,
	allowDebug,
	showExtraFlowInfo,
	flowInteractionRef,
	omitNodeKeys,
	children,
}: ExternalCtx) => {
	// UI相关属性，可能频繁变化
	const uiValue = useMemo(() => {
		return {
			header,
			nodeToolbar,
			materialHeader,
		}
	}, [header, nodeToolbar, materialHeader])

	// 配置相关属性，不太可能频繁变化
	const configValue = useMemo(() => {
		return {
			paramsName,
			onlyRenderVisibleElements,
			layoutOnMount,
			allowDebug,
			showExtraFlowInfo,
			omitNodeKeys,
		}
	}, [
		paramsName,
		onlyRenderVisibleElements,
		layoutOnMount,
		allowDebug,
		showExtraFlowInfo,
		omitNodeKeys,
	])

	// 引用相关属性，几乎不会变化
	const refValue = useMemo(() => {
		return {
			flowInteractionRef,
		}
	}, [flowInteractionRef])

	// 完整的Context值（向后兼容）
	const fullValue = useMemo(() => {
		return {
			...uiValue,
			...configValue,
			...refValue,
		}
	}, [uiValue, configValue, refValue])

	return (
		<ExternalRefContext.Provider value={refValue}>
			<ExternalConfigContext.Provider value={configValue}>
				<ExternalUIContext.Provider value={uiValue}>
					<ExternalContext.Provider value={fullValue}>
						{children}
					</ExternalContext.Provider>
				</ExternalUIContext.Provider>
			</ExternalConfigContext.Provider>
		</ExternalRefContext.Provider>
	)
}
