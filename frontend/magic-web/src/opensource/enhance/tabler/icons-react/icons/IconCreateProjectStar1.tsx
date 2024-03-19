import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

const IconCreateProjectStar1 = memo(({ size = 21 }: IconProps) => {
	const scale = Number(size) / 21
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox={`0 0 ${size} ${size}`}
			fill="none"
			transform={`scale(${scale})`}
		>
			<path
				opacity="0.2"
				d="M7.18162 19.5894C7.18295 20.6825 8.62936 21.07 9.17702 20.1241L12.3442 14.6538C12.5352 14.3238 12.8873 14.1205 13.2686 14.1201L19.5896 14.1124C20.6826 14.1111 21.0702 12.6647 20.1243 12.117L14.6539 8.94986C14.324 8.75885 14.1207 8.40667 14.1202 8.02544L14.1126 1.70442C14.1112 0.61141 12.6648 0.223838 12.1172 1.16976L8.95002 6.64009C8.759 6.97002 8.40683 7.17335 8.0256 7.17381L1.70458 7.18147C0.611562 7.18279 0.223993 8.6292 1.16991 9.17686L6.64025 12.344C6.97017 12.535 7.1735 12.8872 7.17396 13.2684L7.18162 19.5894Z"
				fill="url(#starGradient1)"
			/>
			<defs>
				<linearGradient
					id="starGradient1"
					x1="-0.608192"
					y1="17.0807"
					x2="23.2254"
					y2="6.78329"
					gradientUnits="userSpaceOnUse"
				>
					<stop stopColor="#3F8FFF" />
					<stop offset="1" stopColor="#EF2FDF" />
				</linearGradient>
			</defs>
		</svg>
	)
})

IconCreateProjectStar1.displayName = "IconCreateProjectStar1"
export default IconCreateProjectStar1
