import React from "react"

/**
 * 代码渲染组件的props
 */
export interface CodeRenderProps {
	/**
	 * 代码类型
	 */
	language?: string
	/**
	 * 代码数据
	 */
	data?: string
	/**
	 * 是否正在流式
	 */
	isStreaming?: boolean
	/**
	 * 代码的className
	 */
	className?: string
}

/**
 * 行内代码渲染组件的props
 */
export interface InlineCodeRenderProps<D extends object = object> {
	/**
	 * 代码类型
	 */
	language?: string
	/**
	 * 代码数据
	 */
	data?: string
	/**
	 * 解析后的数据
	 */
	parsedData?: D
	/**
	 * 行内代码的className
	 */
	className?: string
	/**
	 * 是否正在流式
	 */
	isStreaming?: boolean
}

/**
 * 代码渲染组件
 */
export interface RenderComponent<Props> {
	componentType: string
	propsParser?: (props: Props) => unknown
	matchFn?: (props: Props) => boolean
	loader: () => Promise<{
		default: React.ComponentType<Props> | React.MemoExoticComponent<React.ComponentType<Props>>
	}>
}
