import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconDocxFile({ size }: IconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 25 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<g clipPath="url(#clip0_171_244072)">
				<path
					fillRule="evenodd"
					clipRule="evenodd"
					d="M16.263 0L23.5 7.237V22C23.5 22.5304 23.2893 23.0391 22.9142 23.4142C22.5391 23.7893 22.0304 24 21.5 24H3.5C2.96957 24 2.46086 23.7893 2.08579 23.4142C1.71071 23.0391 1.5 22.5304 1.5 22V2C1.5 1.46957 1.71071 0.960859 2.08579 0.585786C2.46086 0.210714 2.96957 0 3.5 0L16.263 0Z"
					fill="#1D59D8"
				/>
				<path
					fillRule="evenodd"
					clipRule="evenodd"
					d="M18.263 7.237C17.7326 7.237 17.2239 7.02629 16.8488 6.65121C16.4737 6.27614 16.263 5.76743 16.263 5.237V0L23.5 7.237H18.263Z"
					fill="white"
					fillOpacity="0.401"
				/>
				<path
					d="M7.67999 10.843V18.554L12.5 13.736L17.32 18.554V10.844"
					stroke="white"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</g>
			<defs>
				<clipPath id="clip0_171_244072">
					<rect width="24" height="24" fill="white" transform="translate(0.5)" />
				</clipPath>
			</defs>
		</svg>
	)
}

export default memo(IconDocxFile)
