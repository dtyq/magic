import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconBiTable({ size }: IconProps) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size}>
			<g fillRule="evenodd" fill="none">
				<path d="M0 0h24v24H0z" />
				<path
					fill="#00C084"
					d="M15.763 0 23 7.237V22a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h12.763Z"
				/>
				<path
					fill="#FFF"
					fillOpacity=".401"
					d="M17.763 7.237a2 2 0 0 1-2-2V0L23 7.237h-5.237Z"
				/>
				<rect
					rx="1"
					height="8.905"
					width="11.874"
					y="9.603"
					x="6.063"
					opacity=".602"
					fill="#FFF"
				/>
				<path
					opacity=".703"
					fill="#FFF"
					d="M7.063 9.603h9.874a1 1 0 0 1 1 1v.979H6.063v-.98a1 1 0 0 1 1-1Z"
				/>
				<path
					fill="#FFF"
					d="M6.063 17.508v-6.905a1 1 0 0 1 1-1h.98v8.905h-.98a1 1 0 0 1-1-1Z"
				/>
			</g>
		</svg>
	)
}

export default memo(IconBiTable)
