import { Check, X } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/shadcn-ui/button"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { cn } from "@/lib/utils"
import type { OverlayZIndexScope } from "@/utils/overlayZIndex/overlayStackManager"

import {
	MOBILE_SETTINGS_HEADER_ICON_BUTTON_CLASSNAME,
	MOBILE_SETTINGS_SHEET_Z_INDEX,
} from "../constants"

/** 统一设置浮层头部的圆形图标按钮，避免关闭与确认入口重复维护定位、尺寸和阴影。 */
function MobileSettingsHeaderIconButton(props: {
	side: "left" | "right"
	ariaLabel: string
	onClick: () => void
	variant?: "surface" | "primary"
	disabled?: boolean
	children: React.ReactNode
}) {
	const { side, ariaLabel, onClick, variant = "surface", disabled = false, children } = props

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			onClick={onClick}
			disabled={disabled}
			className={cn(
				MOBILE_SETTINGS_HEADER_ICON_BUTTON_CLASSNAME,
				side === "left" ? "left-2.5" : "right-2.5",
				variant === "primary" ? "bg-foreground text-background" : "bg-card text-foreground",
			)}
			aria-label={ariaLabel}
		>
			{children}
		</Button>
	)
}

/**
 * 统一渲染设置主浮层和二级浮层的底部 Sheet 外壳。
 * 内部使用 MagicPopup（vaul Drawer）替代 shadcn Sheet，
 * 获得更好的移动端拖拽手势、iOS 滚动锁定和统一的弹层层级管理。
 */
export function MobileSettingsSheetContainer(props: {
	open: boolean
	title: string
	onOpenChange: (open: boolean) => void
	onCloseClick?: () => void
	onConfirm?: () => void
	confirmAriaLabel?: string
	confirmDisabled?: boolean
	hideCloseButton?: boolean
	headerAction?: React.ReactNode
	sheetClassName?: string
	overlayClassName?: string
	zIndex?: number
	zIndexScope?: OverlayZIndexScope
	zIndexManaged?: boolean
	contentClassName?: string
	/**
	 * 兼容保留：vaul Drawer 的遮罩点击已基于 z-index 分层处理，
	 * 高层级 Portal（如付费弹窗）不会触发底层 Drawer 的关闭，
	 * 因此该属性在 MagicPopup 下通常无需额外处理。
	 */
	ignoreOutsideInteractContainerId?: string
	children: React.ReactNode
	dataTestId: string
}) {
	const {
		open,
		title,
		onOpenChange,
		onCloseClick,
		onConfirm,
		confirmAriaLabel,
		confirmDisabled = false,
		hideCloseButton = false,
		headerAction,
		sheetClassName,
		overlayClassName,
		zIndex = MOBILE_SETTINGS_SHEET_Z_INDEX,
		zIndexScope,
		zIndexManaged = true,
		contentClassName,
		children,
		dataTestId,
	} = props
	const { t } = useTranslation("interface")

	return (
		<MagicPopup
			visible={open}
			onClose={() => onOpenChange(false)}
			/* 不传 title 给 MagicPopup，避免 sr-only DrawerTitle 与下方可见标题文字重复。 */
			/* 覆盖 MagicPopup 默认的圆角和背景色，保持设置浮层原有的视觉风格。 */
			className={cn("rounded-t-2xl bg-muted shadow-2xl shadow-black/10", sheetClassName)}
			overlayClassName={cn("bg-black/20 backdrop-blur-sm", overlayClassName)}
			/* 关闭 body 区域自身的滚动，改由内部 content 区域独立控制滚动行为。 */
			bodyClassName="flex max-h-none min-h-0 flex-1 flex-col overflow-hidden p-0"
			/* 复用 MagicPopup 全局栈自增；zIndex 仅作设置层起始基准（交易层 ≥1400 仍可覆盖）。 */
			zIndex={zIndex}
			zIndexScope={zIndexScope}
			zIndexManaged={zIndexManaged}
			/* 底部安全区由各页面 content 自行处理，避免与 MagicPopup 默认的 pb-safe-bottom 叠加。 */
			withSafeBottom={false}
		>
			<div className="flex min-h-0 flex-1 flex-col" data-testid={dataTestId}>
				<div className="mobile-popup-action-header relative flex h-12 w-full shrink-0 items-center justify-center px-16">
					{hideCloseButton ? null : (
						<MobileSettingsHeaderIconButton
							side="left"
							onClick={onCloseClick ?? (() => onOpenChange(false))}
							ariaLabel={t("button.close")}
						>
							<X className="size-[22px]" />
						</MobileSettingsHeaderIconButton>
					)}

					<span className="max-w-56 truncate text-center text-lg font-semibold leading-6 text-foreground">
						{title}
					</span>

					{headerAction ? (
						headerAction
					) : onConfirm ? (
						<MobileSettingsHeaderIconButton
							side="right"
							onClick={onConfirm}
							variant="primary"
							ariaLabel={confirmAriaLabel ?? t("button.confirm")}
							disabled={confirmDisabled}
						>
							<Check className="h-5 w-5" />
						</MobileSettingsHeaderIconButton>
					) : null}
				</div>

				<div
					className={`no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto ${
						contentClassName ??
						"gap-3 px-4 pb-[calc(var(--safe-area-inset-bottom)+1rem)] pt-1"
					}`}
				>
					{children}
				</div>
			</div>
		</MagicPopup>
	)
}
