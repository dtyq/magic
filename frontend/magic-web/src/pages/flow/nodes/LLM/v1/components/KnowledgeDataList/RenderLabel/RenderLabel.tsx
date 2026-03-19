import { IconWindowMaximize } from "@tabler/icons-react"
import { Flex, Tooltip } from "antd"
import styles from "../../KnowledgeDatabaseSelect/TeamshareKnowledgeSelect.module.less"
import { configStore } from "@/models/config"
import { defaultClusterCode } from "@/routes/helpers"

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
				<span className={styles.knowledgeName}>{item.name}</span>
			</Tooltip>
			{item.name && (
				<IconWindowMaximize
					onClick={(e) => {
						e.stopPropagation()
						// 使用全局配置的集群编码，而不是从路径解析（避免错误注入集群编码）
						const clusterCode = configStore.cluster.clusterCode || defaultClusterCode
						window.open(
							`/${clusterCode}/knowledge/directory/${item.business_id}`,
							"_blank",
						)
					}}
					className={styles.iconWindowMaximize}
					size={20}
				/>
			)}
		</Flex>
	)
}
