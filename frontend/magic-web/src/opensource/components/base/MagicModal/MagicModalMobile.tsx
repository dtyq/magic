import type { ModalProps, ButtonProps as AntdButtonProps } from "antd"
import { useMemo, type ReactNode, type FC } from "react"
import MagicPopup from "@/opensource/components/base-mobile/MagicPopup"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { useTranslation } from "react-i18next"
import { cn } from "@/opensource/lib/utils"
import { convertButtonProps } from "./utils"

// Footer function type for compatibility with Ant Design Modal
export type FooterRenderFunction = (
	originNode: ReactNode,
	extra: { OkBtn: FC<Record<string, never>>; CancelBtn: FC<Record<string, never>> },
) => ReactNode

export type MagicModalMobileProps = ModalProps & {
	/** Position of the popup on mobile */
	position?: "bottom" | "top" | "left" | "right"
	/** Callback when modal is closed (for compatibility with antd Modal) */
	onClose?: () => void
	/** Alias for destroyOnClose (for compatibility with antd Modal) */
	destroyOnHidden?: boolean
	classNames?: {
		header?: string
		content?: string
		title?: string
		body?: string
		footer?: string
	}
	/** Footer content or render function (supports Ant Design Modal footer function signature) */
	footer?: ReactNode | null | FooterRenderFunction
	/** Ok button props (accepts both shadcn Button and antd ButtonProps for compatibility) */
	okButtonProps?: React.ComponentProps<typeof Button> | AntdButtonProps
	/** Cancel button props (accepts both shadcn Button and antd ButtonProps for compatibility) */
	cancelButtonProps?: React.ComponentProps<typeof Button> | AntdButtonProps
	confirmLoading?: boolean
}

function MagicModalMobile({
	open,
	onCancel,
	onOk,
	onClose,
	afterClose,
	title,
	children,
	classNames,
	footer,
	okText,
	cancelText,
	okButtonProps,
	cancelButtonProps,
	confirmLoading,
	zIndex,
	position = "bottom",
	destroyOnClose = true,
	destroyOnHidden,
	closable = false,
	maskClosable,
	getContainer,
}: MagicModalMobileProps) {
	const { t } = useTranslation("interface")

	const defaultOkText = okText || t("button.confirm", { ns: "interface" })
	const defaultCancelText = cancelText || t("button.cancel", { ns: "interface" })

	const handleClose = (e?: React.MouseEvent<HTMLButtonElement>) => {
		onCancel?.(e ?? ({} as React.MouseEvent<HTMLButtonElement>))
		onClose?.()
		afterClose?.()
	}

	const renderFooter = useMemo(() => {
		if (footer === null) return null

		// Create button components for footer function
		const OkBtn: FC<Record<string, never>> = () => (
			<Button
				className="flex-[66.66%] rounded-lg"
				onClick={onOk}
				disabled={confirmLoading}
				{...convertButtonProps(okButtonProps as Record<string, unknown>)}
			>
				{confirmLoading ? "Loading..." : defaultOkText}
			</Button>
		)

		const CancelBtn: FC<Record<string, never>> = () => (
			<Button
				variant="outline"
				className="flex-[33.33%] rounded-lg"
				onClick={onCancel}
				{...convertButtonProps(cancelButtonProps as Record<string, unknown>)}
			>
				{defaultCancelText}
			</Button>
		)

		// Default footer node
		const defaultFooterNode = (
			<div className={cn("flex w-full gap-2", classNames?.footer)}>
				{onCancel && <CancelBtn />}
				{onOk && <OkBtn />}
			</div>
		)

		// If footer is a function, call it with default node and button components
		if (typeof footer === "function") {
			return footer(defaultFooterNode, { OkBtn, CancelBtn })
		}

		// If footer is provided as ReactNode, use it
		if (footer !== undefined) {
			return footer as ReactNode
		}

		// Return default footer
		return defaultFooterNode
	}, [
		footer,
		classNames?.footer,
		onOk,
		confirmLoading,
		okButtonProps,
		defaultOkText,
		onCancel,
		cancelButtonProps,
		defaultCancelText,
	])

	return (
		<MagicPopup
			visible={open}
			onClose={handleClose}
			position={position}
			zIndex={zIndex}
			destroyOnClose={destroyOnClose || destroyOnHidden}
			title={typeof title === "string" ? title : "Dialog"}
			bodyClassName={cn("rounded-t-2xl", classNames?.body)}
			maskClosable={maskClosable}
			getContainer={getContainer as HTMLElement}
		>
			{/* Header */}
			{(title || closable) && (
				<div
					className={cn(
						"flex items-center justify-between px-4 pb-3 pt-4",
						classNames?.header,
					)}
				>
					{title && (
						<div
							className={cn(
								"text-lg font-semibold text-foreground",
								classNames?.title,
							)}
						>
							{title}
						</div>
					)}
					{closable && (
						<button
							onClick={handleClose}
							className="ml-auto rounded-md p-1 hover:bg-accent"
							aria-label="Close"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<line x1="18" y1="6" x2="6" y2="18" />
								<line x1="6" y1="6" x2="18" y2="18" />
							</svg>
						</button>
					)}
				</div>
			)}

			{/* Body */}
			<div
				className={cn(
					"flex-1 overflow-auto p-4",
					(title || closable) && "pt-0",
					classNames?.content,
				)}
			>
				{children}
			</div>

			{/* Footer */}
			{renderFooter && (
				<div className={cn("flex justify-end px-4 pb-4", classNames?.footer)}>
					{renderFooter}
				</div>
			)}
		</MagicPopup>
	)
}

// Mobile doesn't support static methods (confirm, info, success, error, warning)
// These will be handled by the desktop version
MagicModalMobile.confirm = () => {
	console.warn("MagicModal.confirm is not supported on mobile")
	return {
		destroy: () => {
			// noop
		},
		update: () => {
			// noop
		},
	}
}

MagicModalMobile.info = () => {
	console.warn("MagicModal.info is not supported on mobile")
	return {
		destroy: () => {
			// noop
		},
		update: () => {
			// noop
		},
	}
}

MagicModalMobile.success = () => {
	console.warn("MagicModal.success is not supported on mobile")
	return {
		destroy: () => {
			// noop
		},
		update: () => {
			// noop
		},
	}
}

MagicModalMobile.error = () => {
	console.warn("MagicModal.error is not supported on mobile")
	return {
		destroy: () => {
			// noop
		},
		update: () => {
			// noop
		},
	}
}

MagicModalMobile.warning = () => {
	console.warn("MagicModal.warning is not supported on mobile")
	return {
		destroy: () => {
			// noop
		},
		update: () => {
			// noop
		},
	}
}

export default MagicModalMobile
