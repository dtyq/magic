import React from "react"
import { Background, BackgroundProps, BackgroundVariant } from "reactflow"

export default function FlowBackground(props: BackgroundProps) {
	return (
		<Background
			variant={BackgroundVariant.Dots}
			size={1}
			gap={20}
			color="#a7a9b0"
			style={{ background: "#2E2F380D" }}
			{...props}
		/>
	)
}
