import { memo } from "react"

export function VipTag({ className }: { className?: string }) {
	return (
		<svg
			width="24"
			height="17"
			viewBox="0 0 24 17"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
		>
			<rect width="24" height="17" rx="4" fill="url(#paint0_linear_6286_141982)" />
			<path
				d="M4.05 4.86H4.95L7.18 11.11H7.21L9.44 4.86H10.34L7.7 12H6.69L4.05 4.86ZM11.1667 4.86H11.9767V12H11.1667V4.86ZM13.4798 4.86H16.3998C18.0398 4.86 18.8598 5.56 18.8598 6.96C18.8598 8.37 18.0298 9.08 16.3898 9.08H14.2998V12H13.4798V4.86ZM14.2998 5.57V8.37H16.3498C16.9298 8.37 17.3498 8.25 17.6298 8.02C17.8998 7.79 18.0398 7.44 18.0398 6.96C18.0398 6.48 17.8998 6.13 17.6198 5.92C17.3398 5.68 16.9198 5.57 16.3498 5.57H14.2998Z"
				fill="white"
			/>
			<defs>
				<linearGradient
					id="paint0_linear_6286_141982"
					x1="1.3012"
					y1="0.986688"
					x2="18.4108"
					y2="20.1088"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#3F8FFF" />
					<stop offset="1" stopColor="#EF2FDF" />
				</linearGradient>
			</defs>
		</svg>
	)
}

export default memo(VipTag)
