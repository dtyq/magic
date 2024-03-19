import type { NodeTestingCtx } from "@dtyq/magic-flow/dist/MagicFlow/context/NodeTesingContext/Context"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import type { Dispatch, SetStateAction } from "react"
import React from "react"

export type CustomFlowCtx = React.PropsWithChildren<{
	testNode?: (node: MagicFlow.Node, dataSource: Record<string, any>) => Promise<void>
	resetTestingConfig?: () => void
	testingConfig?: NodeTestingCtx
	testFlowResult: NodeTestingCtx["testingResultMap"]
	setCurrentFlow: Dispatch<SetStateAction<MagicFlow.Flow | undefined>>
}>

export const CustomFlowContext = React.createContext({
	resetTestingConfig: () => {},
} as CustomFlowCtx)

export default null
