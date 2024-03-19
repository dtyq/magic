import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

const IconProfessionalActive = memo(({ size = 16 }: IconProps) => {
	const scale = Number(size) / 16
	return (
		<svg
			width={size}
			height={size}
			viewBox={`0 0 ${size} ${size}`}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			transform={`scale(${scale})`}
		>
			<path
				d="M6.40967 13.3337H4.66634C4.31272 13.3337 3.97358 13.1932 3.72353 12.9431C3.47348 12.6931 3.33301 12.3539 3.33301 12.0003V4.00033C3.33301 3.6467 3.47348 3.30756 3.72353 3.05752C3.97358 2.80747 4.31272 2.66699 4.66634 2.66699H9.99967C10.3533 2.66699 10.6924 2.80747 10.9425 3.05752C11.1925 3.30756 11.333 3.6467 11.333 4.00033V5.00037"
				stroke="url(#paint0_linear_30103_21099)"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M11.2998 14C11.4758 13.2725 11.8489 12.6076 12.3782 12.0784C12.9074 11.5491 13.5723 11.176 14.2998 11C13.5723 10.824 12.9074 10.4509 12.3782 9.92165C11.8489 9.39239 11.4758 8.72749 11.2998 8C11.1238 8.72749 10.7507 9.39239 10.2215 9.92165C9.6922 10.4509 9.0273 10.824 8.2998 11C9.0273 11.176 9.6922 11.5491 10.2215 12.0784C10.7507 12.6076 11.1238 13.2725 11.2998 14Z"
				stroke="url(#paint1_linear_30103_21099)"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M6 5.33301H8.66667"
				stroke="url(#paint2_linear_30103_21099)"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M6 8H7.33333"
				stroke="url(#paint3_linear_30103_21099)"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<defs>
				<linearGradient
					id="paint0_linear_30103_21099"
					x1="3.76674"
					y1="3.28609"
					x2="13.2505"
					y2="8.91695"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#3F8FFF" />
					<stop offset="1" stopColor="#EF2FDF" />
				</linearGradient>
				<linearGradient
					id="paint1_linear_30103_21099"
					x1="8.62511"
					y1="8.34824"
					x2="14.539"
					y2="13.03"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#3F8FFF" />
					<stop offset="1" stopColor="#EF2FDF" />
				</linearGradient>
				<linearGradient
					id="paint2_linear_30103_21099"
					x1="6.14458"
					y1="5.39105"
					x2="6.92815"
					y2="7.04523"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#3F8FFF" />
					<stop offset="1" stopColor="#EF2FDF" />
				</linearGradient>
				<linearGradient
					id="paint3_linear_30103_21099"
					x1="6.07229"
					y1="8.05804"
					x2="7.08349"
					y2="9.1254"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#3F8FFF" />
					<stop offset="1" stopColor="#EF2FDF" />
				</linearGradient>
			</defs>
		</svg>
	)
})

IconProfessionalActive.displayName = "IconProfessionalActive"
export default IconProfessionalActive
