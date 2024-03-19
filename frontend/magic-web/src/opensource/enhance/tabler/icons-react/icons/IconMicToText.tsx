import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

const IconMicToText = ({ size = 20, stroke = 1.5 }: IconProps) => {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 20 20"
			fill="none"
		>
			<g clipPath="url(#clip0_5285_159469)">
				<path
					d="M9.16602 10.1855C9.16602 9.91538 9.27332 9.65632 9.46433 9.46531C9.65534 9.2743 9.91441 9.16699 10.1845 9.16699H17.3142C17.5843 9.16699 17.8434 9.2743 18.0344 9.46531C18.2254 9.65632 18.3327 9.91538 18.3327 10.1855V17.3151C18.3327 17.5853 18.2254 17.8443 18.0344 18.0353C17.8434 18.2264 17.5843 18.3337 17.3142 18.3337H10.1845C9.91441 18.3337 9.65534 18.2264 9.46433 18.0353C9.27332 17.8443 9.16602 17.5853 9.16602 17.3151V10.1855Z"
					stroke="#1C1D23"
					strokeOpacity="0.8"
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M13.75 15.8337L13.75 11.667"
					stroke="#1C1D23"
					strokeOpacity="0.8"
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M11.666 11.667L15.8327 11.667"
					stroke="#1C1D23"
					strokeOpacity="0.8"
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M10 5.83366V4.16699C10 3.50395 9.73661 2.86807 9.26777 2.39923C8.79893 1.93038 8.16304 1.66699 7.5 1.66699C6.83696 1.66699 6.20107 1.93038 5.73223 2.39923C5.26339 2.86807 5 3.50395 5 4.16699V8.33366C5 8.9967 5.26339 9.63258 5.73223 10.1014"
					stroke="#1C1D23"
					strokeOpacity="0.8"
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<path
					d="M1.66602 8.33301C1.66602 9.8801 2.2806 11.3638 3.37456 12.4578C4.06577 13.149 4.91259 13.6488 5.83268 13.9232"
					stroke="#1C1D23"
					strokeOpacity="0.8"
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</g>
			<defs>
				<clipPath id="clip0_5285_159469">
					<rect width="20" height="20" fill="white" />
				</clipPath>
			</defs>
		</svg>
	)
}

export default memo(IconMicToText)
