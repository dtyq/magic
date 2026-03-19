import { memo, useMemo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconLayoutListGradient({ size = 16 }: IconProps) {
	// Generate unique IDs for this component instance to avoid SVG gradient conflicts
	const gradientIds = useMemo(() => {
		const uniqueId = Math.random().toString(36).substr(2, 9)
		return {
			paint0: `paint0_linear_list_${uniqueId}`,
			paint1: `paint1_linear_list_${uniqueId}`,
		}
	}, [])

	return (
		<svg
			width={size}
			height={size}
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 16 16"
			fill="none"
		>
			<path
				d="M2.66797 3.99935C2.66797 3.64573 2.80844 3.30659 3.05849 3.05654C3.30854 2.80649 3.64768 2.66602 4.0013 2.66602H12.0013C12.3549 2.66602 12.6941 2.80649 12.9441 3.05654C13.1942 3.30659 13.3346 3.64573 13.3346 3.99935V5.33268C13.3346 5.6863 13.1942 6.02544 12.9441 6.27549C12.6941 6.52554 12.3549 6.66602 12.0013 6.66602H4.0013C3.64768 6.66602 3.30854 6.52554 3.05849 6.27549C2.80844 6.02544 2.66797 5.6863 2.66797 5.33268V3.99935Z"
				stroke={`url(#${gradientIds.paint0})`}
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M2.66797 10.6673C2.66797 10.3137 2.80844 9.97456 3.05849 9.72451C3.30854 9.47446 3.64768 9.33398 4.0013 9.33398H12.0013C12.3549 9.33398 12.6941 9.47446 12.9441 9.72451C13.1942 9.97456 13.3346 10.3137 13.3346 10.6673V12.0007C13.3346 12.3543 13.1942 12.6934 12.9441 12.9435C12.6941 13.1935 12.3549 13.334 12.0013 13.334H4.0013C3.64768 13.334 3.30854 13.1935 3.05849 12.9435C2.80844 12.6934 2.66797 12.3543 2.66797 12.0007V10.6673Z"
				stroke={`url(#${gradientIds.paint1})`}
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<defs>
				<linearGradient
					id={gradientIds.paint0}
					x1="3.24628"
					y1="2.89818"
					x2="6.38057"
					y2="9.51489"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#3F8FFF" />
					<stop offset="1" stopColor="#EF2FDF" />
				</linearGradient>
				<linearGradient
					id={gradientIds.paint1}
					x1="3.24628"
					y1="9.56615"
					x2="6.38057"
					y2="16.1829"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#3F8FFF" />
					<stop offset="1" stopColor="#EF2FDF" />
				</linearGradient>
			</defs>
		</svg>
	)
}

export default memo(IconLayoutListGradient)
