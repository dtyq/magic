import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconOtherFile({ size }: IconProps) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size}>
			<g fillRule="evenodd" fill="none">
				<path d="M0 0h24v24H0z" />
				<path
					fill="#79878F"
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
					d="M12.62 8.603c1.537 0 2.768 1.291 2.768 2.866 0 1.517-1.141 2.77-2.598 2.86l-.17.006h-.745a1.25 1.25 0 0 0-1.244 1.122l-.006.128v1.48a.75.75 0 0 1-1.493.101l-.007-.102v-1.479a2.75 2.75 0 0 1 2.582-2.745l.168-.005h.746c.691 0 1.267-.604 1.267-1.366 0-.714-.506-1.29-1.139-1.359l-.128-.007H9.875a.75.75 0 0 1-.102-1.493l.102-.007h2.746ZM9.876 18.65a.75.75 0 0 1 .743.648l.007.102v.041a.75.75 0 0 1-1.493.102l-.007-.102v-.04a.75.75 0 0 1 .75-.75Z"
				/>
			</g>
		</svg>
	)
}

export default memo(IconOtherFile)
