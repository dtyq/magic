import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconWhiteboardFile({ size }: IconProps) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size}>
			<g fillRule="evenodd" fill="none">
				<path d="M0 0h24v24H0z" />
				<path
					fill="#9267E7"
					d="M15.763 0 23 7.237V22a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h12.763Z"
				/>
				<path
					fill="#FFF"
					fillOpacity=".401"
					d="M17.763 7.237a2 2 0 0 1-2-2V0L23 7.237h-5.237Z"
				/>
				<g
					strokeWidth="1.5"
					strokeLinejoin="round"
					strokeLinecap="round"
					stroke="#FFF"
					opacity=".802"
					data-follow-stroke="#FFF"
				>
					<path d="M12 10.338v9.674M9.843 13.503l-2.135 6.509M14.157 13.503l2.135 6.509" />
				</g>
				<rect rx="1" height="7.864" width="12.714" y="10.583" x="5.643" fill="#FFF" />
			</g>
		</svg>
	)
}

export default memo(IconWhiteboardFile)
