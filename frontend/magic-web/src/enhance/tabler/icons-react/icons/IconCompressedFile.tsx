import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconCompressedFile({ size }: IconProps) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size}>
			<g fillRule="evenodd" fill="none">
				<path d="M0 0h24v24H0z" />
				<path
					fill="#FFA200"
					d="M15.763 0 23 7.237V22a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h12.763Z"
				/>
				<path
					fill="#FFF"
					fillOpacity=".401"
					d="M17.763 7.237a2 2 0 0 1-2-2V0L23 7.237h-5.237Z"
				/>
				<rect rx=".5" height="2.518" width="2.518" y="7.555" x="8.049" fill="#FFF" />
				<path
					fill="#FFF"
					d="M10.067 10.829a.5.5 0 0 1 .5.5v3.892a.5.5 0 0 1-.5.5H6.03a.5.5 0 0 1-.5-.5v-3.892a.5.5 0 0 1 .5-.5h4.037Zm-.453 2.446H6.483a.5.5 0 0 0-.5.5v.85a.5.5 0 0 0 .5.5h3.131a.5.5 0 0 0 .5-.5v-.85a.5.5 0 0 0-.5-.5ZM5.53 0h2.52v2.018a.5.5 0 0 1-.5.5H6.03a.5.5 0 0 1-.5-.5V0Z"
				/>
				<rect rx=".5" height="2.518" width="2.518" y="2.518" x="8.049" fill="#FFF" />
				<rect rx=".5" height="2.518" width="2.518" y="5.037" x="5.53" fill="#FFF" />
			</g>
		</svg>
	)
}

export default memo(IconCompressedFile)
