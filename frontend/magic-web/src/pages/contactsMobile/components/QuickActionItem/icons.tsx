import type { SVGProps } from "react"

// ChevronRight icon component
export function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg width="18" height="18" viewBox="0 0 18 18" fill="none" {...props}>
			<path
				d="M6.75 4.5L11.25 9L6.75 13.5"
				stroke="rgba(28, 29, 35, 0.6)"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

ChevronRightIcon.displayName = "ChevronRightIcon"
