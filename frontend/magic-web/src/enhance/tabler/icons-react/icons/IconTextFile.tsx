import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconTextFile({ size }: IconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 25 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M16.263 0L23.5 7.237V22C23.5 22.5304 23.2893 23.0391 22.9142 23.4142C22.5391 23.7893 22.0304 24 21.5 24H3.5C2.96957 24 2.46086 23.7893 2.08579 23.4142C1.71071 23.0391 1.5 22.5304 1.5 22V2C1.5 1.46957 1.71071 0.960859 2.08579 0.585786C2.46086 0.210714 2.96957 0 3.5 0L16.263 0Z"
				fill="#FFC154"
			/>
			<path
				fillRule="evenodd"
				clipRule="evenodd"
				d="M18.263 7.237C17.7326 7.237 17.2239 7.02629 16.8488 6.65121C16.4737 6.27614 16.263 5.76743 16.263 5.237V0L23.5 7.237H18.263Z"
				fill="white"
				fillOpacity="0.401"
			/>
			<path
				d="M10.779 12.952L14.221 17.466M14.26 13.007L10.74 17.46M18.09 13.212V17.466M16.104 13.007H20.076M6.91001 13.212V17.466M4.92401 13.007H8.89601"
				stroke="white"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

export default memo(IconTextFile)
