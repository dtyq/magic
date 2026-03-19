import { t as i18nT } from "i18next"
import { useTranslation } from "react-i18next"
import { useMemo, type ReactNode, type FC } from "react"
import { createRoot } from "react-dom/client"
import { InfoIcon, CheckCircleIcon, XCircleIcon, AlertTriangleIcon } from "lucide-react"
import * as VisuallyHidden from "@radix-ui/react-visually-hidden"
import type { ButtonProps as AntdButtonProps } from "antd"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import { isUndefined } from "lodash-es"
import { convertButtonProps } from "./utils"

// Breakpoint type for responsive width (compatible with antd)
type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "xxl"

// Footer function type for compatibility with Ant Design Modal
export type FooterRenderFunction = (
	originNode: ReactNode,
	extra: { OkBtn: FC<Record<string, never>>; CancelBtn: FC<Record<string, never>> },
) => ReactNode

export interface MagicModalDesktopProps {
	open?: boolean
	onCancel?: (e: React.MouseEvent<HTMLButtonElement>) => void
	onOk?: (e: React.MouseEvent<HTMLButtonElement>) => void
	/** Callback when modal is closed (for compatibility with antd Modal) */
	onClose?: () => void
	title?: ReactNode
	/** Footer content or render function (supports Ant Design Modal footer function signature) */
	footer?: ReactNode | null | FooterRenderFunction
	children?: ReactNode
	className?: string
	classNames?: {
		header?: string
		content?: string
		title?: string
		body?: string
		footer?: string
	}
	/** Width of modal (supports responsive width object for antd compatibility) */
	width?: number | string | Partial<Record<Breakpoint, string | number>>
	/** Control close icon visibility (supports boolean or antd object format) */
	closable?: boolean | { closeIcon?: ReactNode; disabled?: boolean }
	maskClosable?: boolean
	closeIcon?: ReactNode
	okText?: ReactNode
	cancelText?: ReactNode
	/** Ok button props (accepts both shadcn Button and antd ButtonProps for compatibility) */
	okButtonProps?: React.ComponentProps<typeof Button> | AntdButtonProps
	/** Cancel button props (accepts both shadcn Button and antd ButtonProps for compatibility) */
	cancelButtonProps?: React.ComponentProps<typeof Button> | AntdButtonProps
	centered?: boolean
	zIndex?: number
	destroyOnClose?: boolean
	/** Alias for destroyOnClose (for compatibility with antd Modal) */
	destroyOnHidden?: boolean
	confirmLoading?: boolean
}

function MagicModalDesktop({
	open = false,
	onCancel,
	onOk,
	onClose,
	title,
	footer,
	children,
	className,
	classNames,
	width = 520,
	closable = true,
	maskClosable = true,
	closeIcon,
	okText,
	cancelText,
	okButtonProps,
	cancelButtonProps,
	confirmLoading,
	zIndex,
}: MagicModalDesktopProps) {
	const { t } = useTranslation("interface")

	const defaultOkText = okText || t("button.confirm", { ns: "interface" })
	const defaultCancelText = cancelText || t("button.cancel", { ns: "interface" })

	// Handle onClose callback
	const handleClose = (e?: React.MouseEvent<HTMLButtonElement>) => {
		onCancel?.(e ?? ({} as React.MouseEvent<HTMLButtonElement>))
		onClose?.()
	}

	const renderFooter = useMemo(() => {
		if (footer === null) return null

		// Create button components for footer function
		const OkBtn: FC<Record<string, never>> = () => (
			<Button
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
				onClick={onCancel}
				{...convertButtonProps(cancelButtonProps as Record<string, unknown>)}
			>
				{defaultCancelText}
			</Button>
		)

		// Default footer node
		const defaultFooterNode = (
			<DialogFooter className={cn("gap-2", classNames?.footer)}>
				<CancelBtn />
				<OkBtn />
			</DialogFooter>
		)

		// If footer is a function, call it with default node and button components
		if (typeof footer === "function") {
			return footer(defaultFooterNode, { OkBtn, CancelBtn })
		}

		// If footer is provided as ReactNode, use it
		if (footer !== undefined) {
			return footer
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

	// Normalize width to string (ignore responsive object for now)
	const normalizedWidth = useMemo(() => {
		if (typeof width === "number") return `${width}px`
		if (typeof width === "string") return width
		// If width is an object (responsive), use default width
		return "520px"
	}, [width])

	// Normalize closable prop (handle both boolean and object format)
	const isClosable = useMemo(() => {
		if (typeof closable === "boolean") return closable
		if (closable && typeof closable === "object") {
			return !closable.disabled
		}
		return true
	}, [closable])

	return (
		<Dialog
			open={open}
			onOpenChange={(isOpen) => {
				if (!isOpen) {
					handleClose()
				}
			}}
		>
			<DialogContent
				className={cn(
					"max-w-none gap-0 border-none p-0 sm:max-w-none",
					"[&>button[data-slot='dialog-close']]:outline-none [&>button[data-slot='dialog-close']]:ring-0",
					`z-dialog`,
					classNames?.content,
					className,
				)}
				overlayClassName={cn("z-dialog")}
				overlayStyle={{ zIndex }}
				style={{ width: normalizedWidth, zIndex }}
				showCloseButton={isClosable && isUndefined(closeIcon)}
				onPointerDownOutside={(e) => {
					// Always stop propagation to prevent nested modal issues
					e.stopPropagation()
					if (!maskClosable) {
						e.preventDefault()
					}
				}}
				onEscapeKeyDown={(e) => {
					// Always stop propagation to prevent closing multiple modals
					e.stopPropagation()
					if (!maskClosable) {
						e.preventDefault()
					}
				}}
			>
				{title ? (
					<DialogHeader
						className={cn(
							"border-b border-border px-5 py-2.5",
							classNames?.header,
							"magic-modal-header",
						)}
					>
						<DialogTitle
							className={cn(
								"text-base font-semibold leading-[22px]",
								classNames?.title,
								"magic-modal-title",
							)}
						>
							{title}
						</DialogTitle>
					</DialogHeader>
				) : (
					<VisuallyHidden.Root>
						<DialogTitle>Dialog</DialogTitle>
					</VisuallyHidden.Root>
				)}
				<div className={cn(classNames?.body, "magic-modal-body")}>{children}</div>
				{renderFooter && (
					<div
						className={cn(
							"border-t border-border px-5 py-2",
							classNames?.footer,
							"magic-modal-footer",
						)}
					>
						{renderFooter}
					</div>
				)}
			</DialogContent>
		</Dialog>
	)
}

// Static method types
export interface ModalFuncProps {
	title?: ReactNode
	content?: ReactNode
	okText?: ReactNode
	cancelText?: ReactNode
	onOk?: () => void | Promise<void>
	onCancel?: () => void
	icon?: ReactNode
	classNames?: {
		header?: string
		body?: string
		title?: string
		content?: string
		footer?: string
	}
	okButtonProps?: React.ComponentProps<typeof Button> | AntdButtonProps
	cancelButtonProps?: React.ComponentProps<typeof Button> | AntdButtonProps
	className?: string
	width?: number | string | Partial<Record<Breakpoint, string | number>>
	zIndex?: number
	/** For compatibility with antd Modal (currently has no effect as Dialog is always centered) */
	centered?: boolean
	/** Control close icon visibility */
	closable?: boolean | { closeIcon?: ReactNode; disabled?: boolean }
	/** Whether click mask to close modal */
	maskClosable?: boolean
	footer?: ReactNode | null | FooterRenderFunction
}

interface ModalInstance {
	destroy: () => void
	update: (config: ModalFuncProps) => void
}

// Helper to create imperative modals
function createImperativeModal(
	config: ModalFuncProps,
	type: "info" | "success" | "error" | "warning" | "confirm",
): ModalInstance {
	const container = document.createElement("div")
	document.body.appendChild(container)
	const root = createRoot(container)

	let currentConfig = { ...config }

	const defaultIcon = {
		info: <InfoIcon className="size-6 text-blue-500" />,
		success: <CheckCircleIcon className="size-6 text-green-500" />,
		error: <XCircleIcon className="size-6 text-red-500" />,
		warning: <AlertTriangleIcon className="size-6 text-yellow-500" />,
		confirm: <InfoIcon className="size-6 text-blue-500" />,
	}

	const destroy = () => {
		root.unmount()
		if (container.parentNode) {
			container.parentNode.removeChild(container)
		}
	}

	const render = (props: ModalFuncProps) => {
		const {
			title,
			content,
			okText = i18nT("common.confirm", { ns: "interface" }),
			cancelText = i18nT("common.cancel", { ns: "interface" }),
			onOk,
			onCancel,
			classNames,
			icon = defaultIcon[type],
			okButtonProps,
			cancelButtonProps,
			className,
			width,
			zIndex,
			closable = true,
			maskClosable = true,
			footer,
		} = props

		// Normalize width
		const normalizedWidth =
			typeof width === "number" ? `${width}px` : typeof width === "string" ? width : "416px"

		const handleOk = async () => {
			if (onOk) {
				const result = onOk()
				if (result instanceof Promise) {
					await result
				}
			}
			destroy()
		}

		const handleCancel = () => {
			onCancel?.()
			destroy()
		}

		// Create button components for footer function
		const OkBtn: FC<Record<string, never>> = () => (
			<Button
				onClick={handleOk}
				{...convertButtonProps(okButtonProps as Record<string, unknown>)}
			>
				{okText}
			</Button>
		)

		const CancelBtn: FC<Record<string, never>> = () => (
			<Button
				variant="outline"
				onClick={handleCancel}
				{...convertButtonProps(cancelButtonProps as Record<string, unknown>)}
			>
				{cancelText}
			</Button>
		)

		// Default footer node
		const defaultFooterNode = (
			<DialogFooter
				className={cn(
					"flex flex-row items-center justify-end gap-2 sm:gap-2",
					classNames?.footer,
				)}
			>
				{type === "confirm" && <CancelBtn />}
				<OkBtn />
			</DialogFooter>
		)

		// Render footer based on type
		let footerNode: ReactNode
		if (footer === null) {
			footerNode = null
		} else if (typeof footer === "function") {
			footerNode = footer(defaultFooterNode, { OkBtn, CancelBtn })
		} else if (footer !== undefined) {
			footerNode = footer
		} else {
			footerNode = defaultFooterNode
		}

		root.render(
			<Dialog
				open={true}
				onOpenChange={(isOpen) => !isOpen && maskClosable && handleCancel()}
			>
				<DialogContent
					className={cn("gap-0 p-3", "z-dialog", classNames?.content, className)}
					overlayClassName={cn(`z-dialog`)}
					overlayStyle={{ zIndex }}
					style={{ width: normalizedWidth, zIndex }}
					showCloseButton={typeof closable === "boolean" ? closable : !closable?.disabled}
				>
					<div className="flex gap-3">
						{icon && <div className="mt-0.5 shrink-0">{icon}</div>}
						<div className="flex-1 space-y-3">
							<div className={cn(classNames?.header)}>
								{title ? (
									<DialogTitle
										className={cn("text-base font-semibold", classNames?.title)}
									>
										{title}
									</DialogTitle>
								) : (
									<VisuallyHidden.Root>
										<DialogTitle>Dialog</DialogTitle>
									</VisuallyHidden.Root>
								)}
							</div>
							{content && (
								<DialogDescription
									className={cn("text-sm text-foreground", classNames?.body)}
								>
									{content}
								</DialogDescription>
							)}
							{footerNode}
						</div>
					</div>
				</DialogContent>
			</Dialog>,
		)
	}

	render(currentConfig)

	return {
		destroy,
		update: (newConfig: ModalFuncProps) => {
			currentConfig = { ...currentConfig, ...newConfig }
			render(currentConfig)
		},
	}
}

// Static methods
MagicModalDesktop.confirm = (config: ModalFuncProps) => {
	return createImperativeModal(config, "confirm")
}

MagicModalDesktop.info = (config: ModalFuncProps) => {
	return createImperativeModal(config, "info")
}

MagicModalDesktop.success = (config: ModalFuncProps) => {
	return createImperativeModal(config, "success")
}

MagicModalDesktop.error = (config: ModalFuncProps) => {
	return createImperativeModal(config, "error")
}

MagicModalDesktop.warning = (config: ModalFuncProps) => {
	return createImperativeModal(config, "warning")
}

export default MagicModalDesktop
