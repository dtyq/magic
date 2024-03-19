import { memo } from "react"
import type { IconProps } from "@tabler/icons-react"

function IconKnowledgeFile({ size }: IconProps) {
	return (
		<svg viewBox="0 0 24 24" width={size} height={size}>
			<g fillRule="evenodd" fill="none">
				<path d="M0 0h24v24H0z" />
				<path
					fill="#1D59D8"
					d="M22 22a1 1 0 0 1 0 2H3a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H4.5a1.5 1.5 0 0 0-1.493 1.356L3 20.5a1.5 1.5 0 0 0 1.356 1.493L4.5 22H22Z"
				/>
				<path
					fill="#FFF"
					d="M13.963 0H19v5.51a.5.5 0 0 1-.739.44l-1.54-.839a.5.5 0 0 0-.478 0l-1.54.838a.5.5 0 0 1-.74-.439V0Z"
				/>
			</g>
		</svg>
	)
}

export default memo(IconKnowledgeFile)
