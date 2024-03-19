import { NodeMapProvider } from "@/common/context/NodeMap/Provider"
import { MagicFlow } from "@/index"
import React, { useMemo } from "react"
import { generateNodeVersionSchema } from "../BaseFlow/utils/version"
import { installAllNodes } from "./utils"

export default function SecondFlow() {
	installAllNodes()

	const nodeSchemaMap = useMemo(() => {
		return generateNodeVersionSchema()
	}, [])
	return (
		<NodeMapProvider nodeMap={nodeSchemaMap}>
			<MagicFlow
				// @ts-ignore
				flowInstance={flowInstance}
				customParamsName={{
					params: "content",
					nodeType: "type",
				}}
				omitNodeKeys={["data"]}
			/>
		</NodeMapProvider>
	)
}
