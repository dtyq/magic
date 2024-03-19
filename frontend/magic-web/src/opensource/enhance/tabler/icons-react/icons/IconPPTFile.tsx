import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconPPTFile({ size }: IconProps) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size}>
			<g fillRule="evenodd" fill="none">
				<path d="M0 0h24v24H0z" />
				<path
					fill="#FA5C26"
					d="M15.763 0 23 7.237V22a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h12.763Z"
				/>
				<path
					fill="#FFF"
					fillOpacity=".401"
					d="M17.763 7.237a2 2 0 0 1-2-2V0L23 7.237h-5.237Z"
				/>
				<path
					strokeLinejoin="round"
					strokeLinecap="round"
					strokeWidth="1.5"
					stroke="#FFF"
					d="M7.904 11.147h7.171c1.114 0 2.017.947 2.017 2.115 0 1.169-.903 2.116-2.017 2.116h-7.17v3.48"
				/>
			</g>
		</svg>
	)
}

export default memo(IconPPTFile)
