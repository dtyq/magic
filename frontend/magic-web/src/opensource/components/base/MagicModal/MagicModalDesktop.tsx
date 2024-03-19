import { t as i18nT } from "i18next"
import { useTranslation } from "react-i18next"
import { useMemo, type ReactNode, type FC } from "react"
import { createRoot } from "react-dom/client"
import { CircleIcon } from "lucide-react"
import * as VisuallyHidden from "@radix-ui/react-visually-hidden"
import type { ButtonProps as AntdButtonProps } from "antd"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/opensource/components/shadcn-ui/dialog"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { cn } from "@/opensource/lib/utils"
import { convertButtonProps } from "./utils"
import { useStyles } from "./styles"
import { Modal as AntdModal } from "antd"
import ThemeProvider from "@/opensource/providers/ThemeProvider"

// Breakpoint type for responsive width (compatible with antd)
type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "xxl"

// Modal variant type for Figma design system
export type ModalVariant = "default" | "destructive"

// Modal size type for responsive design
export type ModalSize = "sm" | "md"

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
	classNames: classNamesInProp,
	zIndex = 1000,
	centered = true,
	okButtonProps,
	cancelButtonProps,
	...props
}: MagicModalDesktopProps) {
	const { t } = useTranslation("interface")

	const { styles, cx } = useStyles()

	const classNames = useMemo(
		() => ({
			...classNamesInProp,
			header: cx(styles.header, classNamesInProp?.header),
			content: cx(styles.content, classNamesInProp?.content),
			footer: cx(styles.footer, classNamesInProp?.footer),
			body: cx(styles.body, classNamesInProp?.body),
		}),
		[classNamesInProp, cx, styles.body, styles.content, styles.footer, styles.header],
	)

	// Convert button props to Ant Design format if needed
	const convertedOkButtonProps = okButtonProps
		? (convertButtonProps(okButtonProps as Record<string, unknown>) as AntdButtonProps)
		: undefined
	const convertedCancelButtonProps = cancelButtonProps
		? (convertButtonProps(cancelButtonProps as Record<string, unknown>) as AntdButtonProps)
		: undefined

	return (
		<AntdModal
			classNames={classNames}
			okText={t("button.confirm", { ns: "interface" })}
			cancelText={t("button.cancel", { ns: "interface" })}
			zIndex={zIndex}
			centered={centered}
			okButtonProps={convertedOkButtonProps}
			cancelButtonProps={convertedCancelButtonProps}
			{...props}
		/>
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
	/** Variant type for different confirmation styles (default | destructive) */
	variant?: ModalVariant
	/** Modal size (sm for mobile, md for desktop). Auto-detects if not specified. */
	size?: ModalSize
	/** Whether to show icon. When true, uses default icon for variant unless custom icon provided. */
	showIcon?: boolean
	/** Enable automatic responsive sizing (default: true) */
	autoResponsive?: boolean
}

interface ModalInstance {
	destroy: () => void
	update: (config: ModalFuncProps) => void
}

// Helper function to detect mobile without hooks (for imperative modals)
function detectMobileDevice(): boolean {
	if (typeof window === "undefined") return false
	// Check window width - ahooks useResponsive uses 768px for md breakpoint
	return window.innerWidth < 768
}

// Get default icon for variant
function getDefaultIconForVariant(variant: ModalVariant): ReactNode {
	if (variant === "destructive") {
		return (
			<div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10">
				<CircleIcon className="size-6 text-destructive" />
			</div>
		)
	}
	return (
		<div className="flex size-10 items-center justify-center rounded-lg bg-muted">
			<CircleIcon className="size-6 text-foreground" />
		</div>
	)
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
			icon,
			okButtonProps,
			cancelButtonProps,
			className,
			width,
			zIndex,
			closable = true,
			maskClosable = true,
			footer,
			variant = "default",
			size,
			showIcon = false,
			autoResponsive = true,
		} = props

		// Determine effective size (auto-detect if not specified and autoResponsive is true)
		const isMobile = detectMobileDevice()
		const effectiveSize: ModalSize = size ?? (autoResponsive && isMobile ? "sm" : "md")

		// Width mapping based on size
		const sizeWidthMap: Record<ModalSize, string> = {
			sm: "320px",
			md: "384px",
		}

		// Determine icon to display
		let displayIcon: ReactNode = null
		if (icon !== undefined) {
			// Custom icon provided
			displayIcon = icon
		} else if (showIcon) {
			// Use default icon for variant
			displayIcon = getDefaultIconForVariant(variant)
		}

		// Normalize width (prefer size-based width over custom width)
		const normalizedWidth =
			typeof width === "number"
				? `${width}px`
				: typeof width === "string"
					? width
					: sizeWidthMap[effectiveSize]

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
		const OkBtn: FC<Record<string, never>> = () => {
			const buttonVariant = variant === "destructive" ? "destructive" : "default"
			const buttonSize = effectiveSize === "sm" ? "sm" : "default"

			return (
				<Button
					onClick={handleOk}
					variant={buttonVariant}
					size={buttonSize}
					className={cn(
						effectiveSize === "sm" && "flex-1",
						type === "confirm" &&
							variant === "destructive" &&
							"bg-destructive/10 text-destructive hover:bg-destructive/20",
					)}
					{...convertButtonProps(okButtonProps as Record<string, unknown>)}
				>
					{okText}
				</Button>
			)
		}

		const CancelBtn: FC<Record<string, never>> = () => (
			<Button
				variant="outline"
				size="sm"
				className={cn(effectiveSize === "sm" && "flex-1")}
				onClick={handleCancel}
				{...convertButtonProps(cancelButtonProps as Record<string, unknown>)}
			>
				{cancelText}
			</Button>
		)

		// Default footer node with responsive layout
		const defaultFooterNode = (
			<div
				className={cn(
					"flex items-center gap-2 border-t border-border bg-muted/50 p-4",
					effectiveSize === "sm"
						? "flex-row justify-stretch" // Mobile: full width buttons in row
						: "flex-row justify-end", // Desktop: right-aligned
					classNames?.footer,
				)}
			>
				<CancelBtn />
				<OkBtn />
			</div>
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
			<ThemeProvider>
				<Dialog open={true} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
					<DialogContent
						className={cn("gap-0 p-0", "z-dialog", classNames?.content, className)}
						overlayClassName={cn(`z-dialog`)}
						overlayStyle={{ zIndex }}
						style={{ width: normalizedWidth, zIndex }}
						showCloseButton={
							typeof closable === "boolean" ? closable : !closable?.disabled
						}
						onPointerDownOutside={(event) => {
							if (!maskClosable) {
								event.preventDefault()
							}
						}}
					>
						{/* Header/Content Section */}
						<div className="px-4 py-8 pb-4">
							<div
								className={cn(
									"flex gap-3.5",
									effectiveSize === "sm" &&
										displayIcon &&
										"flex-col items-center",
								)}
							>
								{displayIcon && <div className="shrink-0">{displayIcon}</div>}
								<div
									className={cn(
										"flex-1 space-y-1.5",
										effectiveSize === "sm" && "w-full",
									)}
								>
									<div
										className={cn(
											classNames?.header,
											effectiveSize === "sm" && displayIcon && "text-center",
										)}
									>
										{title ? (
											<DialogTitle
												className={cn(
													"text-base font-semibold text-foreground",
													classNames?.title,
												)}
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
											className={cn(
												"text-sm text-muted-foreground",
												effectiveSize === "sm" &&
													displayIcon &&
													"text-center",
												classNames?.body,
											)}
										>
											{content}
										</DialogDescription>
									)}
								</div>
							</div>
						</div>
						{/* Footer Section */}
						{footerNode}
					</DialogContent>
				</Dialog>
			</ThemeProvider>,
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
