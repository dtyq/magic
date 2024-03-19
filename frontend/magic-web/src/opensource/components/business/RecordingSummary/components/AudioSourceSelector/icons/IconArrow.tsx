import { memo } from "react"

function IconArrow({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			className={className}
		>
			<path
				d="M4.66663 9.99984L7.99996 13.3332L11.3333 9.99984M4.66663 5.99984L7.99996 2.6665L11.3333 5.99984"
				stroke="#111827"
				strokeWidth="1.25"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

export default memo(IconArrow)
