import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconExcelFile({ size }: IconProps) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size}>
			<g fillRule="evenodd" fill="none">
				<path d="M0 0h24v24H0z" />
				<path
					fill="#009A51"
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
					d="m7.733 11.086 8.534 8.437m.073-8.361-8.68 8.286"
				/>
			</g>
		</svg>
	)
}

export default memo(IconExcelFile)
