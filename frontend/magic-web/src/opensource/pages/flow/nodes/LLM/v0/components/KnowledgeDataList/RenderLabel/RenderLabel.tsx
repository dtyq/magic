import { IconWindowMaximize } from "@tabler/icons-react"
import { Flex, Tooltip } from "antd"
import iconStyles from "@/opensource/pages/flow/nodes/VectorSearch/v0/components/KnowledgeSelect/KnowledgeSelect.module.less"
import knowledgeStyles from "@/opensource/pages/flow/nodes/KnowledgeSearch/v0/components/TeamshareKnowledgeSelect/TeamshareKnowledgeSelect.module.less"

type RenderLabelProps = {
	item: {
		name: string
		business_id: string
	}
}

export default function RenderLabel({ item }: RenderLabelProps) {
	return (
		<Flex align="center" gap={4}>
			<Tooltip title={item.name}>
				<span className={knowledgeStyles.knowledgeName}>{item.name}</span>
			</Tooltip>
			{item.name && (
				<IconWindowMaximize
					onClick={(e) => {
						e.stopPropagation()
						window.open(`/knowledge/directory/${item.business_id}`, "_blank")
					}}
					className={iconStyles.iconWindowMaximize}
					size={20}
				/>
			)}
		</Flex>
	)
}
