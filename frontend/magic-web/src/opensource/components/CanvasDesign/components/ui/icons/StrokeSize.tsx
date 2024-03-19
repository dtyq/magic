import type { LucideProps } from "lucide-react"

export default function StrokeSize({
	size = 16,
	color = "currentColor",
	className,
	...props
}: LucideProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 16 16"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			{...props}
		>
			<g clipPath="url(#clip0_667_13690)">
				<path
					d="M1.3335 4.84227H14.6668V7.64929H1.3335V4.84227Z"
					stroke={color}
					strokeWidth="1.33"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M1.3335 1.3335H14.6668V2.03525H1.3335V1.3335Z"
					stroke={color}
					strokeWidth="1.33"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M1.3335 10.4563H14.6668V14.6668H1.3335V10.4563Z"
					stroke={color}
					strokeWidth="1.33"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</g>
			<defs>
				<clipPath id="clip0_667_13690">
					<rect width="16" height="16" fill="white" />
				</clipPath>
			</defs>
		</svg>
	)
}
