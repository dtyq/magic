import { cn } from "@/opensource/lib/utils"

interface TabBarOverlayGradientProps {
	className?: string
}

/**
 * TabBar overlay gradient effect component
 * Hidden when body has pointer-events: none
 */
function TabBarOverlayGradient({ className }: TabBarOverlayGradientProps) {
	return (
		<div
			className={cn(
				"pointer-events-none absolute bottom-[max(var(--safe-area-inset-bottom),_10px)] left-0 right-0 h-mobile-tabbar w-full bg-gradient-to-b from-transparent to-white",
				"after:absolute after:bottom-[calc(-4px-10px-30px-var(--safe-area-inset-bottom))] after:left-0 after:right-0 after:h-[calc(4px+10px+30px+var(--safe-area-inset-bottom))] after:bg-white ",
				className,
			)}
		/>
	)
}

export default TabBarOverlayGradient
