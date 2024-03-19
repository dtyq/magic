// @ts-nocheck
import React, { useState, useCallback } from "react"
import ReactFlow, {
	Node,
	Edge,
	Controls,
	MiniMap,
	Background,
	useNodesState,
	useEdgesState,
	addEdge,
	Connection,
	ReactFlowProvider,
	Panel,
	NodeTypes,
} from "reactflow"
import "reactflow/dist/style.css"

// 自定义节点
const CustomNode = ({ data }: { data: { label: string } }) => {
	return (
		<div
			style={{
				padding: "10px",
				borderRadius: "5px",
				background: "#f0f0f0",
				border: "1px solid #ddd",
				width: "150px",
				textAlign: "center",
			}}
		>
			{data.label}
		</div>
	)
}

// 节点类型定义
const nodeTypes: NodeTypes = {
	custom: CustomNode,
}

/**
 * ReactFlow基础功能测试组件
 * 用于测试ReactFlow的基本交互和功能
 */
const ReactFlowBasicTest: React.FC = () => {
	// 初始节点
	const initialNodes = [
		{
			id: "1",
			type: "custom",
			data: { label: "节点 1" },
			position: { x: 250, y: 5 },
		},
		{
			id: "2",
			type: "custom",
			data: { label: "节点 2" },
			position: { x: 100, y: 100 },
		},
		{
			id: "3",
			type: "custom",
			data: { label: "节点 3" },
			position: { x: 400, y: 100 },
		},
		{
			id: "4",
			type: "custom",
			data: { label: "节点 4" },
			position: { x: 400, y: 200 },
		},
	]

	// 初始边
	const initialEdges = [
		{ id: "e1-2", source: "1", target: "2", animated: true },
		{ id: "e1-3", source: "1", target: "3" },
	]

	// 状态管理
	const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
	const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
	const [selectedNode, setSelectedNode] = useState<string | null>(null)
	const [nodeDragEnabled, setNodeDragEnabled] = useState<boolean>(true)
	const [snapToGrid, setSnapToGrid] = useState<boolean>(false)

	// 连接边的回调
	const onConnect = useCallback(
		(params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
		[setEdges],
	)

	// 节点点击回调
	const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
		setSelectedNode(node.id)
		console.log("选中节点:", node)
	}, [])

	// 添加新节点
	const addNode = useCallback(() => {
		const newNode = {
			id: `${nodes.length + 1}`,
			type: "custom",
			data: { label: `节点 ${nodes.length + 1}` },
			position: {
				x: Math.random() * 300 + 50,
				y: Math.random() * 300 + 50,
			},
		}

		setNodes((nds) => nds.concat(newNode))
	}, [nodes, setNodes])

	return (
		<div style={{ width: "100%", height: "100vh" }}>
			<ReactFlowProvider>
				<ReactFlow
					nodes={nodes}
					edges={edges}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					onConnect={onConnect}
					onNodeClick={onNodeClick}
					nodeTypes={nodeTypes}
					snapToGrid={snapToGrid}
					nodeDragable={nodeDragEnabled}
					fitView
				>
					<Controls />
					<MiniMap />
					<Background variant={snapToGrid ? "dots" : "lines"} />

					{/* 控制面板 */}
					<Panel
						position="top-left"
						style={{
							background: "white",
							padding: "10px",
							borderRadius: "5px",
							boxShadow: "0 0 10px rgba(0,0,0,0.15)",
						}}
					>
						<div>
							<h3 style={{ marginTop: 0 }}>ReactFlow 基本测试</h3>

							<div style={{ marginBottom: "10px" }}>
								<button onClick={addNode} style={{ marginRight: "10px" }}>
									添加节点
								</button>
								<button
									onClick={() => setNodeDragEnabled(!nodeDragEnabled)}
									style={{ marginRight: "10px" }}
								>
									{nodeDragEnabled ? "禁用" : "启用"}节点拖拽
								</button>
								<button onClick={() => setSnapToGrid(!snapToGrid)}>
									{snapToGrid ? "关闭" : "启用"}网格吸附
								</button>
							</div>

							{selectedNode && (
								<div>
									<strong>已选中节点:</strong> {selectedNode}
								</div>
							)}
						</div>
					</Panel>
				</ReactFlow>
			</ReactFlowProvider>
		</div>
	)
}

export default ReactFlowBasicTest
