import { useExtraNodeConfig } from "@/MagicFlow/context/ExtraNodeConfigContext/useExtraNodeConfig"
import { nodeManager } from "@/MagicFlow/register/node"
import { getNodeVersion } from "@/MagicFlow/utils"
import _ from "lodash"
import React, { useMemo, memo, useCallback } from "react"
import { NodeProps, useStore } from "reactflow"
import { useNodeConfig } from "../../context/FlowContext/useFlow"
import { CurrentNodeProvider } from "../common/context/CurrentNode/Provider"
import { PopupProvider } from "../common/context/Popup/Provider"
import useAvatar from "../common/hooks/useAvatar"
import useBaseStyles from "../common/hooks/useBaseStyles"
import useDebug from "../common/hooks/useDebug"
import useDrag from "../common/hooks/useDrag"
import useEditName from "../common/hooks/useEditName"
import usePopup from "../common/hooks/usePopup"
import NodeChildren from "./components/NodeChildren"
import NodeToolbar from "./components/NodeToolbar"
import NodeWrapper from "./components/NodeWrapper"
import useNodeSelected from "@/MagicFlow/hooks/useNodeSelected"

const connectionNodeIdSelector = (state: any) => state.connectionNodeId

//@ts-ignore
function BaseNodeComponent({ data, isConnectable, id, position }: NodeProps) {
	const {
		icon,
		color,
		type,
		desc,
		style: defaultStyle,
		handle: { withSourceHandle, withTargetHandle },
		changeable,
	} = data

	const connectionNodeId = useStore(connectionNodeIdSelector)
	const isTarget = connectionNodeId && connectionNodeId !== id
	const { nodeConfig } = useNodeConfig()
	const { isEdit, setIsEdit, onChangeName } = useEditName({ id })
	const { isSelected } = useNodeSelected(id)

	const currentNode = useMemo(() => {
		return nodeConfig[id]
	}, [nodeConfig, id])

	// 使用useMemo包装对象引用，减少usePopup的不必要重新计算
	const popupProps = useMemo(
		() => ({
			currentNode,
			isSelected,
		}),
		[currentNode, isSelected],
	)

	const { openPopup, onNodeWrapperClick, nodeName, onDropdownClick, setOpenPopup, closePopup } =
		usePopup(popupProps)

	const ParamsComp = useMemo(
		() =>
			_.get(
				nodeManager.nodesMap,
				[type, getNodeVersion(currentNode), "component"],
				() => null,
			),
		[type, currentNode, nodeManager.nodesMap],
	)

	const HeaderRight = _.get(
		nodeManager.nodesMap,
		[type, getNodeVersion(currentNode), "schema", "headerRight"],
		null,
	)

	const { onDragOver, onDragLeave, onDrop } = useDrag({ id })

	const canConnect = useMemo(() => {
		const sourceNode = nodeConfig?.[connectionNodeId]
		if (sourceNode && currentNode) {
			if (currentNode?.parentId) {
				return sourceNode.parentId === currentNode.parentId
			}
		}
		return true
	}, [connectionNodeId, nodeConfig, currentNode])

	const { headerBackgroundColor } = useBaseStyles({ color })
	const { isDebug, onDebugChange, allowDebug } = useDebug({ id })
	const { nodeStyleMap, commonStyle, customNodeRenderConfig } = useExtraNodeConfig()
	const { AvatarComponent } = useAvatar({ icon, color, currentNode })

	// 使用useMemo稳定化NodeChildren的props
	const nodeChildrenProps = useMemo(
		() => ({
			// NodeHeader props
			id,
			headerBackgroundColor,
			AvatarComponent,
			isEdit,
			setIsEdit,
			nodeName,
			onChangeName,
			openPopup,
			setOpenPopup,
			onDropdownClick,
			type,
			desc,
			customNodeRenderConfig,
			HeaderRight,
			allowDebug,
			isDebug,
			onDebugChange,

			// NodeHandles props
			showDefaultSourceHandle: withSourceHandle,
			withTargetHandle,
			isConnectable,
			isSelected,
			canConnect,
			isTarget,

			// NodeContent props
			ParamsComp,
		}),
		[
			id,
			headerBackgroundColor,
			AvatarComponent,
			isEdit,
			setIsEdit,
			nodeName,
			onChangeName,
			openPopup,
			setOpenPopup,
			onDropdownClick,
			type,
			desc,
			customNodeRenderConfig,
			HeaderRight,
			allowDebug,
			isDebug,
			onDebugChange,
			withSourceHandle,
			withTargetHandle,
			isConnectable,
			isSelected,
			canConnect,
			isTarget,
			ParamsComp,
		],
	)

	// 使用useCallback稳定化各种回调函数
	const stableNodeWrapperClick = useCallback(onNodeWrapperClick, [onNodeWrapperClick])
	const stableOnDragLeave = useCallback(onDragLeave, [onDragLeave])
	const stableOnDragOver = useCallback(onDragOver, [onDragOver])
	const stableOnDrop = useCallback(onDrop, [onDrop])

	return (
		<CurrentNodeProvider currentNode={currentNode}>
			<PopupProvider closePopup={closePopup}>
				<NodeToolbar
					isSelected={isSelected}
					id={id}
					changeable={changeable}
					position={position}
				/>

				<NodeWrapper
					id={id}
					isSelected={isSelected}
					onNodeWrapperClick={stableNodeWrapperClick}
					defaultStyle={defaultStyle}
					commonStyle={commonStyle}
					nodeStyleMap={nodeStyleMap}
					type={type}
					onDragLeave={stableOnDragLeave}
					onDragOver={stableOnDragOver}
					onDrop={stableOnDrop}
				>
					<NodeChildren {...nodeChildrenProps} />
				</NodeWrapper>
			</PopupProvider>
		</CurrentNodeProvider>
	)
}

// 自定义比较函数，判断是否需要重新渲染
const propsAreEqual = (prevProps: NodeProps, nextProps: NodeProps) => {
	// 检查基本属性变化
	if (prevProps.id !== nextProps.id || prevProps.isConnectable !== nextProps.isConnectable) {
		return false
	}

	// 因为位置变化由ReactFlow内部处理，不需要我们重新渲染节点内容

	// 深度比较data属性中的关键项
	const prevData = prevProps.data || {}
	const nextData = nextProps.data || {}

	// 检查关键属性变化
	if (
		prevData.type !== nextData.type ||
		prevData.color !== nextData.color ||
		prevData.desc !== nextData.desc ||
		prevData.changeable !== nextData.changeable
	) {
		return false
	}

	// 如果上述比较都没有变化，则认为props相等，不需要重新渲染
	return true
}

// 使用memo包装BaseNode组件
const BaseNode = memo(BaseNodeComponent, propsAreEqual)

export default BaseNode
