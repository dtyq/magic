import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconWordFile({ size }: IconProps) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size}>
			<g fillRule="evenodd" fill="none">
				<path d="M0 0h24v24H0z" />
				<path
					fill="#1D59D8"
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
					d="M7.18 10.843v7.711L12 13.736l4.82 4.818v-7.71"
				/>
			</g>
		</svg>
	)
}

export default memo(IconWordFile)
