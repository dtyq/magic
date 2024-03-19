import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconAudioFile({ size }: IconProps) {
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
					fill="#FFF"
					d="M16.63 9.893a.713.713 0 0 0-.845-.7L9.077 10.45a.713.713 0 0 0-.582.7l.005 6.415a1.66 1.66 0 1 0 1.086 1.558v-6.05l5.957-1.118v4.352a1.66 1.66 0 1 0 1.086 1.558V9.894Z"
				/>
			</g>
		</svg>
	)
}

export default memo(IconAudioFile)
