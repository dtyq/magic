import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconMindMaoFile({ size }: IconProps) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size}>
			<g fillRule="evenodd" fill="none">
				<path d="M0 0h24v24H0z" />
				<path
					fill="#FA5C26"
					d="M15.763 0 23 7.237V22a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h12.763Z"
				/>
				<path
					fill="#FFF"
					fillOpacity=".401"
					d="M17.763 7.237a2 2 0 0 1-2-2V0L23 7.237h-5.237Z"
				/>
				<g transform="translate(5.512 9.907)">
					<rect rx=".5" height="3.691" width="3.691" y="3.691" fill="#FFF" />
					<rect rx=".5" height="3.691" width="3.691" x="8.356" fill="#FFF" />
					<rect rx=".5" height="3.691" width="3.691" y="7.382" x="8.356" fill="#FFF" />
					<path
						strokeWidth="1.5"
						stroke="#FFF"
						strokeOpacity=".697"
						d="M3.346 5.536c.696 0 1.345-.348 1.73-.927l.61-.918A4.134 4.134 0 0 1 9.13 1.845h1.072M3.346 5.536c.696 0 1.345.349 1.73.928l.61.918A4.134 4.134 0 0 0 9.13 9.227h1.072"
					/>
				</g>
			</g>
		</svg>
	)
}

export default memo(IconMindMaoFile)
