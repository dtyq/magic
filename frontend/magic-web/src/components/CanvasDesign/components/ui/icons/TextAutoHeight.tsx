import type { LucideProps } from "lucide-react"

export default function TextAutoHeight({
	size = 16,
	color = "currentColor",
	className,
	...props
}: LucideProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 16 16"
			fill="none"
			className={className}
			{...props}
		>
			<path
				d="M4.66667 7.99984H11.3333M4.66667 10.6665H8.66667M4.66667 5.33317H10M2 2.6665V13.3332M14 2.6665V13.3332"
				stroke={color}
				strokeWidth="1.25"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}
