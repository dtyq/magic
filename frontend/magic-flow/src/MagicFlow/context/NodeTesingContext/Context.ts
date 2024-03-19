import { TestingResultRow } from "@/MagicFlow/nodes/common/NodeTestingHeader/useTesting"
import React from "react"

export type NodeTestConfig = {
	success: boolean
	start_time: string
	end_time: string
	elapsed_time: string
	error_message?: string
	params: Record<string, any>
	input?: Record<string, any>
	output?: Record<string, any>
	children_ids?: string[]
	loop_debug_results?: NodeTestConfig[]
	// debug日志
	debug_log?: Record<string, any>
}

export type NodeTestingCtx = React.PropsWithChildren<{
    nowTestingNodeIds: string[]
    testingNodeIds: string[]
	// id to testResult
    testingResultMap?: Record<string, NodeTestConfig>
	position?: boolean
}>  

export const NodeTestingContext = React.createContext({
    nowTestingNodeIds: [],
    testingNodeIds: [],
	testingResultMap: {},
} as NodeTestingCtx)
