import { useExternal } from "@/MagicFlow/context/ExternalContext/useExternal"
import { useFlow } from "@/MagicFlow/context/FlowContext/useFlow"
import { useMagicFlow } from "@/MagicFlow/context/MagicFlowContext/useMagicFlow"
import { InnerHandleType } from "@/MagicFlow/nodes"
import CustomHandle from "@/MagicFlow/nodes/common/Handle/Source"
import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { judgeIsLoopBody } from "@/MagicFlow/utils"
import { Tooltip } from "antd"
import { IconInfoCircle } from "@tabler/icons-react"
import { useUpdateEffect } from "ahooks"
import React from "react"
import { customNodeType } from "../../../constants"
import styles from "./index.module.less"

export default function Loop() {
	const { currentNode } = useCurrentNode()

	const { selectedNodeId, nodeConfig } = useFlow()

	const { paramsName } = useExternal()

	const { displayMaterialTypes, updateDisplayMaterialType } = useMagicFlow()

	useUpdateEffect(() => {
		const selectedNode = nodeConfig?.[selectedNodeId!]
		const isLoopBody = judgeIsLoopBody(selectedNode?.[paramsName.nodeType])
		if (isLoopBody) {
			updateDisplayMaterialType([...displayMaterialTypes, customNodeType.LoopEnd])
		} else {
			updateDisplayMaterialType(
				displayMaterialTypes.filter((nodeType) => nodeType !== customNodeType.LoopEnd),
			)
		}
	}, [selectedNodeId])

	return (
		<div className={styles.loop}>
			<div className={styles.loopBody}>
				<span>循环体</span>
				<Tooltip title="用于编排循环逻辑">
					<IconInfoCircle stroke={1} width={16} height={16} />
				</Tooltip>
				<CustomHandle
					type="source"
					isConnectable
					nodeId={currentNode?.node_id || ""}
					isSelected
					id={InnerHandleType.LoopHandle}
				/>
			</div>
			<div className={styles.loopNext}>
				<span>循环结束后执行下一步</span>
				<CustomHandle
					type="source"
					isConnectable
					nodeId={currentNode?.node_id || ""}
					isSelected
					id={InnerHandleType.LoopNext}
				/>
			</div>
		</div>
	)
}
