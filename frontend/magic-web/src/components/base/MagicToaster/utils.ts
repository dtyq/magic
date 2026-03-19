import { toast } from "sonner"
import type { ToastOptions, ToastType } from "./type"

/** 默认的 Toast 持续时间(毫秒) */
const DEFAULT_DURATION = 2000

class MagicToasterUtils {
	private showToast(options: string | ToastOptions, type: ToastType): string | number {
		if (typeof options === "string") return toast[type](options)

		const {
			content,
			key,
			icon,
			duration,
			onAutoClose,
			onClose,
			onDismiss,
			position,
			className,
			style,
		} = options

		const toastId = toast[type](content, {
			id: key,
			icon,
			duration: duration === 0 ? Infinity : (duration ?? DEFAULT_DURATION),
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
