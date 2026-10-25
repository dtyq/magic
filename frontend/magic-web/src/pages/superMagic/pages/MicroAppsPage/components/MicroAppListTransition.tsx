import { useLayoutEffect, useRef, useState, type ReactNode } from "react"

/** Keep old results mounted and animate only the list's measured height and opacity. */
export default function MicroAppListTransition({
	loading,
	children,
}: {
	loading: boolean
	children: ReactNode
}) {
	const contentRef = useRef<HTMLDivElement | null>(null)
	const [height, setHeight] = useState<number>()
	useLayoutEffect(() => {
		const content = contentRef.current
		if (!content) return
		const measure = () => setHeight(content.getBoundingClientRect().height)
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(content)
		return () => observer.disconnect()
	}, [])

	return (
		<div
			className="transition-[height] duration-200 ease-out motion-reduce:transition-none"
			style={{ height }}
			aria-busy={loading}
		>
			<div
				ref={(node) => {
					contentRef.current = node
					// Native inert blocks keyboard focus and context menus as well as pointer clicks.
					node?.toggleAttribute("inert", loading)
				}}
				className="min-h-[220px] transition-opacity duration-200 ease-out motion-reduce:transition-none"
				style={{ opacity: loading ? 0.55 : 1 }}
				onClickCapture={(event) => {
					if (loading) {
						event.preventDefault()
						event.stopPropagation()
					}
				}}
			>
				{children}
			</div>
		</div>
	)
}
