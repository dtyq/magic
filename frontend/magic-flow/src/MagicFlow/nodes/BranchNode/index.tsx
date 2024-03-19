import FlowPopup from "@/MagicFlow/components/FlowPopup"
import { nodeManager } from "@/MagicFlow/register/node"
import { Flex, Popover, Tooltip } from "antd"
import { IconPencilMinus, IconTransfer } from "@tabler/icons-react"
import clsx from "clsx"
import i18next from "i18next"
import _ from "lodash"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Handle, NodeProps, NodeToolbar, Position, useStore } from "reactflow"
import { useFlowNodes, useNodeConfig } from "../../context/FlowContext/useFlow"
import DebuggerComp from "../common/components/DebuggerComp"
import TextEditable from "../common/components/TextEditable"
import useBaseStyles from "../common/hooks/useBaseStyles"
import useEditName from "../common/hooks/useEditName"
import usePopup from "../common/hooks/usePopup"
import ToolbarComponent from "../common/toolbar"
import styles from "./index.module.less"
import useNodeSelected from "@/MagicFlow/hooks/useNodeSelected"

const connectionNodeIdSelector = (state: any) => state.connectionNodeId

// @ts-ignore
function BranchNode({ data, isConnectable, id, position }: NodeProps) {
	const { t } = useTranslation()
	const { icon, label, desc, isStart, color, type, changeable, index: nodeIndex } = data

	const { selectedNodeId } = useFlowNodes()
	const { nodeConfig } = useNodeConfig()

	const connectionNodeId = useStore(connectionNodeIdSelector)

	const isTarget = connectionNodeId && connectionNodeId !== id

	const { isEdit, setIsEdit, onChangeName } = useEditName({ id })

    const { isSelected } = useNodeSelected(id)

	const HeaderRight = _.get(nodeManager.nodesMap, [type, "schema", "headerRight"], null)

	const currentNode = useMemo(() => {
		return nodeConfig[id]
	}, [nodeConfig, id])

	const { openPopup, onNodeWrapperClick, nodeName, onDropdownClick, setOpenPopup } = usePopup({
		isSelected,
		currentNode,
	})

	const { headerBackgroundColor } = useBaseStyles({ color })

	return (
		<>
			{selectedNodeId === id && !isStart && (
				<NodeToolbar position={position}>
					<ToolbarComponent id={id} />
				</NodeToolbar>
			)}

			<div
				className={clsx(styles.branchNodeWrapper, {
					[styles.isSelected]: selectedNodeId === id,
				})}
				onClick={onNodeWrapperClick}
			>
				<DebuggerComp id={id} />
				<div className={styles.header} style={{ background: headerBackgroundColor }}>
					<div className={clsx("nodrag", styles.left)}>
						<Flex>
							<span className={styles.icon} style={{ background: color }}>
								{icon}
							</span>
							<TextEditable
								isEdit={isEdit}
								title={nodeName}
								onChange={onChangeName}
								setIsEdit={setIsEdit}
							/>
						</Flex>
					</div>

					<div className={styles.right}>
						{HeaderRight}

						{changeable.nodeType && (
							<>
								<Popover
									content={<FlowPopup nodeId={id} />}
									placement="right"
									showArrow={false}
									overlayClassName={styles.popup}
									open={openPopup}
								>
									<Tooltip
										title={i18next.t("flow.changeNodeType", {
											ns: "magicFlow",
										})}
									>
										<IconTransfer
											className={styles.hoverIcon}
											onClick={(e) => {
												onDropdownClick(e)
												setOpenPopup(!openPopup)
											}}
										/>
									</Tooltip>
								</Popover>

								<Tooltip
									title={i18next.t("flow.modifyNodeName", { ns: "magicFlow" })}
								>
									<IconPencilMinus
										onClick={(e) => {
											setIsEdit(true)
										}}
										className={clsx(styles.hoverIcon, styles.editIcon)}
									/>
								</Tooltip>
							</>
						)}
						{/* <div className={styles.indexIcon}>{nodeIndex + 1}</div> */}
						{/* <IconMore className={styles.iconMore}/> */}
					</div>
				</div>
				<div className={styles.desc}>{desc}</div>
				{!isStart && (
					<Handle
						type="target"
						position={Position.Left}
						isConnectable={isConnectable}
						className={clsx(styles.handle, styles.leftHandle, {
							[styles.isTarget]: isTarget,
						})}
					/>
				)}
			</div>
		</>
	)
}

export default BranchNode
