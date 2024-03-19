import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconImageFile({ size }: IconProps) {
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
				<path
					fill="#FFF"
					d="M6.517 18.554h10.966a.867.867 0 0 0 .785-1.235l-.055-.115-.108-.226-.108-.22-.107-.213-.107-.207-.106-.201a20.778 20.778 0 0 0-.053-.099l-.105-.192a18.523 18.523 0 0 0-.053-.094l-.104-.183-.104-.177c-.985-1.651-1.895-2.477-2.73-2.477-1.259 0-2.439 1.124-3.54 3.372-.596-.807-1.461-1.21-2.598-1.21-.898 0-1.771.724-2.62 2.172a.867.867 0 0 0 .747 1.305Z"
				/>
				<circle r="1.241" cy="10.791" cx="7.53" fill="#FFF" />
			</g>
		</svg>
	)
}

export default memo(IconImageFile)
