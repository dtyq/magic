import type { IconProps } from "@tabler/icons-react"
import { memo, useMemo } from "react"

const IconWandColorful = memo(({ stroke = 1.5, size = 20 }: IconProps) => {
	// Generate unique ID to avoid conflicts when multiple instances exist
	const gradientId = useMemo(() => `wand-gradient-${Math.random().toString(36).substr(2, 9)}`, [])
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 18 18"
			fill="none"
			role="img"
			aria-label="Magic wand icon"
		>
			<defs>
				<linearGradient
					id={gradientId}
					x1="2.25"
					y1="2.25"
					x2="16.8468"
					y2="3.56371"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#33D6C0" />
					<stop offset="0.25" stopColor="#5083FB" />
					<stop offset="0.5" stopColor="#336DF4" />
					<stop offset="0.75" stopColor="#4752E6" />
					<stop offset="1" stopColor="#8D55ED" />
				</linearGradient>
			</defs>
			<path
				d="M11.25 4.5L13.5 6.75M4.5 15.75L15.75 4.5L13.5 2.25L2.25 13.5L4.5 15.75ZM6.75 2.25C6.75 2.64782 6.90804 3.02936 7.18934 3.31066C7.47064 3.59196 7.85218 3.75 8.25 3.75C7.85218 3.75 7.47064 3.90804 7.18934 4.18934C6.90804 4.47064 6.75 4.85218 6.75 5.25C6.75 4.85218 6.59196 4.47064 6.31066 4.18934C6.02936 3.90804 5.64782 3.75 5.25 3.75C5.64782 3.75 6.02936 3.59196 6.31066 3.31066C6.59196 3.02936 6.75 2.64782 6.75 2.25ZM14.25 9.75C14.25 10.1478 14.408 10.5294 14.6893 10.8107C14.9706 11.092 15.3522 11.25 15.75 11.25C15.3522 11.25 14.9706 11.408 14.6893 11.6893C14.408 11.9706 14.25 12.3522 14.25 12.75C14.25 12.3522 14.092 11.9706 13.8107 11.6893C13.5294 11.408 13.1478 11.25 12.75 11.25C13.1478 11.25 13.5294 11.092 13.8107 10.8107C14.092 10.5294 14.25 10.1478 14.25 9.75Z"
				strokeWidth={stroke}
				stroke={`url(#${gradientId})`}
				strokeLinecap="round"
				strokeLinejoin="round"
				fill="none"
			/>
		</svg>
	)
})

export default IconWandColorful
