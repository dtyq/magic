import { memo } from "react"
import { ToolSelectedItem } from "../../../types"
import ToolAddableCard from "./ToolAddableCard/ToolAddableCard"

interface ToolsListProps {
	tools: any[]
	cardOpen: boolean
	toolSet: any
	selectedTools?: ToolSelectedItem[]
}

function ToolsList({ tools, cardOpen, toolSet, selectedTools }: ToolsListProps) {
	return (
		<>
			{tools.map((tool) => {
				return (
					<ToolAddableCard
						key={tool.code}
						tool={tool}
						cardOpen={cardOpen}
						toolSet={toolSet}
						selectedTools={selectedTools}
					/>
				)
			})}
		</>
	)
}

export default memo(ToolsList)
