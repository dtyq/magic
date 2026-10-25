import { cn } from "@/utils/cn"
import { Toaster } from "@/components/shadcn-ui/sonner"
import type { ToasterProps } from "sonner"
import { CircleCheck, CircleX, Info, Loader2, TriangleAlert, X } from "lucide-react"
import { useTranslation } from "react-i18next"

interface MagicToasterProps extends Partial<ToasterProps> {
	/** 是否使用居中定位样式，默认 true */
	centered?: boolean
}

/**
 * Wraps the shared Sonner toaster with the app's centered layout rules while
 * keeping mobile toasts inside the safe viewport for long localized messages.
 */
export default function MagicToaster({
	centered = true,
	visibleToasts = 3,
	position = "top-center",
	// Sonner collapses non-front toasts (hides inner content) when false
	expand = true,
	className,
	icons,
	toastOptions,
	closeButton = true,
	...rest
}: MagicToasterProps) {
	const { t } = useTranslation("super")
	return (
		<Toaster
			visibleToasts={visibleToasts}
			expand={expand}
			closeButton={closeButton}
			icons={{
				success: (
					<CircleCheck className="size-5 fill-success text-success-foreground [&>circle]:stroke-success" />
				),
				error: (
					<CircleX className="size-5 fill-destructive/10 text-destructive [&>circle]:stroke-destructive/10" />
				),
				info: <Info className="size-5 rounded-full bg-primary/10 p-0.5 text-primary" />,
				warning: (
					<TriangleAlert className="size-5 rounded-full bg-warning/10 p-0.5 text-warning" />
				),
				loading: (
					<Loader2 className="size-5 animate-spin rounded-full bg-primary/10 p-0.5 text-primary motion-reduce:animate-none" />
				),
				close: <X className="size-4" />,
				...icons,
			}}
			toastOptions={{ closeButtonAriaLabel: t("common.close"), ...toastOptions }}
			className={cn(
				// Sonner 默认层级会盖住项目浮层。提示需要高于弹窗遮罩，否则嵌套对话框里的失败提示会被挡住。
				"!z-[var(--z-index-toast)]",
				// 只调整表面和内部布局，Sonner 的堆叠、拖拽 transform 与计时仍由原组件管理。
				"[&_[data-sonner-toast][data-styled=true]]:w-fit [&_[data-sonner-toast][data-styled=true]]:max-w-[min(360px,calc(100vw-24px))] [&_[data-sonner-toast][data-styled=true]]:items-center [&_[data-sonner-toast][data-styled=true]]:gap-2.5 [&_[data-sonner-toast][data-styled=true]]:whitespace-normal [&_[data-sonner-toast][data-styled=true]]:rounded-xl [&_[data-sonner-toast][data-styled=true]]:px-3 [&_[data-sonner-toast][data-styled=true]]:py-2 [&_[data-sonner-toast][data-styled=true]]:shadow-md [&_[data-sonner-toast][data-styled=true]]:[overflow-wrap:anywhere]",
				"[&_[data-sonner-toast]:has([data-description])_[data-title]]:font-medium [&_[data-sonner-toast][data-styled=true]:has([data-description])]:p-3",
				"[&_[data-sonner-toast]_[data-content]]:gap-1 [&_[data-sonner-toast]_[data-description]]:text-xs [&_[data-sonner-toast]_[data-description]]:leading-[19px] [&_[data-sonner-toast]_[data-description]]:text-muted-foreground [&_[data-sonner-toast]_[data-title]]:text-[13px] [&_[data-sonner-toast]_[data-title]]:font-normal [&_[data-sonner-toast]_[data-title]]:leading-[21px]",
				"[&_[data-sonner-toast]_.sonner-loader]:static [&_[data-sonner-toast]_.sonner-loader]:translate-x-0 [&_[data-sonner-toast]_.sonner-loader]:translate-y-0 [&_[data-sonner-toast]_[data-icon]]:m-0 [&_[data-sonner-toast]_[data-icon]]:size-5 [&_[data-sonner-toast]_[data-icon]_svg]:m-0",
				// 关闭按钮脱离 Toast 布局流；视觉尺寸与触控范围分别控制，避免按钮撑大卡片。
				"[&_[data-sonner-toast]:not([data-dismissible=false]):has([data-close-button])]:!pr-10 [&_[data-sonner-toast][data-dismissible=false]_[data-close-button]]:hidden [&_[data-sonner-toast]_[data-close-button]:hover]:!bg-muted [&_[data-sonner-toast]_[data-close-button]]:!absolute [&_[data-sonner-toast]_[data-close-button]]:!bottom-auto [&_[data-sonner-toast]_[data-close-button]]:!left-auto [&_[data-sonner-toast]_[data-close-button]]:!right-2 [&_[data-sonner-toast]_[data-close-button]]:!top-1/2 [&_[data-sonner-toast]_[data-close-button]]:!my-0 [&_[data-sonner-toast]_[data-close-button]]:!size-6 [&_[data-sonner-toast]_[data-close-button]]:!-translate-y-1/2 [&_[data-sonner-toast]_[data-close-button]]:!rounded-md [&_[data-sonner-toast]_[data-close-button]]:!border-0 [&_[data-sonner-toast]_[data-close-button]]:!bg-transparent [&_[data-sonner-toast]_[data-close-button]]:!p-0 [&_[data-sonner-toast]_[data-close-button]]:!text-muted-foreground",
				// 触屏关闭区域扩展到 44px；正文保持原行高，避免短提示增高且状态图标偏上。
				"[@media(pointer:coarse)]:[&_[data-sonner-toast]_[data-close-button]]:before:absolute [@media(pointer:coarse)]:[&_[data-sonner-toast]_[data-close-button]]:before:-inset-2.5 [@media(pointer:coarse)]:[&_[data-sonner-toast]_[data-close-button]]:before:content-['']",
				centered && [
					"!left-0 !right-0 !top-[calc(var(--safe-area-inset-top)+40px)] !w-auto !translate-x-0",
					"[&_[data-sonner-toast]]:!left-0 [&_[data-sonner-toast]]:!right-0 [&_[data-sonner-toast]]:!mx-auto",
					// Desktop keeps the original compact single-line toast footprint.
					"[&_[data-sonner-toast]]:w-fit [&_[data-sonner-toast]]:py-2",
					// Mobile keeps short messages compact but still caps long content to the
					// safe viewport width so localized warnings wrap instead of overflowing.
					"max-md:[&_[data-sonner-toast]]:!w-fit max-md:[&_[data-sonner-toast]]:!max-w-[min(360px,calc(100vw-24px))] max-md:[&_[data-sonner-toast]]:!whitespace-normal max-md:[&_[data-sonner-toast]]:![overflow-wrap:anywhere]",
					// Sonner nests title/description containers, so they need explicit wrapping
					// overrides to prevent inner text nodes from restoring no-wrap behavior.
					"max-md:[&_[data-sonner-toast]_*]:!whitespace-normal max-md:[&_[data-sonner-toast]_*]:![overflow-wrap:anywhere]",
				],
				// 下载表面由内部组件整体拖动，外壳仅参与堆叠，不拦截原位置的页面操作。
				"[&_[data-sonner-toast].download-progress-toast_.download-progress-label]:!whitespace-nowrap",
				"[&_[data-sonner-toast].download-progress-toast]:!pointer-events-none [&_[data-sonner-toast].download-progress-toast]:!w-fit [&_[data-sonner-toast].download-progress-toast]:!max-w-[calc(100vw-24px)] [&_[data-sonner-toast].download-progress-toast]:!border-0 [&_[data-sonner-toast].download-progress-toast]:!bg-transparent [&_[data-sonner-toast].download-progress-toast]:!p-0 [&_[data-sonner-toast].download-progress-toast]:!shadow-none",
				className,
			)}
			position={position}
			{...rest}
		/>
	)
}
