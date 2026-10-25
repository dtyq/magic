import type { ReactNode } from "react"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/utils/cn"

interface SlidesTemplateMobileFilterPopupAction {
	label: string
	onClick: () => void
	disabled?: boolean
	testId?: string
}

interface SlidesTemplateMobileFilterPopupHeaderAction {
	icon: ReactNode
	ariaLabel: string
	onClick: () => void
	disabled?: boolean
	testId?: string
}

interface SlidesTemplateMobileFilterPopupProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	children: ReactNode
	className?: string
	contentClassName?: string
	headerTrailingAction?: SlidesTemplateMobileFilterPopupHeaderAction
	secondaryAction?: SlidesTemplateMobileFilterPopupAction
	confirmAction?: SlidesTemplateMobileFilterPopupAction
}

function SlidesTemplateMobileFilterPopup({
	open,
	onOpenChange,
	title,
	children,
	className,
	contentClassName,
	headerTrailingAction,
	secondaryAction,
	confirmAction,
}: SlidesTemplateMobileFilterPopupProps) {
	const { t } = useTranslation()
	const closeLabel = t("shadcn-ui:actionDrawer.close")

	function handleClose() {
		onOpenChange(false)
	}

	return (
		<MagicPopup
			visible={open}
			onOpenChange={onOpenChange}
			onClose={handleClose}
			position="bottom"
			title={title}
			headerVariant="actionHeader"
			headerTitle={title}
			headerLeadingAction={{
				icon: <X />,
				ariaLabel: closeLabel,
				onClick: handleClose,
				testId: "slides-template-mobile-filter-close",
			}}
			headerTrailingAction={headerTrailingAction}
			className={cn(
				// Keep the viewport cap in Chrome 100, which predates dynamic viewport units.
				"max-h-[85vh] rounded-t-[14px] border-0 bg-muted p-0 supports-[height:100dvh]:max-h-[85dvh] supports-[overflow:clip]:overflow-clip",
				className,
			)}
			bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0 supports-[overflow:clip]:overflow-clip"
			style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
		>
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<ScrollArea
					className={cn("grid min-h-0 flex-1 px-3 pb-3 pt-2", contentClassName)}
					// Stretch the content wrapper so split filter panels retain their own scroll regions.
					viewportClassName="h-auto min-h-0 [&>div]:!flex [&>div]:h-full [&>div]:flex-col"
				>
					{children}
				</ScrollArea>
				{secondaryAction && confirmAction ? (
					<div className="flex shrink-0 gap-1.5 px-3 pb-3">
						<Button
							variant="outline"
							className="h-9 flex-[30%] shrink-0"
							onClick={secondaryAction.onClick}
							disabled={secondaryAction.disabled}
							data-testid={secondaryAction.testId}
						>
							{secondaryAction.label}
						</Button>
						<Button
							className="h-9 flex-[70%] shrink-0"
							onClick={confirmAction.onClick}
							disabled={confirmAction.disabled}
							data-testid={confirmAction.testId}
						>
							{confirmAction.label}
						</Button>
					</div>
				) : null}
			</div>
		</MagicPopup>
	)
}

export default SlidesTemplateMobileFilterPopup
