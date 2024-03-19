// @ts-nocheck
import React, { useState, useCallback, useEffect, useMemo } from "react"
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
} from "reactflow"
import "reactflow/dist/style.css"

/**
 * 性能测试组件 - 测试ReactFlow的性能表现
 */
const PerformanceTest: React.FC = () => {
	// 性能指标状态
	const [renderTime, setRenderTime] = useState<number>(0)
	const [fps, setFps] = useState<number>(0)
	const [memoryUsage, setMemoryUsage] = useState<number | null>(null)
	const [nodeCount, setNodeCount] = useState<number>(0)

	// 生成大量节点的函数
	const generateNodes = useCallback((count: number): Node[] => {
		const nodes: Node[] = []
		const gridSize = Math.ceil(Math.sqrt(count))
		const spacing = 150

		for (let i = 0; i < count; i++) {
			const row = Math.floor(i / gridSize)
			const col = i % gridSize

			nodes.push({
				id: `node-${i}`,
				data: { label: `节点 ${i}` },
				position: { x: col * spacing, y: row * spacing },
				style: {
					background: "#fff",
					border: "1px solid #ddd",
					borderRadius: "4px",
					padding: "10px",
					width: 120,
					fontSize: "12px",
				},
			})
		}

		return nodes
	}, [])

	// 生成节点之间的连接
	const generateEdges = useCallback((nodeCount: number, edgesPerNode: number = 2): Edge[] => {
		const edges: Edge[] = []

		for (let i = 0; i < nodeCount; i++) {
			for (let j = 0; j < edgesPerNode; j++) {
				// 连接到随机目标节点，避免自循环
				let target
				do {
					target = Math.floor(Math.random() * nodeCount)
				} while (target === i)

				edges.push({
					id: `edge-${i}-${target}-${j}`,
					source: `node-${i}`,
					target: `node-${target}`,
					style: { stroke: "#aaa" },
				})
			}
		}

		return edges
	}, [])

	const [nodes, setNodes, onNodesChange] = useNodesState([])
	const [edges, setEdges, onEdgesChange] = useEdgesState([])

	// 添加边的回调
	const onConnect = useCallback(
		(params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
		[setEdges],
	)

	// 监控FPS
	useEffect(() => {
		let frameCount = 0
		let lastTime = performance.now()

		const calculateFps = () => {
			frameCount++
			const currentTime = performance.now()

			if (currentTime - lastTime >= 1000) {
				setFps(Math.round((frameCount * 1000) / (currentTime - lastTime)))
				frameCount = 0
				lastTime = currentTime

				// 如果浏览器支持，收集内存使用情况
				if (window.performance && (performance as any).memory) {
					setMemoryUsage((performance as any).memory.usedJSHeapSize / (1024 * 1024))
				}
			}

			requestAnimationFrame(calculateFps)
		}

		const frameId = requestAnimationFrame(calculateFps)

		return () => {
			cancelAnimationFrame(frameId)
		}
	}, [])

	// 测量渲染时间的函数
	const measureRenderTime = useCallback(
		(count: number) => {
			const startTime = performance.now()

			const newNodes = generateNodes(count)
			const newEdges = generateEdges(count)

			setNodes(newNodes)
			setEdges(newEdges)
			setNodeCount(count)

			// 等待下一帧渲染完成后测量时间
			requestAnimationFrame(() => {
				const endTime = performance.now()
				setRenderTime(endTime - startTime)
			})
		},
		[generateNodes, generateEdges, setNodes, setEdges],
	)

	// 创建测试按钮
	const testButtons = useMemo(() => {
		return [10, 50, 100, 500, 1000, 2000].map((count) => (
			<button
				key={count}
				onClick={() => measureRenderTime(count)}
				style={{ margin: "0 5px" }}
			>
				{count}个节点
			</button>
		))
	}, [measureRenderTime])

	return (
		<div style={{ width: "100%", height: "100vh" }}>
			<ReactFlow
				nodes={nodes}
				edges={edges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onConnect={onConnect}
				fitView
				onlyRenderVisibleElements
			>
				<Controls />
				<MiniMap />
				<Background />

				<Panel
					position="top-left"
					style={{ background: "white", padding: "10px", borderRadius: "5px" }}
				>
					<h3>ReactFlow 性能测试</h3>
					<div>
						<strong>节点数量:</strong> {nodeCount}
					</div>
					<div>
						<strong>渲染时间:</strong> {renderTime.toFixed(2)} ms
					</div>
					<div>
						<strong>FPS:</strong> {fps}
					</div>
					{memoryUsage !== null && (
						<div>
							<strong>内存使用:</strong> {memoryUsage.toFixed(2)} MB
						</div>
					)}
					<div style={{ marginTop: "10px" }}>{testButtons}</div>
					<div style={{ marginTop: "10px" }}>
						<button onClick={() => setNodes([])}>清空</button>
					</div>
				</Panel>
			</ReactFlow>
		</div>
	)
}

export default PerformanceTest
