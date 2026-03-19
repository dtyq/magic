import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconHtmlFile({ size }: IconProps) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size}>
			<g fillRule="evenodd" fill="none">
				<path d="M0 0h24v24H0z" />
				<path
					fill="#FF7800"
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
					d="m13.16 12.21-2.32 6.26m-2.745-5.927-2.46 2.527 2.46 2.526m7.81-5.053 2.46 2.527-2.46 2.526"
				/>
			</g>
		</svg>
	)
}

export default memo(IconHtmlFile)
