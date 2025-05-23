import { Flex } from "antd"
import ToolsCard from "../../ToolsCard/ToolsCard"
import { ToolSelectedItem } from "../../../types"
import { memo } from "react"

interface ToolSetListProps {
	filteredUseableToolSets: any[]
	selectedTools?: ToolSelectedItem[]
}

function ToolSetList({ filteredUseableToolSets, selectedTools }: ToolSetListProps) {
	return (
		<Flex vertical gap={4}>
			{filteredUseableToolSets.map((toolSet) => {
				return (
					<ToolsCard key={toolSet.id} toolSet={toolSet} selectedTools={selectedTools} />
				)
			})}
		</Flex>
	)
}

export default memo(ToolSetList)
