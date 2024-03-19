// @ts-nocheck
import React, { useState, useMemo, useCallback } from "react"
import PerformanceTest from "./PerformanceTest"
import CanvasRenderer from "./CanvasRenderer"
import { Node, Edge } from "reactflow"

/**
 * 对比测试组件 - 同时展示ReactFlow和Canvas渲染的性能差异
 */
const ComparisonTest: React.FC = () => {
	const [nodeCount, setNodeCount] = useState(20)
	const [renderMode, setRenderMode] = useState<"react-flow" | "canvas" | "both">("both")

	// 生成测试节点
	const nodes: Node[] = useMemo(
		() =>
			Array.from({ length: nodeCount }, (_, i) => ({
				id: `node-${i}`,
				data: { label: `Node ${i}` },
				position: { x: (i % 10) * 200, y: Math.floor(i / 10) * 100 },
				type: "default",
			})),
		[nodeCount],
	)

	// 生成测试边
	const edges: Edge[] = useMemo(() => {
		const result: Edge[] = []
		for (let i = 0; i < nodeCount - 1; i++) {
			if (i % 10 < 9) {
				// 连接同一行的节点
				result.push({
					id: `edge-${i}-${i + 1}`,
					source: `node-${i}`,
					target: `node-${i + 1}`,
					type: "default",
				})
			}
			if (i + 10 < nodeCount) {
				// 连接上下行的节点
				result.push({
					id: `edge-${i}-${i + 10}`,
					source: `node-${i}`,
					target: `node-${i + 10}`,
					type: "default",
				})
			}
		}
		return result
	}, [nodeCount])

	// 增加节点数量
	const addNodes = useCallback(() => {
		setNodeCount((prev) => prev + 10)
	}, [])

	// 减少节点数量
	const removeNodes = useCallback(() => {
		setNodeCount((prev) => Math.max(10, prev - 10))
	}, [])

	return (
		<div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column" }}>
			{/* 控制面板 */}
			<div
				style={{
					padding: "10px",
					borderBottom: "1px solid #ddd",
					display: "flex",
					alignItems: "center",
					gap: "20px",
				}}
			>
				<div>
					<strong>当前节点数: </strong> {nodeCount}
					<div style={{ marginTop: "8px" }}>
						<button onClick={addNodes} style={{ marginRight: "5px" }}>
							增加10个节点
						</button>
						<button onClick={removeNodes}>减少10个节点</button>
					</div>
				</div>

				<div>
					<strong>渲染模式: </strong>
					<div style={{ marginTop: "8px" }}>
						<label style={{ marginRight: "10px" }}>
							<input
								type="radio"
								checked={renderMode === "both"}
								onChange={() => setRenderMode("both")}
							/>
							对比模式
						</label>
						<label style={{ marginRight: "10px" }}>
							<input
								type="radio"
								checked={renderMode === "react-flow"}
								onChange={() => setRenderMode("react-flow")}
							/>
							仅ReactFlow
						</label>
						<label>
							<input
								type="radio"
								checked={renderMode === "canvas"}
								onChange={() => setRenderMode("canvas")}
							/>
							仅Canvas
						</label>
					</div>
				</div>

				<div>
					<strong>性能测试说明:</strong>
					<div style={{ marginTop: "8px", fontSize: "12px" }}>
						1. 平移和缩放时观察FPS变化
						<br />
						2. 增加节点数量直到性能下降
						<br />
						3. 对比两种渲染模式的性能差异
					</div>
				</div>
			</div>

			{/* 渲染区域 */}
			<div
				style={{
					flex: 1,
					display: "flex",
					flexDirection: renderMode === "both" ? "row" : "column",
				}}
			>
				{(renderMode === "react-flow" || renderMode === "both") && (
					<div
						style={{
							flex: 1,
							height: renderMode === "both" ? "100%" : "100vh",
							border: renderMode === "both" ? "1px solid #ddd" : "none",
							position: "relative",
						}}
					>
						{renderMode === "both" && (
							<div
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									padding: "5px 10px",
									background: "#f0f0f0",
									borderRadius: "0 0 5px 0",
									zIndex: 5,
								}}
							>
								<strong>ReactFlow DOM渲染</strong>
							</div>
						)}
						<PerformanceTest />
					</div>
				)}

				{(renderMode === "canvas" || renderMode === "both") && (
					<div
						style={{
							flex: 1,
							height: renderMode === "both" ? "100%" : "100vh",
							border: renderMode === "both" ? "1px solid #ddd" : "none",
							position: "relative",
						}}
					>
						{renderMode === "both" && (
							<div
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									padding: "5px 10px",
									background: "#f0f0f0",
									borderRadius: "0 0 5px 0",
									zIndex: 5,
								}}
							>
								<strong>Canvas渲染</strong>
							</div>
						)}
						<CanvasRenderer nodes={nodes} edges={edges} />
					</div>
				)}
			</div>
		</div>
	)
}

export default ComparisonTest
