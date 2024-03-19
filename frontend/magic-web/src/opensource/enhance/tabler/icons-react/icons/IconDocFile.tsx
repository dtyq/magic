import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconDocFile({ size }: IconProps) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size}>
			<g fillRule="evenodd" fill="none">
				<path d="M0 0h24v24H0z" />
				<path
					fillRule="nonzero"
					fill="#20B8D1"
					d="M15.763 0 23 7.237V22a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h12.763Z"
				/>
				<path
					fillRule="nonzero"
					fill="#FFF"
					fillOpacity=".401"
					d="M17.763 7.237a2 2 0 0 1-2-2V0L23 7.237h-5.237Z"
				/>
				<rect rx=".75" height="1.5" width="14.288" y="18.54" x="4.856" fill="#FFF" />
				<rect rx=".75" height="1.5" width="7.144" y="13.499" x="4.856" fill="#FFF" />
			</g>
		</svg>
	)
}

export default memo(IconDocFile)
