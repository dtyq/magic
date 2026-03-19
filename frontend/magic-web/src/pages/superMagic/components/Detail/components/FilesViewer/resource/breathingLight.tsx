interface BreathingLightProps {
	width?: number
	height?: number
	className?: string
	style?: React.CSSProperties
}

export default ({ width, height, className, style }: BreathingLightProps) => {
	// 如果没有传入具体尺寸，则使用 CSS 自适应
	const shouldUseAutoSize = width === undefined || height === undefined

	const svgStyle: React.CSSProperties = shouldUseAutoSize
		? {
				width: "100%",
				height: "100%",
				position: "absolute",
				top: 0,
				left: 0,
				...style,
			}
		: {
				width,
				height,
				...style,
			}

	return (
		<svg
			className={className}
			style={svgStyle}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			preserveAspectRatio="none"
			viewBox="0 0 800 800"
		>
			<g clipPath="url(#clip0_11515_289859)">
				<g filter="url(#filter0_f_11515_289859)">
					<path
						fillRule="evenodd"
						clipRule="evenodd"
						d="M850 -50V0V800V850H800H0H-50L-50 800V0L-50 -50H0H800L850 -50ZM30 30V770H770V30H30Z"
						fill="url(#paint0_linear_11515_289859)"
					/>
				</g>
			</g>
			<defs>
				<filter
					id="filter0_f_11515_289859"
					x="-130"
					y="-130"
					width="1060"
					height="1060"
					filterUnits="userSpaceOnUse"
					colorInterpolationFilters="sRGB"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feBlend
						mode="normal"
						in="SourceGraphic"
						in2="BackgroundImageFix"
						result="shape"
					/>
					<feGaussianBlur
						stdDeviation="40"
						result="effect1_foregroundBlur_11515_289859"
					/>
				</filter>
				<linearGradient
					id="paint0_linear_11515_289859"
					x1="-6.49098e-06"
					y1="9"
					x2="804.5"
					y2="802"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#D9F9FF" />
					<stop offset="1" stopColor="#E0D8FF" />
				</linearGradient>
				<clipPath id="clip0_11515_289859">
					<rect width="800" height="800" fill="white" />
				</clipPath>
			</defs>
		</svg>
	)
}
