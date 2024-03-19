import { memo } from "react"
import ToolCard from "../../ToolCard"
import type { BaseToolProps } from "../../../types"
import ToolContainer from "../../ToolContainer"

function StandardTool(props: BaseToolProps) {
	return (
		<ToolContainer>
			<ToolCard {...props} />
		</ToolContainer>
	)
}

export default memo(StandardTool)
