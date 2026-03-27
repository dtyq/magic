import type { ReactNode, CSSProperties } from "react"

// ActionsPopup 命名空间
export namespace ActionsPopup {
	// Base interfaces
	export interface BaseComponentProps {
		className?: string
		style?: CSSProperties
		children?: ReactNode
	}

	// Action button interfaces
	export interface ActionButtonConfig {
		/** 按钮唯一标识 */
		key: string
		/** 按钮文本 */
		label: string
		/** 点击回调 */
		onClick?: () => void
		/** 按钮类型 */
		variant?: "default" | "danger"
		/** 是否禁用 */
		disabled?: boolean
		/** Stable selector for tests */
		"data-testid"?: string
	}

	// ActionsPopup specific interfaces
	export interface Props extends BaseComponentProps {
		/** 是否显示弹窗 */
		visible: boolean
		/** 标题 */
		title: string
		/** 操作按钮列表 */
		actions: ActionButtonConfig[]
		/** 关闭弹窗回调 */
		onClose?: () => void
		/** 是否显示取消按钮 */
		showCancel?: boolean
		/** 取消按钮文本 */
		cancelText?: string
	}

	// Action button props for internal component
	export interface ActionButtonProps {
		label: string
		onClick?: () => void
		variant?: "default" | "danger"
		disabled?: boolean
	}

	// Component state interfaces
	export interface State {
		visible: boolean
	}
}

// 为了向后兼容，导出别名
export type ActionsPopupProps = ActionsPopup.Props
export type ActionButtonConfig = ActionsPopup.ActionButtonConfig
export type ActionButtonProps = ActionsPopup.ActionButtonProps
