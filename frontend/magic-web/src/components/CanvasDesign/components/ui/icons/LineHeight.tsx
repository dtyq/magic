import type { LucideProps } from "lucide-react"

export default function LineHeight({
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
				d="M5.33317 11.3332L7.26536 5.84724C7.31818 5.69714 7.41731 5.56697 7.54896 5.47483C7.6806 5.38269 7.83821 5.33317 7.99984 5.33317C8.16147 5.33317 8.31907 5.38269 8.45072 5.47483C8.58236 5.56697 8.6815 5.69714 8.73431 5.84724L10.6665 11.3332M5.86422 9.83592H10.1355M13.3332 2.6665H2.6665M13.3332 13.3332H2.6665"
				stroke={color}
				strokeWidth="1.25"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}
