import { useEffect, useRef, useState, type HTMLAttributes, type RefObject } from "react"
import { cn } from "@/utils/cn"

interface MarketStickyHeaderProps extends HTMLAttributes<HTMLDivElement> {
	scrollViewportRef?: RefObject<HTMLDivElement | null>
}

function MarketStickyHeader({ className, scrollViewportRef, ...props }: MarketStickyHeaderProps) {
	const headerRef = useRef<HTMLDivElement>(null)
	const [isStuck, setIsStuck] = useState(false)

	useEffect(() => {
		const viewport = scrollViewportRef?.current
		const header = headerRef.current
		if (!viewport || !header) return

		const updateStickyState = () => {
			const viewportTop = viewport.getBoundingClientRect().top
			const headerTop = header.getBoundingClientRect().top
			setIsStuck(viewport.scrollTop > 0 && headerTop <= viewportTop + 1)
		}

		updateStickyState()
		viewport.addEventListener("scroll", updateStickyState, { passive: true })
		return () => viewport.removeEventListener("scroll", updateStickyState)
	}, [scrollViewportRef])

	return (
		<div
			ref={headerRef}
			className={cn(
				"sticky top-0 isolate z-50 flex min-w-0 flex-col bg-background",
				"after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-8 after:z-10 after:h-8 after:transition-opacity after:duration-150",
				"after:bg-gradient-to-b after:from-background after:via-background/90 after:to-transparent",
				isStuck ? "after:opacity-100" : "after:opacity-0",
				className,
			)}
			{...props}
		/>
	)
}

export default MarketStickyHeader
