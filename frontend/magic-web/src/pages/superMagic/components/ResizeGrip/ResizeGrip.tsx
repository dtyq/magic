import { cn } from "@/utils/cn"

interface ResizeGripProps {
	orientation: "horizontal" | "vertical"
	className?: string
}

const BAR_CLASS =
	"rounded-xs bg-muted-foreground transition-colors duration-200 group-hover:bg-primary group-data-[resizing=true]:bg-primary"

/**
 * Soft blue glow for panel splitters.
 * Do not add relative/overflow here — callers are already positioned.
 */
export function resizeHandleGlowClass(orientation: "horizontal" | "vertical") {
	return cn(
		"before:pointer-events-none before:absolute before:inset-0 before:z-0 before:content-['']",
		"before:from-[rgba(239,246,255,0)] before:via-[rgba(210,230,255,1)] before:to-[rgba(239,246,255,0)]",
		"before:opacity-0 before:transition-opacity before:duration-200",
		"hover:before:opacity-100 data-[resizing=true]:before:opacity-100",
		orientation === "horizontal" ? "before:bg-gradient-to-r" : "before:bg-gradient-to-b",
	)
}

/** Shared two-line drag affordance. Keep the pad transparent. */
export function ResizeGrip({ orientation, className }: ResizeGripProps) {
	const isHorizontal = orientation === "horizontal"

	return (
		<div
			data-testid="resize-grip"
			data-orientation={orientation}
			className={cn(
				"pointer-events-none relative z-10 flex gap-0.5 bg-transparent",
				isHorizontal ? "w-5 flex-col" : "h-5 flex-row",
				className,
			)}
		>
			<div className={cn(BAR_CLASS, isHorizontal ? "h-px w-full" : "h-full w-px")} />
			<div className={cn(BAR_CLASS, isHorizontal ? "h-px w-full" : "h-full w-px")} />
		</div>
	)
}
