import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/utils/cn"

export const CONTEXT_TOOLBAR_STAGGER_MS = 16

export interface ContextToolbarMotionProps {
	children: ReactNode
	enabled: boolean
	open?: boolean
	as?: "div" | "span"
}

export function ContextToolbarMotion({
	children,
	enabled,
	open = true,
	as = "div",
}: ContextToolbarMotionProps) {
	const motionRef = useRef<HTMLElement | null>(null)
	const [isEntered, setIsEntered] = useState(false)

	useLayoutEffect(() => {
		if (!enabled || !motionRef.current) return

		const panel = motionRef.current.closest<HTMLElement>("[data-html-context-panel]")
		if (!panel) return

		const items = Array.from(
			panel.querySelectorAll<HTMLElement>("[data-context-toolbar-motion-item]"),
		)
		const itemIndex = items.indexOf(motionRef.current)
		if (itemIndex >= 0) {
			motionRef.current.style.setProperty(
				"--context-toolbar-delay",
				`${itemIndex * CONTEXT_TOOLBAR_STAGGER_MS}ms`,
			)
		}
	})

	useEffect(() => {
		if (!enabled || !open) {
			setIsEntered(false)
			return
		}

		const frame = window.requestAnimationFrame(() => setIsEntered(true))
		return () => window.cancelAnimationFrame(frame)
	}, [enabled, open])

	if (!enabled) return <>{children}</>
	const MotionTag = as

	return (
		<MotionTag
			ref={motionRef}
			data-context-toolbar-motion-item="true"
			className={cn(
				"transition-[opacity,transform] ease-out will-change-[opacity,transform] [transition-duration:160ms] motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
				as === "span" && "inline-flex",
				open && isEntered
					? "translate-y-0 opacity-100 [transition-delay:var(--context-toolbar-delay)]"
					: "translate-y-2 opacity-0 [transition-delay:0ms]",
			)}
		>
			{children}
		</MotionTag>
	)
}
