import { Flex } from "antd"
import { MCPSelectedItem } from "../../../types"
import { memo } from "react"
import MCPAddableCard from "./MCPAddableCard"
import { Flow } from "@/opensource/types/flow"

interface MCPListProps {
	filteredUseableMCPs: Flow.Mcp.Detail[]
	selectedMCPs?: MCPSelectedItem[]
}

function MCPList({ filteredUseableMCPs, selectedMCPs }: MCPListProps) {
	return (
		<Flex vertical gap={4}>
			{filteredUseableMCPs.map((mcp) => {
				return <MCPAddableCard key={mcp.id} mcp={mcp} selectedMCPs={selectedMCPs} />
			})}
		</Flex>
	)
}

export default memo(MCPList)
