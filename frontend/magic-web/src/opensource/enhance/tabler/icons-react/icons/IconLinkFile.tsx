import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconLinkFile({ size }: IconProps) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size}>
			<g fillRule="evenodd" fill="none">
				<path d="M0 0h24v24H0z" />
				<path
					fill="#2996F7"
					d="M15.763 0 23 7.237V22a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h12.763Z"
				/>
				<path
					fill="#FFF"
					fillOpacity=".401"
					d="M17.763 7.237a2 2 0 0 1-2-2V0L23 7.237h-5.237Z"
				/>
				<path
					fillRule="nonzero"
					fill="#FFF"
					d="M13.353 13.427a3.071 3.071 0 0 1 .124 4.212l-.124.131-1.658 1.66a3.071 3.071 0 0 1-4.468-4.213l.124-.131.688-.688a.75.75 0 0 1 1.128.984l-.067.077-.688.687a1.571 1.571 0 0 0 2.116 2.319l.106-.097 1.659-1.658a1.571 1.571 0 0 0 0-2.222.75.75 0 0 1 1.06-1.06Zm3.296-3.295a3.071 3.071 0 0 1 .124 4.212l-.124.13-.688.689a.75.75 0 0 1-1.128-.984l.067-.077.688-.688a1.571 1.571 0 0 0-2.116-2.318l-.106.096-1.659 1.659a1.57 1.57 0 0 0-.096 2.116l.096.106a.75.75 0 1 1-1.06 1.06 3.071 3.071 0 0 1-.124-4.212l.124-.13 1.658-1.66a3.073 3.073 0 0 1 4.344 0Z"
				/>
			</g>
		</svg>
	)
}

export default memo(IconLinkFile)
