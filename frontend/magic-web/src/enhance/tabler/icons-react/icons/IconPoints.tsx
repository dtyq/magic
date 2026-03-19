import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

const IconPoints = memo(({ size = 20 }: IconProps) => {
	const scale = Number(size) / 20
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 20 20"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			transform={`scale(${scale})`}
		>
			<g clipPath="url(#clip0_29718_89062)">
				<path
					d="M0 10C0 4.47715 4.47715 0 10 0C15.5228 0 20 4.47715 20 10C20 15.5228 15.5228 20 10 20C4.47715 20 0 15.5228 0 10Z"
					fill="url(#paint0_linear_29718_89062)"
				/>
				<g filter="url(#filter0_d_29718_89062)">
					<path
						d="M9.27736 16.3482C9.47 17.0636 10.4851 17.0636 10.6777 16.3482L11.7917 12.2106C11.8589 11.9611 12.0539 11.7662 12.3034 11.699L16.4409 10.5849C17.1564 10.3923 17.1564 9.37722 16.4409 9.18459L12.3034 8.07056C12.0539 8.00337 11.8589 7.80845 11.7917 7.55891L10.6777 3.42136C10.4851 2.7059 9.47 2.7059 9.27736 3.42136L8.16333 7.55891C8.09615 7.80845 7.90122 8.00337 7.65168 8.07056L3.51413 9.18459C2.79868 9.37722 2.79867 10.3923 3.51413 10.5849L7.65168 11.699C7.90122 11.7662 8.09615 11.9611 8.16333 12.2106L9.27736 16.3482Z"
						fill="url(#paint1_linear_29718_89062)"
						shapeRendering="crispEdges"
					/>
				</g>
			</g>
			<defs>
				<filter
					id="filter0_d_29718_89062"
					x="2.97754"
					y="2.88477"
					width="14"
					height="14.5"
					filterUnits="userSpaceOnUse"
					colorInterpolationFilters="sRGB"
				>
					<feFlood floodOpacity="0" result="BackgroundImageFix" />
					<feColorMatrix
						in="SourceAlpha"
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
						result="hardAlpha"
					/>
					<feOffset dy="0.5" />
					<feComposite in2="hardAlpha" operator="out" />
					<feColorMatrix
						type="matrix"
						values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0"
					/>
					<feBlend
						mode="normal"
						in2="BackgroundImageFix"
						result="effect1_dropShadow_29718_89062"
					/>
					<feBlend
						mode="normal"
						in="SourceGraphic"
						in2="effect1_dropShadow_29718_89062"
						result="shape"
					/>
				</filter>
				<linearGradient
					id="paint0_linear_29718_89062"
					x1="1.08434"
					y1="1.16081"
					x2="20.7974"
					y2="16.7667"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#3F8FFF" />
					<stop offset="1" stopColor="#EF2FDF" />
				</linearGradient>
				<linearGradient
					id="paint1_linear_29718_89062"
					x1="10.0002"
					y1="8.00008"
					x2="12.7502"
					y2="14.3334"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="white" />
					<stop offset="1" stopColor="white" stopOpacity="0.3" />
				</linearGradient>
				<clipPath id="clip0_29718_89062">
					<rect width="20" height="20" rx="10" fill="white" />
				</clipPath>
			</defs>
		</svg>
	)
})

IconPoints.displayName = "IconPoints"
export default IconPoints
