import { memo } from "react"

export const IconArrowUpGradient = memo(({ size = 20 }: { size?: number }) => {
	const width = size
	const height = size
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={width}
			height={height}
			viewBox="0 0 20 20"
			fill="none"
		>
			<path
				d="M10 4.16675V15.8334"
				stroke="url(#paint0_linear_1989_251468)"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M15 9.16675L10 4.16675"
				stroke="url(#paint1_linear_1989_251468)"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M5 9.16675L10 4.16675"
				stroke="url(#paint2_linear_1989_251468)"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<defs>
				<linearGradient
					id="paint0_linear_1989_251468"
					x1="10.0542"
					y1="4.84389"
					x2="11.6502"
					y2="4.95219"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#3F8FFF" />
					<stop offset="1" stopColor="#EF2FDF" />
				</linearGradient>
				<linearGradient
					id="paint1_linear_1989_251468"
					x1="10.2711"
					y1="4.45695"
					x2="15.1993"
					y2="8.35842"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#3F8FFF" />
					<stop offset="1" stopColor="#EF2FDF" />
				</linearGradient>
				<linearGradient
					id="paint2_linear_1989_251468"
					x1="5.27108"
					y1="4.45695"
					x2="10.1993"
					y2="8.35842"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#3F8FFF" />
					<stop offset="1" stopColor="#EF2FDF" />
				</linearGradient>
			</defs>
		</svg>
	)
})
