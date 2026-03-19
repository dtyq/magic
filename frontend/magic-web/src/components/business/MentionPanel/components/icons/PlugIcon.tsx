import { memo } from "react"

function PlugIcon({ size = 16 }: { size?: number }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 16 16"
			fill="none"
		>
			<g clipPath="url(#clip0_8774_8550)">
				<mask
					id="mask0_8774_8550"
					maskUnits="userSpaceOnUse"
					x="-1"
					y="0"
					width="17"
					height="16"
				>
					<path
						d="M15.9993 8C15.9993 14.2501 14.2494 16 7.99927 16C1.74915 16 -0.000732422 14.2501 -0.000732422 8C-0.000732422 1.74988 1.74915 0 7.99927 0C14.2494 0 15.9993 1.74988 15.9993 8Z"
						fill="#DDEBFF"
					/>
				</mask>
				<g mask="url(#mask0_8774_8550)">
					<path
						d="M16 8C16 14.2501 14.2501 16 8 16C1.74988 16 0 14.2501 0 8C0 1.74988 1.74988 0 8 0C14.2501 0 16 1.74988 16 8Z"
						fill="url(#paint0_linear_8774_8550)"
					/>
					<path
						d="M6 2.66675C6.36875 2.66675 6.66667 2.96529 6.66667 3.33341V5.33341H5.33333V3.33341C5.33333 2.96529 5.63188 2.66675 6 2.66675ZM10 2.66675C10.3688 2.66675 10.6667 2.96529 10.6667 3.33341V5.33341H9.33333V3.33341C9.33333 2.96529 9.63125 2.66675 10 2.66675ZM11.3333 6.00008C11.7021 6.00008 12 6.298 12 6.66675C12 7.0355 11.7021 7.33342 11.3333 7.33342V8.00008C11.3333 9.61258 10.1875 10.9397 8.66667 11.2667V13.3334H7.33333V11.2667C5.81188 10.9397 4.66667 9.61258 4.66667 8.00008V7.33342C4.29854 7.33342 4 7.0355 4 6.66675C4 6.298 4.29854 6.00008 4.66667 6.00008H11.3333Z"
						fill="white"
					/>
				</g>
			</g>
			<defs>
				<linearGradient
					id="paint0_linear_8774_8550"
					x1="-0.666666"
					y1="-2.60356e-07"
					x2="15.3333"
					y2="14.3333"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#737373" />
					<stop offset="1" stopColor="#0A0A0A" />
				</linearGradient>
				<clipPath id="clip0_8774_8550">
					<rect width="16" height="16" fill="white" />
				</clipPath>
			</defs>
		</svg>
	)
}

export default memo(PlugIcon)
