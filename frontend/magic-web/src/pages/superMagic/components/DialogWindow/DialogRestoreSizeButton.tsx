import { RotateCcw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import type { DialogWindowFrame } from "@/pages/superMagic/hooks/useDialogWindowFrame"

export interface DialogRestoreSizeButtonProps {
	frame?: DialogWindowFrame
	onClick?: () => void
	visible?: boolean
	className?: string
	testId?: string
}

export function DialogRestoreSizeButton({
	frame,
	onClick,
	visible,
	className,
	testId = "dialog-restore-size-button",
}: DialogRestoreSizeButtonProps) {
	const { t } = useTranslation("super")
	const isVisible =
		visible ?? Boolean(frame?.windowOptions.resizable && frame?.restoreRecommendedSize)
	const handleClick = onClick ?? frame?.restoreRecommendedSize

	if (!isVisible || !handleClick) return null

	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			className={cn("gap-1.5 px-2 text-xs font-normal text-muted-foreground", className)}
			onClick={handleClick}
			data-testid={testId}
		>
			<RotateCcw size={16} aria-hidden="true" />
			{t("sidebarPanels.restoreRecommendedSize")}
		</Button>
	)
}

export default DialogRestoreSizeButton
