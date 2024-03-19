import type { ExternalToast } from "sonner"

export interface ToastOptions {
	/** 显示的内容 */
	content: string | (() => React.ReactNode) | React.ReactNode
	/** 唯一标识，用于关闭 Toast */
	key?: string | number
	/** 持续时间，单位：毫秒 */
	duration?: number
	/** 图标 */
	icon?: React.ReactNode
	/** 关闭回调 */
	onClose?: () => void
	/** 自动关闭回调 */
	onAutoClose?: () => void
	/** 关闭回调 */
	onDismiss?: () => void
	/** 单条 toast 的位置，覆盖 Toaster 全局默认值 */
	position?: ExternalToast["position"]
	/** 单条 toast 的自定义 className */
	className?: string
	/** 单条 toast 的自定义内联样式 */
	style?: React.CSSProperties
}

export type ToastType = "success" | "info" | "warning" | "error" | "loading"
