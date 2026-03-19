import type { ReactNode, CSSProperties } from "react"
import type { PullToRefreshProps as AntdPullToRefreshProps } from "antd-mobile"

/**
 * MagicPullToRefresh 组件属性
 */
export interface MagicPullToRefreshProps extends Omit<AntdPullToRefreshProps, "children"> {
	/**
	 * 刷新回调函数
	 */
	onRefresh: () => Promise<void>

	/**
	 * 子元素内容
	 */
	children: ReactNode

	/**
	 * 容器高度，支持数字（px）或字符串
	 * @default "100%"
	 */
	height?: number | string

	/**
	 * 容器样式
	 */
	containerStyle?: CSSProperties

	/**
	 * 容器类名
	 */
	containerClassName?: string

	/**
	 * 刷新成功提示文案
	 */
	successText?: string

	/**
	 * 是否显示刷新成功提示
	 * @default true
	 */
	showSuccessMessage?: boolean

	/**
	 * 刷新成功回调
	 */
	onRefreshSuccess?: () => void

	/**
	 * 刷新失败回调
	 */
	onRefreshError?: (error: Error) => void
}
