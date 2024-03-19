import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconFolder({ size }: IconProps) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size}>
			<g fillRule="evenodd" fill="none">
				<path d="M0 0h24v24H0z" />
				<path
					fill="#FFA200"
					d="M2 1h4.687a2 2 0 0 1 1.206.404L9.65 2.732a2 2 0 0 0 1.205.405H22a2 2 0 0 1 2 2V21a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2Z"
				/>
				<path fill="#FFC154" d="M0 7.1h24V21a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V7.1Z" />
				<path
					fillRule="nonzero"
					fill="#FFF"
					d="M12.971 20H11.03c-1.843 0-3.298 0-3.298-.947v-.189c0-1.774 1.48-3.217 3.298-3.217h1.942c1.818 0 3.298 1.443 3.298 3.217v.19c0 .946-1.529.946-3.298.946Zm-1.138-4.52a2.598 2.598 0 0 1-2.595-2.595 2.598 2.598 0 0 1 2.595-2.595 2.598 2.598 0 0 1 2.595 2.595 2.598 2.598 0 0 1-2.595 2.595Z"
				/>
			</g>
		</svg>
	)
}

export default memo(IconFolder)
