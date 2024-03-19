// @ts-nocheck
import React, { useState, useCallback, useEffect, useRef, useMemo } from "react"
import ReactFlow, {
	MiniMap,
	Controls,
	Background,
	useNodesState,
	useEdgesState,
	addEdge,
	Panel,
	Connection,
	Edge,
	Node,
	NodeTypes,
	NodeProps,
} from "reactflow"
import "reactflow/dist/style.css"

// 自定义简单节点，用于隔离测试
const SimpleNode = ({ data }: NodeProps) => {
	return (
		<div
			style={{
				padding: "8px",
				borderRadius: "3px",
				background: "#f0f0f0",
				border: "1px solid #ddd",
				width: "120px",
				height: "40px",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			{data.label}
		</div>
	)
}

// 自定义复杂节点，用于测试更复杂组件的性能影响
const ComplexNode = ({ data }: NodeProps) => {
	return (
		<div
			style={{
				padding: "10px",
				borderRadius: "5px",
				background: "white",
				border: "1px solid #ddd",
				width: "180px",
				boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
			}}
		>
			<div style={{ fontWeight: "bold", marginBottom: "5px" }}>{data.label}</div>
			<div style={{ fontSize: "11px", color: "#666" }}>ID: {data.id}</div>
			<div style={{ marginTop: "5px", display: "flex", justifyContent: "space-between" }}>
				<div
					style={{
						fontSize: "11px",
						background: "#eee",
						padding: "2px 5px",
						borderRadius: "3px",
					}}
				>
					输入: {data.inputs || 0}
				</div>
				<div
					style={{
						fontSize: "11px",
						background: "#eee",
						padding: "2px 5px",
						borderRadius: "3px",
					}}
				>
					输出: {data.outputs || 0}
				</div>
			</div>
		</div>
	)
}

// 注册节点类型
const nodeTypes: NodeTypes = {
	simple: SimpleNode,
	complex: ComplexNode,
}

/**
 * ReactFlow隔离测试组件 - 用于诊断性能问题
 */
const IsolationTest: React.FC = () => {
	// 性能指标状态
	const [renderTime, setRenderTime] = useState<number>(0)
	const [fps, setFps] = useState<number>(0)
	const [memoryUsage, setMemoryUsage] = useState<string>("未测量")
	const [nodeCount, setNodeCount] = useState<number>(0)
	const [edgeCount, setEdgeCount] = useState<number>(0)
	const [nodeType, setNodeType] = useState<"simple" | "complex">("simple")
	const [currentTest, setCurrentTest] = useState<string>("")

	// 流程图状态
	const [nodes, setNodes, onNodesChange] = useNodesState([])
	const [edges, setEdges, onEdgesChange] = useEdgesState([])

	// FPS测量
	const fpsRef = useRef<number>(0)
	const frameCountRef = useRef<number>(0)
	const lastTimeRef = useRef<number>(performance.now())
	const animationFrameIdRef = useRef<number | null>(null)

	// 连接边的回调
	const onConnect = useCallback(
		(params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
		[setEdges],
	)

	// 生成指定数量的节点
	const generateNodes = useCallback((count: number, type: "simple" | "complex"): Node[] => {
		const gridSize = Math.ceil(Math.sqrt(count))
		const spacing = 200

		return Array.from({ length: count }).map((_, i) => {
			const row = Math.floor(i / gridSize)
			const col = i % gridSize

			return {
				id: `node-${i}`,
				type: type,
				data: {
					label: `节点 ${i}`,
					id: `ID-${i}`,
					inputs: Math.floor(Math.random() * 3) + 1,
					outputs: Math.floor(Math.random() * 3) + 1,
				},
				position: {
					x: col * spacing,
					y: row * spacing,
				},
			}
		})
	}, [])

	// 生成指定数量的边
	const generateEdges = useCallback((nodeCount: number, edgeCount: number): Edge[] => {
		const edges: Edge[] = []

		// 确保边数不超过可能的最大连接数
		const maxPossibleEdges = nodeCount * (nodeCount - 1)
		const actualEdgeCount = Math.min(edgeCount, maxPossibleEdges)

		// 创建一个简单的树结构，确保所有节点都有连接
		for (let i = 1; i < nodeCount; i++) {
			const parentId = Math.floor((i - 1) / 2)
			edges.push({
				id: `edge-${parentId}-${i}`,
				source: `node-${parentId}`,
				target: `node-${i}`,
				type: "smoothstep",
			})
		}

		// 添加额外的随机边，直到达到指定数量
		if (edges.length < actualEdgeCount) {
			const remainingEdges = actualEdgeCount - edges.length

			for (let i = 0; i < remainingEdges; i++) {
				const source = Math.floor(Math.random() * nodeCount)
				let target = Math.floor(Math.random() * nodeCount)

				// 确保不是自环
				while (target === source) {
					target = Math.floor(Math.random() * nodeCount)
				}

				// 检查这条边是否已经存在
				const edgeExists = edges.some(
					(edge) => edge.source === `node-${source}` && edge.target === `node-${target}`,
				)

				if (!edgeExists) {
					edges.push({
						id: `edge-random-${i}`,
						source: `node-${source}`,
						target: `node-${target}`,
						type: "smoothstep",
					})
				}
			}
		}

		return edges
	}, [])

	// 监测FPS
	const monitorFPS = useCallback(() => {
		frameCountRef.current += 1
		const now = performance.now()
		const elapsed = now - lastTimeRef.current

		if (elapsed >= 1000) {
			fpsRef.current = Math.round((frameCountRef.current * 1000) / elapsed)
			setFps(fpsRef.current)
			frameCountRef.current = 0
			lastTimeRef.current = now
		}

		animationFrameIdRef.current = requestAnimationFrame(monitorFPS)
	}, [])

	// 测量内存使用情况
	const measureMemory = useCallback(async () => {
		if ("memory" in performance) {
			try {
				const memory = (performance as any).memory
				if (memory) {
					const usedHeapSize = memory.usedJSHeapSize
					const formattedMemory = (usedHeapSize / (1024 * 1024)).toFixed(2)
					setMemoryUsage(`${formattedMemory} MB`)
				}
			} catch (error) {
				console.error("无法测量内存使用情况:", error)
				setMemoryUsage("浏览器不支持")
			}
		} else {
			setMemoryUsage("浏览器不支持")
		}
	}, [])

	// 开始/停止性能监控
	useEffect(() => {
		// 开始监控FPS
		animationFrameIdRef.current = requestAnimationFrame(monitorFPS)

		// 定期测量内存
		const memoryInterval = setInterval(measureMemory, 1000)

		return () => {
			// 清理
			if (animationFrameIdRef.current !== null) {
				cancelAnimationFrame(animationFrameIdRef.current)
			}
			clearInterval(memoryInterval)
		}
	}, [monitorFPS, measureMemory])

	// 加载测试数据
	const loadTestData = useCallback(
		(count: number) => {
			setCurrentTest(`加载 ${count} 个${nodeType === "simple" ? "简单" : "复杂"}节点测试`)
			const start = performance.now()

			// 生成节点和边
			const edgeCount = count * 2 // 边的数量是节点的2倍
			const newNodes = generateNodes(count, nodeType)
			const newEdges = generateEdges(count, edgeCount)

			setNodes(newNodes)
			setEdges(newEdges)
			setNodeCount(count)
			setEdgeCount(edgeCount)

			// 使用setTimeout来确保渲染已完成
			setTimeout(() => {
				const end = performance.now()
				setRenderTime(end - start)
			}, 100)
		},
		[generateNodes, generateEdges, setNodes, setEdges, nodeType],
	)

	// 清除测试数据
	const clearTestData = useCallback(() => {
		setNodes([])
		setEdges([])
		setNodeCount(0)
		setEdgeCount(0)
		setRenderTime(0)
		setCurrentTest("")
	}, [setNodes, setEdges])

	// 切换节点类型
	const toggleNodeType = useCallback(() => {
		setNodeType((prev) => (prev === "simple" ? "complex" : "simple"))
	}, [])

	// 性能测试按钮列表
	const testButtons = useMemo(
		() => [
			{ count: 10, label: "10 节点" },
			{ count: 50, label: "50 节点" },
			{ count: 100, label: "100 节点" },
			{ count: 500, label: "500 节点" },
			{ count: 1000, label: "1000 节点" },
			{ count: 2000, label: "2000 节点" },
		],
		[],
	)

	return (
		<div style={{ width: "100%", height: "100vh" }}>
			<ReactFlow
				nodes={nodes}
				edges={edges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onConnect={onConnect}
				nodeTypes={nodeTypes}
				fitView
			>
				<Controls />
				<MiniMap />
				<Background variant="dots" />

				<Panel
					position="top-left"
					style={{
						background: "white",
						padding: "10px",
						borderRadius: "5px",
						boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
					}}
				>
					<h3 style={{ marginTop: 0 }}>ReactFlow 隔离测试</h3>

					<div style={{ marginBottom: "15px" }}>
						<div>
							<strong>当前测试:</strong> {currentTest || "无"}
						</div>
						<div>
							<strong>节点类型:</strong>{" "}
							{nodeType === "simple" ? "简单节点" : "复杂节点"}
						</div>
						<div>
							<strong>节点数量:</strong> {nodeCount}
						</div>
						<div>
							<strong>边数量:</strong> {edgeCount}
						</div>
						<div>
							<strong>渲染时间:</strong> {renderTime.toFixed(2)} ms
						</div>
						<div>
							<strong>FPS:</strong> {fps}
						</div>
						<div>
							<strong>内存使用:</strong> {memoryUsage}
						</div>
					</div>

					<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
						<div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
							{testButtons.map((btn) => (
								<button
									key={btn.count}
									onClick={() => loadTestData(btn.count)}
									style={{
										padding: "5px 10px",
										cursor: "pointer",
										background: "#f0f0f0",
										border: "1px solid #ddd",
										borderRadius: "3px",
									}}
								>
									{btn.label}
								</button>
							))}
						</div>

						<div style={{ display: "flex", gap: "8px" }}>
							<button
								onClick={toggleNodeType}
								style={{
									padding: "5px 10px",
									cursor: "pointer",
									background: "#e6f7ff",
									border: "1px solid #91d5ff",
									borderRadius: "3px",
									flex: 1,
								}}
							>
								切换为{nodeType === "simple" ? "复杂" : "简单"}节点
							</button>

							<button
								onClick={clearTestData}
								style={{
									padding: "5px 10px",
									cursor: "pointer",
									background: "#fff1f0",
									border: "1px solid #ffa39e",
									borderRadius: "3px",
									flex: 1,
								}}
							>
								清除测试
							</button>
						</div>
					</div>
				</Panel>
			</ReactFlow>
		</div>
	)
}

export default IsolationTest
