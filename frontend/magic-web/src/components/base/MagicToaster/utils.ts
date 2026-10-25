import { toast } from "sonner"
import { createElement } from "react"
import type { ToastOptions, ToastType } from "./type"

/** 默认的 Toast 持续时间(毫秒) */
const DEFAULT_DURATION = 2000

class MagicToasterUtils {
	private showToast(options: string | ToastOptions, type: ToastType): string | number {
		const isString = typeof options === "string"

		const {
			content,
			description,
			closeButton,
			key,
			icon,
			duration,
			dismissible,
			onAutoClose,
			onClose,
			onDismiss,
			position,
			className,
			style,
		} = isString ? { content: options } : options

		// 只包装标题中的纯文本，说明中的链接、按钮及复杂内容仍由调用方负责。
		// 通过 Sonner 的 dismiss 路径关闭，onDismiss/onClose 由 Sonner 触发一次。
		const title =
			type !== "loading" && dismissible !== false && typeof content === "string"
				? createElement(
						"button",
						{
							type: "button",
							className:
								"block w-full cursor-pointer rounded-sm border-0 bg-transparent p-0 text-start [font:inherit] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
							onClick: () => toast.dismiss(toastId),
						},
						content,
					)
				: content

		const toastId = toast[type](title, {
			id: key,
			description,
			closeButton,
			icon,
			// 字符串沿用 Sonner 默认时长；对象保留原有 2 秒及 0 表示常驻的契约。
			duration: isString
				? undefined
				: duration === 0
					? Infinity
					: (duration ?? DEFAULT_DURATION),
			dismissible,
			onAutoClose: onAutoClose ?? onClose,
			onDismiss: onDismiss ?? onClose,
			position,
			className,
			style,
		})
		// sonner 的 loading 类型 toast 默认不会自动关闭（即使传入 duration 参数）
		// 这里手动处理 duration 参数以支持自动关闭场景
		if (type === "loading" && duration && duration > 0) {
			setTimeout(() => {
				toast.dismiss(toastId)
			}, duration)
		}
		return toastId
	}

	success(message: string | ToastOptions): string | number {
		return this.showToast(message, "success")
	}

	info(message: string | ToastOptions): string | number {
		return this.showToast(message, "info")
	}

	warning(message: string | ToastOptions): string | number {
		return this.showToast(message, "warning")
	}

	error(message: string | ToastOptions): string | number {
		return this.showToast(message, "error")
	}

	loading(message: string | ToastOptions): string | number {
		return this.showToast(message, "loading")
	}

	destroy(toastId?: string | number) {
		toast.dismiss(toastId)
	}
}

const magicToast = new MagicToasterUtils()

export default magicToast
