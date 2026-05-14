import { Check, X } from "lucide-react"
import { useState } from "react"

import MagicPopup from "@/components/base-mobile/MagicPopup"

export interface MobileLogoutConfirmPopupProps {
	title: string
	description: string
	cancelAriaLabel: string
	confirmAriaLabel: string
	onConfirm: () => Promise<void> | void
	onCancel?: () => void
	onClose?: () => void
}

/** 移动端退出确认采用轻量底部抽屉，保持与新设置页和旧移动端菜单一致的确认体验。 */
export function MobileLogoutConfirmPopup(props: MobileLogoutConfirmPopupProps) {
	const { title, description, cancelAriaLabel, confirmAriaLabel, onConfirm, onCancel, onClose } =
		props
	const [open, setOpen] = useState(true)
	const [isSubmitting, setIsSubmitting] = useState(false)

	/** 统一关闭抽屉并透传取消回调，避免遮罩、左上角关闭与手势关闭产生分叉。 */
	function closePopup(triggerCancel: boolean) {
		setOpen(false)
		if (triggerCancel) {
			onCancel?.()
		}
		onClose?.()
	}

	/** 确认后立即收起抽屉，再串行执行原有退出链路，避免用户重复点击红色确认按钮。 */
	async function handleConfirm() {
		if (isSubmitting) return

		setIsSubmitting(true)
		setOpen(false)
		onClose?.()

		try {
			await onConfirm()
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<MagicPopup
			visible={open}
			onClose={() => closePopup(true)}
			destroyOnClose
			headerVariant="actionHeader"
			headerTitle={title}
			headerLeadingAction={{
				icon: <X className="h-5 w-5" />,
				ariaLabel: cancelAriaLabel,
				onClick: () => closePopup(true),
				disabled: isSubmitting,
				testId: "mobile-logout-confirm-cancel",
			}}
			headerTrailingAction={{
				icon: <Check className="h-5 w-5" strokeWidth={2.5} />,
				ariaLabel: confirmAriaLabel,
				onClick: () => {
					void handleConfirm()
				},
				disabled: isSubmitting,
				tone: "destructive",
				testId: "mobile-logout-confirm-submit",
			}}
			title={title}
			bodyClassName="rounded-t-[28px]"
		>
			<div className="px-5 pb-[calc(var(--safe-area-inset-bottom)+1.25rem)] pt-3 text-sm leading-6 text-muted-foreground">
				{description}
			</div>
		</MagicPopup>
	)
}

export default MobileLogoutConfirmPopup
