/**
 * 给业务节点使用的，用于向节点内注入当前测试的节点、测试的状态以及测试结果，有基础节点进行显示
 */
import React, { useMemo } from "react"
import { NodeTestingContext, NodeTestingCtx } from "./Context"

export const NodeTestingProvider = ({
	// 当前正在调试的节点id列表（用于显示loading）
	nowTestingNodeIds,
	// 当前调试的节点id
	testingNodeIds,
	// 节点id -> 节点调试日志
	testingResultMap,
	// 是否进行节点自动定位
	position,
	children,
}: NodeTestingCtx) => {
	const value = useMemo(() => {
		return {
			nowTestingNodeIds,
			testingNodeIds,
			testingResultMap,
			position
		}
	}, [nowTestingNodeIds, testingNodeIds, testingResultMap, position])

	return <NodeTestingContext.Provider value={value}>{children}</NodeTestingContext.Provider>
}
