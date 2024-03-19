import { useFlow } from "@/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { ShowColumns } from "@/MagicJsonSchemaEditor/constants"
import Schema from "@/MagicJsonSchemaEditor/types/Schema"
import DropdownCard from "@/common/BaseUI/DropdownCard"
import { MagicJsonSchemaEditor } from "@/index"
import { useUpdateEffect } from "ahooks"
import React, { useEffect, useState } from "react"
import usePrevious from "../../common/hooks/usePrevious"
import styles from "./index.module.less"

export default function HTTPNode() {
	const { expressionDataSource } = usePrevious()

	const { currentNode } = useCurrentNode()
	const { nodeConfig } = useFlow()

	const [output, setOutput] = useState<Schema>(
		// @ts-ignore
		currentNode?.output?.form?.structure,
	)

	// 上游同步下游
	useEffect(() => {
		if (!currentNode) return
		if (currentNode?.output?.form?.structure) setOutput(currentNode?.output?.form?.structure)
	}, [currentNode])

	// 下游同步上游
	useUpdateEffect(() => {
		if (!currentNode) return
		const currentNodeConfig = nodeConfig[currentNode?.node_id]
		if (!currentNodeConfig) return
		if (currentNodeConfig?.output) {
			currentNodeConfig.output.form.structure = output
		}
	}, [output])

	return (
		<div className={styles.http}>
			<DropdownCard title="输出" height="auto" headerClassWrapper={styles.output}>
				<MagicJsonSchemaEditor
					data={output}
					onChange={setOutput}
					allowExpression
					expressionSource={expressionDataSource}
					displayColumns={[
						ShowColumns.Key,
						ShowColumns.Label,
						ShowColumns.Type,
						ShowColumns.Value,
					]}
				/>
			</DropdownCard>
		</div>
	)
}
