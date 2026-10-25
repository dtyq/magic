import { cn } from "@/utils/cn"
import type { DialogWindowFrame } from "@/pages/superMagic/hooks/useDialogWindowFrame"

export interface DialogResizeGripProps {
	frame?: DialogWindowFrame
	visible?: boolean
	active?: boolean
	className?: string
	testId?: string
}

export function DialogResizeGrip({
	frame,
	visible,
	active,
	className,
	testId = "dialog-resize-grip",
}: DialogResizeGripProps) {
	const isVisible = visible ?? Boolean(frame?.windowOptions.resizable)
	const isActive = active ?? Boolean(frame?.resizeGuideVisible)

	if (!isVisible) return null

	return (
		<span
			aria-hidden="true"
			data-testid={testId}
			className={cn(
				"pointer-events-none absolute bottom-1 right-1 size-3 text-muted-foreground",
				isActive && "rounded-sm bg-primary/10 text-primary ring-4 ring-primary/10",
				className,
			)}
		>
			<span className="absolute bottom-1 right-0 h-px w-3 -rotate-45 bg-current" />
			<span className="absolute bottom-0.5 right-0 h-px w-1.5 -rotate-45 bg-current" />
		</span>
	)
}

export default DialogResizeGrip
