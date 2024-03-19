import React from "react"
import {
	ExternalContext,
	ExternalUIContext,
	ExternalConfigContext,
	ExternalRefContext
} from "./Context"

/**
 * 获取完整的External上下文（向后兼容）
 */
export const useExternal = () => {
	return React.useContext(ExternalContext)
}

/**
 * 只获取UI相关的上下文，当UI更新时才会触发重新渲染
 * 适用于只依赖UI部分的组件，如Header、Toolbar等
 */
export const useExternalUI = () => {
	return React.useContext(ExternalUIContext)
}

/**
 * 只获取配置相关的上下文，当配置更新时才会触发重新渲染
 * 适用于依赖配置项的组件，如Node、Edge等
 */
export const useExternalConfig = () => {
	return React.useContext(ExternalConfigContext)
}

/**
 * 只获取引用相关的上下文，引用几乎不会更新
 * 适用于需要访问外部引用的组件
 */
export const useExternalRef = () => {
	return React.useContext(ExternalRefContext)
}

/**
 * 选择性地获取External上下文的某些字段
 * @param selector 选择器函数，从上下文中选择需要的字段
 * @returns 选择的字段
 */
export function useExternalSelector<Selected>(
	selector: (state: React.ContextType<typeof ExternalContext>) => Selected
) {
	const context = React.useContext(ExternalContext)
	return selector(context)
}
