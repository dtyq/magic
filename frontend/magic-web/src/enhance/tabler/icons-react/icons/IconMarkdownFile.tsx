import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconMarkdownFile({ size }: IconProps) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size}>
			<g fillRule="evenodd" fill="none">
				<path d="M0 0h24v24H0z" />
				<path
					fill="#79878F"
					d="M15.763 0 23 7.237V22a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h12.763Z"
				/>
				<path
					fill="#FFF"
					fillOpacity=".401"
					d="M17.763 7.237a2 2 0 0 1-2-2V0L23 7.237h-5.237Z"
				/>
				<path
					strokeWidth="1.5"
					strokeLinejoin="round"
					strokeLinecap="round"
					stroke="#FFF"
					d="M5.25 17.404v-4.95l3.094 3.093 3.093-3.093v4.95m5.136-4.95v4.95m-2.178-2.154 2.178 2.154 2.177-2.155"
				/>
			</g>
		</svg>
	)
}

export default memo(IconMarkdownFile)
