import { MoveDiagonal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn-ui/alert"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import type { DialogWindowFrame } from "@/pages/superMagic/hooks/useDialogWindowFrame"

export interface DialogResizeGuideProps {
	frame?: DialogWindowFrame
	visible?: boolean
	onDismiss?: () => void
	onRestoreRecommendedSize?: () => void
	className?: string
	testId?: string
}

export function DialogResizeGuide({
	frame,
	visible,
	onDismiss,
	onRestoreRecommendedSize,
	className,
	testId = "dialog-resize-guide",
}: DialogResizeGuideProps) {
	const { t } = useTranslation("super")

	const isVisible =
		visible ?? Boolean(frame?.windowOptions.resizable && frame?.resizeGuideVisible)
	const handleDismiss = onDismiss ?? frame?.dismissResizeGuide
	const handleRestore = onRestoreRecommendedSize ?? frame?.restoreRecommendedSize

	if (!isVisible || !handleDismiss) return null

	return (
		<Alert
			role="note"
			aria-label={t("sidebarPanels.resizeGuideTitle")}
			className={cn(
				"absolute bottom-6 right-5 z-20 block w-80 max-w-[calc(100%-2.5rem)] space-y-2 bg-popover p-3 text-popover-foreground shadow-lg",
				className,
			)}
			data-testid={testId}
		>
			<AlertTitle className="flex items-center gap-2 text-sm font-medium">
				<MoveDiagonal size={16} aria-hidden="true" />
				{t("sidebarPanels.resizeGuideTitle")}
			</AlertTitle>
			<AlertDescription className="block text-xs leading-relaxed">
				{t("sidebarPanels.resizeGuideDescription")}
			</AlertDescription>
			<div className="flex flex-wrap items-center justify-end gap-2 pt-1">
				{handleRestore && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="text-xs font-normal"
						onClick={handleRestore}
						data-testid={`${testId}-restore`}
					>
						{t("sidebarPanels.restoreRecommendedSize")}
					</Button>
				)}
				<Button
					type="button"
					size="sm"
					className="text-xs"
					onClick={handleDismiss}
					data-testid={`${testId}-dismiss`}
				>
					{t("sidebarPanels.resizeGuideDismiss")}
				</Button>
			</div>
			<span
				aria-hidden="true"
				className="pointer-events-none absolute -bottom-1.5 right-2.5 size-3 rotate-45 border-b border-r border-border bg-popover"
			/>
		</Alert>
	)
}

export default DialogResizeGuide
