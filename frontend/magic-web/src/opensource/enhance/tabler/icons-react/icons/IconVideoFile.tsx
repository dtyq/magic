import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconVideoFile({ size }: IconProps) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size}>
			<g fillRule="evenodd" fill="none">
				<path d="M0 0h24v24H0z" />
				<path
					fill="#6B7EEF"
					d="M15.763 0 23 7.237V22a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h12.763Z"
				/>
				<path
					fill="#FFF"
					fillOpacity=".401"
					d="M17.763 7.237a2 2 0 0 1-2-2V0L23 7.237h-5.237Z"
				/>
				<rect rx="1" height="8.311" width="9.371" y="10.831" x="5.748" fill="#FFF" />
				<path
					opacity=".702"
					fill="#FFF"
					d="m11.742 15.828 4.97 3.194a1 1 0 0 0 1.54-.842v-6.387a1 1 0 0 0-1.54-.841l-4.97 3.193a1 1 0 0 0 0 1.683Z"
				/>
			</g>
		</svg>
	)
}

export default memo(IconVideoFile)
