import { memo } from "react"
import type { TabIconProps } from "./types"

export const AppsIcon = memo(({ active = false, size = 20 }: TabIconProps) => {
	if (active) {
		return (
			<svg
				width={size}
				height={size}
				viewBox="0 0 20 20"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<g clipPath="url(#clip0_6451_75580)">
					<rect x="1" y="1" width="8" height="8" rx="2" fill="#0A0A0A" />
					<rect
						x="10.101"
						y="2.17157"
						width="8"
						height="8"
						rx="2"
						transform="rotate(-15 10.101 2.17157)"
						fill="#EAB308"
					/>
					<rect x="1" y="11" width="8" height="8" rx="2" fill="#0A0A0A" />
					<rect x="11" y="11" width="8" height="8" rx="2" fill="#0A0A0A" />
				</g>
				<defs>
					<clipPath id="clip0_6451_75580">
						<rect width="20" height="20" fill="white" />
					</clipPath>
				</defs>
			</svg>
		)
	}

	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 20 20"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<g clipPath="url(#clip0_6460_75640)">
				<rect x="1" y="1" width="8" height="8" rx="2" fill="#A3A3A3" />
				<rect x="11" y="1" width="8" height="8" rx="2" fill="#A3A3A3" />
				<rect x="1" y="11" width="8" height="8" rx="2" fill="#A3A3A3" />
				<rect x="11" y="11" width="8" height="8" rx="2" fill="#A3A3A3" />
			</g>
			<defs>
				<clipPath id="clip0_6460_75640">
					<rect width="20" height="20" fill="white" />
				</clipPath>
			</defs>
		</svg>
	)
})

AppsIcon.displayName = "AppsIcon"
