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
				d="M14.6666 5.99998L7.99992 3.33331L1.33325 5.99998L7.99992 8.66665L14.6666 5.99998ZM14.6666 5.99998V9.99998"
				stroke="url(#paint0_linear_28143_337282)"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M4 7.06665V10.6667C4 11.1971 4.42143 11.7058 5.17157 12.0809C5.92172 12.4559 6.93913 12.6667 8 12.6667C9.06087 12.6667 10.0783 12.4559 10.8284 12.0809C11.5786 11.7058 12 11.1971 12 10.6667V7.06665"
				stroke="url(#paint1_linear_28143_337282)"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<defs>
				<linearGradient
					id="paint0_linear_28143_337282"
					x1="1.33325"
					y1="9.99998"
					x2="14.6666"
					y2="9.99998"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#F2994A" />
					<stop offset="1" stopColor="#F2C94C" />
				</linearGradient>
				<linearGradient
					id="paint1_linear_28143_337282"
					x1="4"
					y1="12.6666"
					x2="12"
					y2="12.6666"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#F2994A" />
					<stop offset="1" stopColor="#F2C94C" />
				</linearGradient>
			</defs>
		</svg>
	)
})

IconProfessionalActive.displayName = "IconProfessionalActive"
export default IconProfessionalActive
