import { Check, X } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/shadcn-ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn-ui/sheet"
import { useOverlayZIndex } from "@/hooks/useOverlayZIndex"
import { cn } from "@/lib/utils"
import type { OverlayZIndexScope } from "@/utils/overlayZIndex/overlayStackManager"

import {
	MOBILE_SETTINGS_HEADER_ICON_BUTTON_CLASSNAME,
	MOBILE_SETTINGS_SHEET_CLASSNAME,
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

/** 统一渲染设置主浮层和二级浮层的底部 Sheet 外壳，减少重复的头部与拖拽区代码。 */
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
		zIndex,
		zIndexScope,
		zIndexManaged,
		contentClassName,
		ignoreOutsideInteractContainerId,
		children,
		dataTestId,
	} = props
	const { t } = useTranslation("interface")
	const overlayLayer = useOverlayZIndex({
		open,
		zIndex,
		zIndexScope,
		zIndexManaged,
	})

	/** 仅在 Sheet 内容退场动画真正结束后释放层级，避免父子 Sheet 关闭交错时复用旧层级。 */
	function handleContentAnimationEnd(event: React.AnimationEvent<HTMLDivElement>) {
		if (event.target === event.currentTarget && !open) {
			overlayLayer.releaseOverlayZIndex()
		}
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="bottom"
				showClose={false}
				aria-describedby={undefined}
				overlayClassName={cn("bg-black/20 backdrop-blur-sm", overlayClassName)}
				overlayStyle={{ zIndex: overlayLayer.overlayZIndex }}
				className={cn(MOBILE_SETTINGS_SHEET_CLASSNAME, sheetClassName)}
				style={{ zIndex: overlayLayer.contentZIndex }}
				onAnimationEnd={handleContentAnimationEnd}
				onInteractOutside={(event) => {
					if (
						isEventTargetInsideContainer(event.target, ignoreOutsideInteractContainerId)
					) {
						event.preventDefault()
					}
				}}
				data-testid={dataTestId}
			>
				<div className="flex w-full shrink-0 flex-col items-center py-1.5">
					<div className="h-1 w-20 rounded-full bg-muted-foreground/70" aria-hidden />
				</div>

				<div className="relative flex h-12 w-full shrink-0 items-center justify-center px-16">
					{hideCloseButton ? null : (
						<MobileSettingsHeaderIconButton
							side="left"
							onClick={onCloseClick ?? (() => onOpenChange(false))}
							ariaLabel={t("button.close")}
						>
							<X className="h-5 w-5" />
						</MobileSettingsHeaderIconButton>
					)}

					<SheetTitle className="max-w-56 truncate text-center text-lg font-semibold leading-6 text-foreground">
						{title}
					</SheetTitle>

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
							<Check className="h-5 w-5" strokeWidth={2.5} />
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
			</SheetContent>
		</Sheet>
	)
}

/** 外部 Portal 内的点击不应被当前 Sheet 当作遮罩点击，否则会误关闭父级设置浮层。 */
function isEventTargetInsideContainer(target: EventTarget | null, containerId?: string) {
	if (!containerId) return false
	if (!(target instanceof Node)) return false

	return Boolean(document.getElementById(containerId)?.contains(target))
}
