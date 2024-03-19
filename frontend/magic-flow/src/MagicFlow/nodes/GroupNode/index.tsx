import FlowBackground from "@/MagicFlow/components/FlowDesign/components/FlowBackground"
import { useNodeConfig } from "@/MagicFlow/context/FlowContext/useFlow"
import { Tooltip } from "antd"
import { IconInfoCircle } from "@tabler/icons-react"
import clsx from "clsx"
import i18next from "i18next"
import React, { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { NodeProps, NodeToolbar, Position, useStore } from "reactflow"
import styles from "../BaseNode/index.module.less"
import CustomHandle from "../common/Handle/Source"
import DebuggerComp from "../common/components/DebuggerComp"
import useDrag from "../common/hooks/useDrag"
import ToolbarComponent from "../common/toolbar"
import "./index.less"
import { FLOW_EVENTS, flowEventBus } from "@/common/BaseUI/Select/constants"
import useNodeSelected from "@/MagicFlow/hooks/useNodeSelected"

const connectionNodeIdSelector = (state: any) => state.connectionNodeId

//@ts-ignore
export default function GroupNode({ id, data, isConnectable, position }: NodeProps) {
	const { nodeConfig } = useNodeConfig()
	const connectionNodeId = useStore(connectionNodeIdSelector)
	const { t } = useTranslation()
	const { isSelected } = useNodeSelected(id)

	const isTarget = connectionNodeId && connectionNodeId !== id

	const sourceNode = useMemo(() => {
		return nodeConfig?.[connectionNodeId]
	}, [connectionNodeId])

	const { onDragOver, onDragLeave, onDrop } = useDrag({ id })

	const canConnect = useMemo(() => {
		// 这里针对循环体进行处理，只能链接循环节点
		if (sourceNode) {
			return sourceNode?.data?.parentId === connectionNodeId
		}
		return true
	}, [sourceNode])

	return (
		<div
			className={clsx("magic-group-node", {
				[styles.isSelected]: isSelected,
			})}
			onDragOver={onDragOver}
			onDragLeave={onDragLeave}
			onDrop={onDrop}
		>
			{isSelected && (
				<NodeToolbar position={position || Position.Top}>
					<ToolbarComponent id={id} showCopy={false} />
				</NodeToolbar>
			)}
			<div className="group-title">
				<span>{i18next.t("flow.loopBody", { ns: "magicFlow" })}</span>
				<DebuggerComp id={id} />
				<Tooltip title={data?.description}>
					<IconInfoCircle stroke={1} width={16} height={16} />
				</Tooltip>
			</div>
			<CustomHandle
				type="target"
				nodeId={id}
				position={Position.Left}
				isConnectable={isConnectable}
				isSelected={isSelected}
				isTarget={isTarget}
			/>
			<FlowBackground />
		</div>
	)
}
