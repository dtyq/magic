import ErrorContent from "@/common/BaseUI/ErrorComponent/ErrorComponent"
import "antd/dist/reset.css"
import clsx from "clsx"
import _ from "lodash"
import React, { useImperativeHandle, useMemo } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { Edge, ReactFlowProvider } from "reactflow"
import "reactflow/dist/style.css"
import FlowDesign from "./components/FlowDesign"
import FlowHeader from "./components/FlowHeader"
import FlowMaterialPanel from "./components/FlowMaterialPanel"
import { defaultParamsName, prefix } from "./constants"
import { ExternalProvider } from "./context/ExternalContext/Provider"
import { FlowProvider } from "./context/FlowContext/Provider"
import { MagicFlowProvider } from "./context/MagicFlowContext/Provider"
import { NodesProvider } from "./context/NodesContext/Provider"
import { ResizeProvider } from "./context/ResizeContext/Provider"
import useBaseFlow from "./hooks/useBaseFlow"
import useResize from "./hooks/useResize"
import "./index.css"
import styles from "./index.module.less"
import { MagicFlow } from "./types/flow"
import { CLASSNAME_PREFIX } from "@/common/constants"
import { ConfigProvider } from "antd"

export * from "./register/node"

type MagicFlowProps = {
	/** 上游流程 */
	flow?: MagicFlow.Flow
	/** 头部右侧操作按钮组件 */
	header?: {
		buttons?: React.ReactElement
		backIcon?: React.ReactElement
	}
	/** 是否显示流程头部栏 */
	showHeader?: boolean
	/** 自定义toolbar */
	nodeToolbar?: {
		list: Array<{
			icon: () => React.ReactElement
			tooltip?: string
		}>
		mode?: "append" | "replaceAll"
	}
	/** 自定义左侧物料栏头部 */
	materialHeader?: React.ReactElement
	/** 自定义节点配置名称 */
	customParamsName?: Partial<MagicFlow.ParamsName>
	/** 定义节点omit参数keys */
	omitNodeKeys?: string[]
	/** 是否开始部分渲染 */
	onlyRenderVisibleElements?: boolean
	/** 是否挂载时进行自动布局 */
	layoutOnMount?: boolean
	/** 是否允许开启debug模式 */
	allowDebug?: boolean
	/** 是否显示额外信息 */
	showExtraFlowInfo?: boolean
	/** 流程实例 */
	flowInteractionRef?: React.MutableRefObject<any>
}

export type MagicFlowInstance = {
	/** 获取内部流程数据源 **/
	getFlow: () => MagicFlow.Flow
	/** 添加节点 */
	addNode: (node: MagicFlow.Node) => void
	/** 设置节点 */
	setNodes: (nodes: MagicFlow.Node[]) => void
	/** 设置节点配置 */
	setNodeConfig: (nodeConfig: Record<string, MagicFlow.Node>) => void
	/** 更新节点配置 */
	updateNodeConfig: (nodeConfig: Record<string, MagicFlow.Node>) => void
	/** 删除节点 */
	deleteNodes: (nodeIds: string[]) => void
	/** 更新节点位置 */
	updateNodesPosition: (nodeIds: string[], position: { x: number; y: number }) => void
	/** 更新节点连接 */
	updateNextNodeIdsByConnect: (nodeId: string, nextNodeIds: string[]) => void
	/** 更新节点连接 */
	updateNextNodeIdsByDeleteEdge: (nodeId: string, nextNodeIds: string[]) => void
	/** 设置选中的节点 */
	setSelectedNodeId: (nodeId: string) => void
	/** 获取节点配置 */
	getNodeConfig: () => Record<string, MagicFlow.Node>
	/** 获取节点连接 */
	getEdges: () => Edge[]
}

// 使用memo包装内容组件，避免多余渲染
const FlowContent = React.memo(
	({ showHeader, className }: { showHeader: boolean; className: string }) => {
		return (
			<div className={className}>
				{showHeader && <FlowHeader />}
				<div className={clsx(styles.content, `${prefix}content`)}>
					<FlowMaterialPanel />
					<FlowDesign />
				</div>
			</div>
		)
	},
)

const MagicFlowComponent = React.forwardRef(
	(
		{
			flow: currentFlow,
			header,
			showHeader = true,
			nodeToolbar,
			materialHeader,
			customParamsName,
			omitNodeKeys = [],
			onlyRenderVisibleElements = true,
			layoutOnMount = true,
			allowDebug = false,
			showExtraFlowInfo = true,
			flowInteractionRef,
		}: MagicFlowProps,
		ref,
	) => {
		const { windowSize } = useResize()

		const paramsName = useMemo(() => {
			return { ...defaultParamsName, ...(customParamsName || {}) }
		}, [customParamsName])

		const {
			flow,
			updateFlow,
			triggerNode,
			updateNodesPosition,
			nodes,
			setNodes,
			edges,
			onNodesChange,
			onEdgesChange,
			onConnect,
			nodeConfig,
			addNode,
			selectedNodeId,
			setSelectedNodeId,
			selectedEdgeId,
			setSelectedEdgeId,
			setEdges,
			updateNextNodeIdsByDeleteEdge,
			updateNodeConfig,
			description,
			flowInstance,
			updateNextNodeIdsByConnect,
			debuggerMode,
			getNewNodeIndex,
			showMaterialPanel,
			setShowMaterialPanel,
			flowDesignListener,
			deleteNodes,
			setNodeConfig,
			notifyNodeChange,
			deleteEdges,
			isProcessing,
			progress,
			processNodesBatch,
		} = useBaseFlow({ currentFlow, paramsName })

		useImperativeHandle(ref, () => ({
			getFlow: () => {
				return {
					...flow,
					nodes: nodes.map((n) => {
						const node = nodeConfig?.[n.node_id] || {}
						const omitKeysNode = _.omit(node, omitNodeKeys)
						return omitKeysNode
					}),
					edges,
					description,
				}
			},
			getNodeConfig: () => {
				return { ...nodeConfig }
			},
			addNode,
			setNodes,
			setNodeConfig,
			updateNodeConfig,
			deleteNodes,
			updateNodesPosition,
			updateNextNodeIdsByConnect,
			updateNextNodeIdsByDeleteEdge,
			setSelectedNodeId,
			getEdges: () => {
				return edges
			},
		}))

		// 使用useMemo缓存flowProviderProps以减少重新渲染
		const flowProviderProps = useMemo(
			() => ({
				flow,
				edges,
				onEdgesChange,
				onConnect,
				updateFlow,
				nodeConfig,
				setNodeConfig,
				updateNodeConfig,
				addNode,
				deleteNodes,
				updateNodesPosition,
				selectedNodeId,
				setSelectedNodeId,
				triggerNode,
				selectedEdgeId,
				setSelectedEdgeId,
				setEdges,
				updateNextNodeIdsByDeleteEdge,
				updateNextNodeIdsByConnect,
				description,
				flowInstance,
				debuggerMode,
				getNewNodeIndex,
				showMaterialPanel,
				setShowMaterialPanel,
				flowDesignListener,
				notifyNodeChange,
				deleteEdges,
				processNodesBatch,
			}),
			[
				flow,
				edges,
				onEdgesChange,
				onConnect,
				updateFlow,
				nodeConfig,
				setNodeConfig,
				updateNodeConfig,
				addNode,
				deleteNodes,
				updateNodesPosition,
				selectedNodeId,
				setSelectedNodeId,
				triggerNode,
				selectedEdgeId,
				setSelectedEdgeId,
				setEdges,
				updateNextNodeIdsByDeleteEdge,
				updateNextNodeIdsByConnect,
				description,
				flowInstance,
				debuggerMode,
				getNewNodeIndex,
				showMaterialPanel,
				setShowMaterialPanel,
				flowDesignListener,
				notifyNodeChange,
				deleteEdges,
				processNodesBatch,
			],
		)

		// 使用useMemo缓存externalProviderProps以减少重新渲染
		const externalProviderProps = useMemo(
			() => ({
				header,
				nodeToolbar,
				materialHeader,
				paramsName,
				onlyRenderVisibleElements,
				layoutOnMount,
				allowDebug,
				showExtraFlowInfo,
				flowInteractionRef,
				omitNodeKeys,
			}),
			[
				header,
				nodeToolbar,
				materialHeader,
				paramsName,
				onlyRenderVisibleElements,
				layoutOnMount,
				allowDebug,
				showExtraFlowInfo,
				flowInteractionRef,
				omitNodeKeys,
			],
		)

		// 使用useMemo缓存wrapper样式类名
		const wrapperClassName = useMemo(() => clsx(styles.magicFlow, `${prefix}magic-flow`), [])

		return (
			<ErrorBoundary
				fallbackRender={({ error }) => {
					console.log("error", error)
					return <ErrorContent />
				}}
			>
				<ConfigProvider prefixCls={CLASSNAME_PREFIX}>
					<MagicFlowProvider>
						<ExternalProvider {...externalProviderProps}>
							<ResizeProvider windowSize={windowSize}>
								<ReactFlowProvider>
									<NodesProvider
										nodes={nodes}
										setNodes={setNodes}
										onNodesChange={onNodesChange}
									>
										<FlowProvider {...flowProviderProps}>
											<FlowContent
												showHeader={showHeader}
												className={wrapperClassName}
											/>
											{/* 分批加载指示器 */}
											{isProcessing && (
												<div className={styles.batchLoadingIndicator}>
													加载中: {progress.current}/{progress.total} 批次
												</div>
											)}
										</FlowProvider>
									</NodesProvider>
								</ReactFlowProvider>
							</ResizeProvider>
						</ExternalProvider>
					</MagicFlowProvider>
				</ConfigProvider>
			</ErrorBoundary>
		)
	},
)

export default MagicFlowComponent
